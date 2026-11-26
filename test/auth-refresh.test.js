import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthFetch} from '../src/auth-fetch.js';
import {createBrowserAuthLock} from '../src/auth-lock.js';

const refreshUrl='https://project.example.supabase.co/auth/v1/token?grant_type=refresh_token';
const passwordUrl='https://project.example.supabase.co/auth/v1/token?grant_type=password';

test('refresh 429 is converted to retryable 503 without exposing the original response body',async()=>{
  const fetcher=createAuthFetch(async()=>new Response(JSON.stringify({code:'over_request_rate_limit',message:'Request rate limit reached'}),{status:429,headers:{'content-type':'application/json','retry-after':'2'}}));
  const response=await fetcher(refreshUrl);
  assert.equal(response.status,503);
  assert.equal(response.headers.get('retry-after'),'2');
  assert.match((await response.json()).message,/session is being retained/);
});

test('password sign-in 429 is not rewritten as a refresh failure',async()=>{
  const fetcher=createAuthFetch(async()=>new Response(JSON.stringify({code:'over_request_rate_limit'}),{status:429}));
  const response=await fetcher(passwordUrl);
  assert.equal(response.status,429);
});

test('invalid refresh credentials remain fatal and are not rewritten',async()=>{
  const fetcher=createAuthFetch(async()=>new Response(JSON.stringify({code:'refresh_token_not_found'}),{status:400}));
  const response=await fetcher(refreshUrl);
  assert.equal(response.status,400);
});

test('refresh timeout is converted to retryable 503',async()=>{
  const fetcher=createAuthFetch(async()=>new Response('timeout',{status:408}));
  const response=await fetcher(refreshUrl);
  assert.equal(response.status,503);
});

test('concurrent refresh conflict is converted to retryable 503',async()=>{
  const fetcher=createAuthFetch(async()=>new Response(JSON.stringify({code:'conflict',message:'Too many concurrent token refresh requests'}),{status:409}));
  const response=await fetcher(refreshUrl);
  assert.equal(response.status,503);
});

test('unrelated refresh conflict is not rewritten',async()=>{
  const fetcher=createAuthFetch(async()=>new Response(JSON.stringify({code:'other_conflict'}),{status:409}));
  const response=await fetcher(refreshUrl);
  assert.equal(response.status,409);
});

test('Web Locks adapter requests an exclusive lock and runs the protected operation',async()=>{
  let requestedName='',requestedMode='',ran=false;
  const lockManager={request:async(name,options,callback)=>{requestedName=name;requestedMode=options.mode;return callback({name});}};
  const lock=createBrowserAuthLock(lockManager);
  const result=await lock('lock:bwm-media-auth-v1',5000,async()=>{ran=true;return 42;});
  assert.equal(requestedName,'lock:bwm-media-auth-v1');
  assert.equal(requestedMode,'exclusive');
  assert.equal(ran,true);
  assert.equal(result,42);
});

test('Web Locks adapter serializes operations using the same session key',async()=>{
  const tails=new Map();
  const lockManager={request:async(name,_options,callback)=>{
    const previous=tails.get(name)||Promise.resolve();
    let release;
    const next=new Promise(resolve=>{release=resolve;});
    tails.set(name,previous.then(()=>next));
    await previous;
    try{return await callback({name});}finally{release();}
  }};
  const lock=createBrowserAuthLock(lockManager);
  let active=0,maxActive=0,releaseFirst;
  const firstGate=new Promise(resolve=>{releaseFirst=resolve;});
  let firstStarted;
  const started=new Promise(resolve=>{firstStarted=resolve;});
  const first=lock('shared-auth-key',5000,async()=>{active++;maxActive=Math.max(maxActive,active);firstStarted();await firstGate;active--;});
  await started;
  const second=lock('shared-auth-key',5000,async()=>{active++;maxActive=Math.max(maxActive,active);active--;});
  await Promise.resolve();
  assert.equal(maxActive,1);
  releaseFirst();
  await Promise.all([first,second]);
  assert.equal(maxActive,1);
});

test('Web Locks adapter falls back safely when the browser API is unavailable',async()=>{
  const lock=createBrowserAuthLock(null);
  assert.equal(await lock('auth-lock',5000,async()=> 'fallback'), 'fallback');
});

test('Web Locks adapter reports an unavailable immediate lock as an acquire timeout',async()=>{
  const lock=createBrowserAuthLock({request:async(_name,options,callback)=>callback(null)});
  await assert.rejects(lock('auth-lock',0,async()=>true),error=>error.isAcquireTimeout===true);
});

test('Web Locks adapter converts an acquisition timeout and clears its timer',async()=>{
  const lock=createBrowserAuthLock({
    request:(_name,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))
  });
  await assert.rejects(lock('auth-lock',5,async()=>true),error=>error.isAcquireTimeout===true);
});
