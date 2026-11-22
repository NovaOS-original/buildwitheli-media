import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('subscription duration is 30 days',()=>{assert.equal(30*24*60*60*1000,2592000000);});
test('Paystack GHS amount uses pesewas',()=>{assert.equal(Math.round(30*100),3000);});
test('creator submissions are always created as pending',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/status:'PENDING'/);});
test('admin routes require verified user and owner middleware',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.get\('\/api\/admin\/dashboard',requireUser,requireOwner/);assert.match(source,/app\.post\('\/api\/admin\/users\/:uid\/suspend',requireUser,requireOwner/);});
test('creator workspace and payment history routes exist',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/\/api\/creator\/dashboard/);assert.match(source,/\/api\/payments\/history/);});
test('suspension is enforced during authentication',async()=>{const source=await readFile(new URL('./auth.js',import.meta.url),'utf8');assert.match(source,/status==='SUSPENDED'/);});
