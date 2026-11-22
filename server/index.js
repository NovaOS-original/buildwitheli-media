import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db, firebaseAdmin, admin } from './firebase.js';
import { requireUser, requireOwner } from './auth.js';

const app=express();
const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(here,'../dist');
const port=Number(process.env.PORT||4000);
const DAY=24*60*60*1000;
app.use(helmet());
app.use(cors({origin:(process.env.APP_ORIGIN||'http://localhost:5173').split(',').map(x=>x.trim()),credentials:false}));
app.use('/api/payments/webhook',express.raw({type:'application/json'}));
app.post('/api/media/cover',requireUser,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'8mb'}),async(req,res)=>{
  const mime=req.headers['content-type'];
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({error:'Upload a JPG, PNG or WebP image.'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Supabase Storage is not configured on the server.'});
  const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp';
  const objectPath=req.user.uid+'/'+crypto.randomUUID()+'.'+ext;
  const base=process.env.SUPABASE_URL.endsWith('/')?process.env.SUPABASE_URL.slice(0,-1):process.env.SUPABASE_URL;
  try{
    const response=await fetch(base+'/storage/v1/object/creator-media/'+objectPath.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':mime,'x-upsert':'false'},body:req.body});
    if(!response.ok){const detail=await response.text();console.error('Supabase Storage upload failed',response.status,detail.slice(0,300));return res.status(502).json({error:'Image storage upload failed. Check the Supabase bucket configuration.'});}
    res.status(201).json({url:base+'/storage/v1/object/public/creator-media/'+objectPath.split('/').map(encodeURIComponent).join('/')});
  }catch(e){console.error('Supabase Storage unavailable',e);res.status(502).json({error:'Image storage is temporarily unavailable.'});}
});
app.use(express.json({limit:'1mb'}));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:true,legacyHeaders:false}));

const timestamp=v=>v?.toDate?.()?.toISOString?.()||v||null;
const cleanDoc=d=>({id:d.id,...d.data(),createdAt:timestamp(d.data().createdAt),updatedAt:timestamp(d.data().updatedAt),publishedAt:timestamp(d.data().publishedAt),expiresAt:timestamp(d.data().expiresAt),verifiedAt:timestamp(d.data().verifiedAt)});
const appSettings=()=>db().collection('settings').doc('app');
async function getPrice(){try{const s=await appSettings().get();return Number(s.data()?.subscriptionPriceGHS??process.env.SUBSCRIPTION_PRICE_GHS??30);}catch{return Number(process.env.SUBSCRIPTION_PRICE_GHS||30);}}
const activeSubscription=s=>Boolean(s&&s.status==='ACTIVE'&&s.expiresAt?.toDate?.()&&s.expiresAt.toDate()>new Date());
const profileSchema=z.object({displayName:z.string().trim().min(2).max(60),bio:z.string().trim().max(500).optional().default(''),website:z.string().url().max(200).optional().or(z.literal('')),avatarUrl:z.string().url().max(500).optional().or(z.literal(''))});

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'buildwitheli-media-api'}));
app.get('/api/public/posts',async(req,res)=>{
  try{const category=String(req.query.category||'').trim().slice(0,40);const snap=await db().collection('posts').where('status','==','PUBLISHED').limit(500).get();const published=snap.docs.map(cleanDoc).sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));res.json({posts:(category?published.filter(p=>p.category===category):published).slice(0,60)});}
  catch(e){console.error(e);res.status(503).json({error:'Content feed is not configured.'});}
});
app.get('/api/public/posts/:id',async(req,res)=>{
  try{let snap=await db().collection('posts').doc(req.params.id).get();if(!snap.exists){const found=await db().collection('posts').where('slug','==',req.params.id).limit(1).get();if(found.empty)return res.sendStatus(404);snap=found.docs[0];}if(snap.data().status!=='PUBLISHED')return res.sendStatus(404);res.json({post:cleanDoc(snap)});}
  catch(e){console.error(e);res.status(503).json({error:'Story is unavailable.'});}
});
app.get('/api/public/categories',async(_req,res)=>{
  try{const [snap,settings]=await Promise.all([db().collection('posts').where('status','==','PUBLISHED').limit(500).get(),appSettings().get()]);const categories=[...new Set([...(settings.data()?.categories||[]),...snap.docs.map(d=>String(d.data().category||'').trim())].filter(Boolean))].sort((a,b)=>a.localeCompare(b));res.json({categories});}
  catch(e){console.error(e);res.status(503).json({error:'Categories are unavailable.'});}
});
app.get('/sitemap.xml',async(_req,res)=>{
  const base=(process.env.APP_ORIGIN||'https://YOUR_PUBLIC_DOMAIN').split(',')[0].replace(/\/$/,'');
  try{const snap=await db().collection('posts').where('status','==','PUBLISHED').limit(1000).get();const docs=snap.docs.sort((a,b)=>String(timestamp(b.data().publishedAt)||'').localeCompare(String(timestamp(a.data().publishedAt)||'')));const urls=[base+'/',...docs.map(d=>base+'/story/'+encodeURIComponent(d.data().slug||d.id))];const xml='<?xml version="1.0" encoding="UTF-8"?>'+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+url.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</loc></url>').join('')+'</urlset>';res.type('application/xml').send(xml);}
  catch(e){console.error(e);res.status(503).type('text/plain').send('Sitemap temporarily unavailable');}
});
app.get('/api/me',requireUser,async(req,res)=>{
  try{const snap=await db().collection('users').doc(req.user.uid).get();const sub=await db().collection('subscriptions').doc(req.user.uid).get();res.json({profile:snap.exists?snap.data():null,subscription:sub.exists?cleanDoc(sub):null,emailVerified:req.user.email_verified});}
  catch{res.status(503).json({error:'Profile service unavailable.'});}
});
app.put('/api/creator/profile',requireUser,async(req,res)=>{
  const parsed=profileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Please check your profile fields.'});
  try{const ref=db().collection('users').doc(req.user.uid);const old=await ref.get();const now=new Date();await ref.set({...parsed.data,email:req.user.email||'',status:old.data()?.status||'ACTIVE',createdAt:old.data()?.createdAt||now,updatedAt:now},{merge:true});res.json({ok:true,profile:parsed.data});}
  catch{res.status(503).json({error:'Could not save your profile.'});}
});
app.get('/api/creator/dashboard',requireUser,async(req,res)=>{
  try{const [profile,sub,posts,txs]=await Promise.all([
    db().collection('users').doc(req.user.uid).get(),db().collection('subscriptions').doc(req.user.uid).get(),
    db().collection('posts').where('uid','==',req.user.uid).limit(100).get(),
    db().collection('transactions').where('uid','==',req.user.uid).limit(100).get()
  ]);
  const myPosts=posts.docs.map(cleanDoc).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  res.json({profile:profile.exists?profile.data():null,subscription:sub.exists?cleanDoc(sub):null,posts:myPosts,transactions:txs.docs.map(cleanDoc).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),canPublish:activeSubscription(sub.data()),subscriptionPriceGHS:await getPrice(),emailVerified:req.user.email_verified});
  }catch(e){console.error(e);res.status(503).json({error:'Creator workspace is unavailable.'});}
});
app.get('/api/payments/history',requireUser,async(req,res)=>{
  try{const snap=await db().collection('transactions').where('uid','==',req.user.uid).limit(100).get();res.json({transactions:snap.docs.map(cleanDoc).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))});}
  catch{res.status(503).json({error:'Payment history is unavailable.'});}
});
app.get('/api/payments/status/:reference',requireUser,async(req,res)=>{
  const reference=String(req.params.reference||'');
  if(!/^bwm_[a-f0-9]{32}$/i.test(reference))return res.status(400).json({error:'Invalid payment reference.'});
  try{const snap=await db().collection('transactions').doc(reference).get();if(!snap.exists||snap.data().uid!==req.user.uid)return res.sendStatus(404);const data=snap.data();res.json({reference,status:data.status,verifiedAt:timestamp(data.verifiedAt)});}
  catch{res.status(503).json({error:'Payment status is unavailable.'});}
});
app.post('/api/payments/initialize',requireUser,async(req,res)=>{
  if(!req.user.email_verified)return res.status(403).json({error:'Verify your email before subscribing.'});
  if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:'Paystack is not configured.'});
  const amount=Math.round((await getPrice())*100),reference='bwm_'+crypto.randomUUID().replaceAll('-','');
  try{
    const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:req.user.email,amount,currency:'GHS',reference,callback_url:(process.env.APP_ORIGIN||'http://localhost:5173')+'/payment/return',metadata:{uid:req.user.uid,product:'BUILDWITHELI MEDIA monthly membership'}})});
    const data=await response.json();if(!response.ok||!data.status)return res.status(502).json({error:'Payment provider could not initialize checkout.'});
    await db().collection('transactions').doc(reference).create({uid:req.user.uid,reference,amountPesewas:amount,currency:'GHS',status:'INITIALIZED',createdAt:new Date(),provider:'paystack'});
    res.json({authorization_url:data.data.authorization_url,reference});
  }catch(e){console.error(e);res.status(502).json({error:'Unable to start checkout.'});}
});
app.post('/api/payments/webhook',async(req,res)=>{
  const signature=req.headers['x-paystack-signature'];if(!process.env.PAYSTACK_SECRET_KEY||!signature)return res.sendStatus(401);
  const expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
  const a=Buffer.from(String(signature)),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
  let event;try{event=JSON.parse(req.body.toString('utf8'));}catch{return res.sendStatus(400);}
  if(event.event!=='charge.success')return res.sendStatus(200);
  const reference=String(event.data?.reference||'');
  try{
    const verify=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY}});
    const result=await verify.json();if(!verify.ok||!result.status||result.data.status!=='success')return res.sendStatus(200);
    const verified=result.data,ref=db().collection('transactions').doc(reference);
    await db().runTransaction(async t=>{
      const snap=await t.get(ref);if(!snap.exists)return;const saved=snap.data();if(saved.status==='SUCCESS')return;
      if(saved.uid!==String(verified.metadata?.uid||'')||saved.amountPesewas!==verified.amount||saved.currency!==verified.currency)return;
      const subRef=db().collection('subscriptions').doc(saved.uid),subSnap=await t.get(subRef),now=new Date();
      const currentEnd=subSnap.exists?subSnap.data().expiresAt?.toDate?.():null,start=currentEnd&&currentEnd>now?currentEnd:now;
      t.set(subRef,{uid:saved.uid,status:'ACTIVE',startedAt:now,expiresAt:new Date(start.getTime()+30*DAY),updatedAt:now},{merge:true});
      t.update(ref,{status:'SUCCESS',verifiedAt:now,providerTransactionId:String(verified.id)});
    });res.sendStatus(200);
  }catch(e){console.error(e);res.sendStatus(500);}
});
app.post('/api/creator/posts',requireUser,async(req,res)=>{
  if(!req.user.email_verified)return res.status(403).json({error:'Verify your email first.'});
  const schema=z.object({title:z.string().trim().min(5).max(120),excerpt:z.string().trim().max(280).optional(),body:z.string().trim().min(50).max(50000),category:z.string().trim().min(2).max(40),type:z.enum(['ARTICLE','VLOG']),videoUrl:z.string().url().optional(),coverImageUrl:z.string().url().max(1000).optional().refine(value=>!value||/^https:\/\/[^/]+\/storage\/v1\/object\/public\/creator-media\//.test(value),{message:'Cover images must use the configured public media bucket.'})});
  const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Please check your submission fields.'});
  if(parsed.data.type==='VLOG'&&!parsed.data.videoUrl)return res.status(400).json({error:'A vlog needs an external video URL.'});
  try{
    const sub=await db().collection('subscriptions').doc(req.user.uid).get();if(!activeSubscription(sub.data()))return res.status(402).json({error:'An active membership is required to submit content.'});
    const profile=await db().collection('users').doc(req.user.uid).get();
    const slug=parsed.data.title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)+'-'+crypto.randomBytes(3).toString('hex');const doc=await db().collection('posts').add({...parsed.data,slug,uid:req.user.uid,authorName:profile.data()?.displayName||req.user.name||req.user.email,status:'PENDING',featured:false,createdAt:new Date(),publishedAt:null});
    await db().collection('moderationHistory').add({postId:doc.id,action:'SUBMITTED',actorUid:req.user.uid,createdAt:new Date()});res.status(201).json({id:doc.id,status:'PENDING'});
  }catch(e){console.error(e);res.status(503).json({error:'Could not save submission.'});}
});

// Super Admin dashboard: every route below is protected by verified Firebase UID.
app.get('/api/admin/dashboard',requireUser,requireOwner,async(_req,res)=>{
  try{
    const [usersSnap,postsSnap,txSnap,subsSnap,authUsers,settingsSnap,auditSnap,moderationSnap]=await Promise.all([
      db().collection('users').limit(1000).get(),db().collection('posts').limit(500).get(),
      db().collection('transactions').limit(500).get(),db().collection('subscriptions').limit(1000).get(),
      admin.auth(firebaseAdmin()).listUsers(1000),appSettings().get(),db().collection('adminAudit').orderBy('createdAt','desc').limit(100).get(),db().collection('moderationHistory').orderBy('createdAt','desc').limit(100).get()
    ]);
    const userDocs=new Map(usersSnap.docs.map(d=>[d.id,d.data()]));
    const users=authUsers.users.map(u=>({uid:u.uid,email:u.email||'',displayName:userDocs.get(u.uid)?.displayName||u.displayName||'',status:u.disabled?'SUSPENDED':(userDocs.get(u.uid)?.status||'ACTIVE'),createdAt:u.metadata.creationTime||null,lastSignInAt:u.metadata.lastSignInTime||null}));
    const posts=postsSnap.docs.map(cleanDoc),transactions=txSnap.docs.map(cleanDoc),subscriptions=subsSnap.docs.map(cleanDoc);
    const revenue=transactions.filter(t=>t.status==='SUCCESS').reduce((s,t)=>s+(Number(t.amountPesewas)||0),0);
    const monthMap=new Map();for(const t of transactions.filter(x=>x.status==='SUCCESS')){const m=String(t.createdAt||'').slice(0,7);if(m)monthMap.set(m,(monthMap.get(m)||0)+(Number(t.amountPesewas)||0));}
    const analytics=[...monthMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([month,pesewas])=>({month,revenueGHS:pesewas/100}));
    const now=new Date(),active=subscriptions.filter(s=>activeSubscription(s)).length;
    res.json({metrics:{users:users.length,creators:users.filter(u=>u.displayName).length,posts:posts.length,pendingPosts:posts.filter(p=>p.status==='PENDING').length,activeSubscriptions:active,transactions:transactions.length,revenueGHS:revenue/100},users,posts:posts.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),transactions:transactions.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))),subscriptions,analytics,categories:settingsSnap.data()?.categories||[],audit:[...auditSnap.docs.map(d=>({id:d.id,...d.data(),createdAt:timestamp(d.data().createdAt),kind:'ADMIN'})),...moderationSnap.docs.map(d=>({id:d.id,...d.data(),createdAt:timestamp(d.data().createdAt),kind:'MODERATION'}))].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100),settings:{subscriptionPriceGHS:await getPrice()},generatedAt:now.toISOString()});
  }catch(e){console.error(e);res.status(503).json({error:'Admin dashboard data could not be loaded.'});}
});
app.get('/api/admin/overview',requireUser,requireOwner,async(req,res)=>{try{const [u,p,t]=await Promise.all([db().collection('users').count().get(),db().collection('posts').count().get(),db().collection('transactions').get()]);res.json({users:u.data().count,posts:p.data().count,transactions:t.size,revenueGHS:t.docs.filter(d=>d.data().status==='SUCCESS').reduce((s,d)=>s+(d.data().amountPesewas||0),0)/100});}catch{res.status(503).json({error:'Admin reporting unavailable.'});}});
app.post('/api/admin/posts/:id/moderate',requireUser,requireOwner,async(req,res)=>{
  const action=req.body?.action;if(!['APPROVE','REJECT'].includes(action))return res.status(400).json({error:'Invalid moderation action.'});
  try{const ref=db().collection('posts').doc(req.params.id),snap=await ref.get();if(!snap.exists)return res.sendStatus(404);const now=new Date();
    await ref.update({status:action==='APPROVE'?'PUBLISHED':'REJECTED',publishedAt:action==='APPROVE'?now:null,moderatedAt:now,moderatedBy:req.user.uid});
    await db().collection('moderationHistory').add({postId:req.params.id,action,actorUid:req.user.uid,createdAt:now});res.json({ok:true});
  }catch{res.status(503).json({error:'Moderation failed.'});}
});
app.delete('/api/admin/posts/:id',requireUser,requireOwner,async(req,res)=>{try{const ref=db().collection('posts').doc(req.params.id);if(!(await ref.get()).exists)return res.sendStatus(404);await ref.delete();await db().collection('moderationHistory').add({postId:req.params.id,action:'DELETED',actorUid:req.user.uid,createdAt:new Date()});res.json({ok:true});}catch{res.status(503).json({error:'Content deletion failed.'});}});
app.post('/api/admin/users/:uid/suspend',requireUser,requireOwner,async(req,res)=>{if(req.params.uid===req.user.uid)return res.status(400).json({error:'You cannot suspend the owner account.'});try{await admin.auth(firebaseAdmin()).updateUser(req.params.uid,{disabled:true});await db().collection('users').doc(req.params.uid).set({status:'SUSPENDED',updatedAt:new Date()},{merge:true});await db().collection('adminAudit').add({action:'USER_SUSPENDED',targetUid:req.params.uid,actorUid:req.user.uid,createdAt:new Date()});res.json({ok:true});}catch{res.status(503).json({error:'Could not suspend this user.'});}});
app.post('/api/admin/users/:uid/restore',requireUser,requireOwner,async(req,res)=>{try{await admin.auth(firebaseAdmin()).updateUser(req.params.uid,{disabled:false});await db().collection('users').doc(req.params.uid).set({status:'ACTIVE',updatedAt:new Date()},{merge:true});await db().collection('adminAudit').add({action:'USER_RESTORED',targetUid:req.params.uid,actorUid:req.user.uid,createdAt:new Date()});res.json({ok:true});}catch{res.status(503).json({error:'Could not restore this user.'});}});
app.put('/api/admin/settings',requireUser,requireOwner,async(req,res)=>{const parsed=z.object({subscriptionPriceGHS:z.number().min(1).max(10000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid subscription price.'});try{await appSettings().set({...parsed.data,updatedAt:new Date(),updatedBy:req.user.uid},{merge:true});res.json({ok:true,settings:parsed.data});}catch{res.status(503).json({error:'Could not update settings.'});}});
app.post('/api/admin/posts/:id/feature',requireUser,requireOwner,async(req,res)=>{try{const featured=Boolean(req.body?.featured);await db().collection('posts').doc(req.params.id).update({featured,featuredAt:featured?new Date():null});res.json({ok:true,featured});}catch{res.status(503).json({error:'Could not update featured status.'});}});
app.put('/api/admin/categories',requireUser,requireOwner,async(req,res)=>{
  const parsed=z.object({categories:z.array(z.string().trim().min(2).max(40)).max(50)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Provide up to 50 category names (2–40 characters each).'});
  const categories=[...new Set(parsed.data.categories.map(x=>x.trim()).filter(Boolean))];
  try{await appSettings().set({categories,updatedAt:new Date(),updatedBy:req.user.uid},{merge:true});await db().collection('adminAudit').add({action:'CATEGORIES_UPDATED',actorUid:req.user.uid,details:{count:categories.length},createdAt:new Date()});res.json({ok:true,categories});}
  catch{res.status(503).json({error:'Could not save categories.'});}
});
app.post('/api/admin/announcements',requireUser,requireOwner,async(req,res)=>{const parsed=z.object({title:z.string().trim().min(3).max(100),body:z.string().trim().min(5).max(1000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check announcement fields.'});try{const doc=await db().collection('announcements').add({...parsed.data,active:true,createdAt:new Date(),createdBy:req.user.uid});res.status(201).json({id:doc.id});}catch{res.status(503).json({error:'Could not publish announcement.'});}});
app.get('/api/admin/export/transactions.csv',requireUser,requireOwner,async(_req,res)=>{try{const snap=await db().collection('transactions').limit(2000).get();const rows=[['reference','uid','amountGHS','currency','status','createdAt'],...snap.docs.map(d=>{const x=d.data();return[d.id,x.uid,(Number(x.amountPesewas)||0)/100,x.currency,x.status,timestamp(x.createdAt)];})];const csv=rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="buildwitheli-transactions.csv"');res.send(csv);}catch{res.status(503).json({error:'Export failed.'});}});

// In production the same Node service can serve the built Vite frontend.
if(process.env.NODE_ENV==='production'){
  app.use(express.static(dist,{index:false,maxAge:'1h'}));
  const htmlEscape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
  app.get('/story/:slug',async(req,res,next)=>{
    try{
      const found=await db().collection('posts').where('slug','==',req.params.slug).limit(1).get();
      if(found.empty||found.docs[0].data().status!=='PUBLISHED')return res.status(404).send('Story not found');
      const post=cleanDoc(found.docs[0]),base=(process.env.APP_ORIGIN||'https://YOUR_PUBLIC_DOMAIN').split(',')[0].replace(/\/$/,'');
      const canonical=base+'/story/'+encodeURIComponent(post.slug||found.docs[0].id);
      const description=String(post.excerpt||post.body||'').replace(/\s+/g,' ').slice(0,250);
      const title=String(post.title||'BUILDWITHELI MEDIA')+' | BUILDWITHELI MEDIA';
      const image=post.coverImageUrl||base+'/og-default.png';
      const schema={ '@context':'https://schema.org', '@type':post.type==='VLOG'?'VideoObject':'Article', headline:post.title, description, image:[image], datePublished:post.publishedAt||post.createdAt, author:{'@type':'Person',name:post.authorName||'BUILDWITHELI Creator'}, publisher:{'@type':'Organization',name:'BUILDWITHELI MEDIA'}, mainEntityOfPage:canonical };
      if(post.type==='VLOG'&&post.videoUrl)schema.contentUrl=post.videoUrl;
      let html=await readFile(path.join(dist,'index.html'),'utf8');
      html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+htmlEscape(title)+'</title>');
      html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+htmlEscape(description)+'" />');
      html=html.replace(/<link rel="canonical"[^>]*>/i,'<link rel="canonical" href="'+htmlEscape(canonical)+'" />');
      html=html.replace(/<meta property="og:type"[^>]*>/i,'<meta property="og:type" content="'+(post.type==='VLOG'?'video.other':'article')+'" />');
      html=html.replace(/<meta property="og:title"[^>]*>/i,'<meta property="og:title" content="'+htmlEscape(title)+'" />');
      html=html.replace(/<meta property="og:description"[^>]*>/i,'<meta property="og:description" content="'+htmlEscape(description)+'" />');
      html=html.replace('</head>','<meta property="og:url" content="'+htmlEscape(canonical)+'" /><meta property="og:image" content="'+htmlEscape(image)+'" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="'+htmlEscape(title)+'" /><meta name="twitter:description" content="'+htmlEscape(description)+'" /><meta name="twitter:image" content="'+htmlEscape(image)+'" /><script type="application/ld+json">'+JSON.stringify(schema).replaceAll('<','\\u003c')+'</script></head>');
      res.type('html').send(html);
    }catch(e){console.error('Story SEO render failed',e);next(e);}
  });
  app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(dist,'index.html'));});
}
app.listen(port,()=>console.log('BUILDWITHELI MEDIA API listening on '+port));
