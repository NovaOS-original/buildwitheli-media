import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db } from './firebase.js';
import { requireUser, requireOwner } from './auth.js';

const app=express();
const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(here,'../dist');
const port=Number(process.env.PORT||4000);
app.use(helmet());
app.use(cors({origin:(process.env.APP_ORIGIN||'http://localhost:5173').split(','),credentials:false}));
app.use('/api/payments/webhook',express.raw({type:'application/json'}));
app.use(express.json({limit:'1mb'}));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:true,legacyHeaders:false}));
const price=()=>Number(process.env.SUBSCRIPTION_PRICE_GHS||30);

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'buildwitheli-media-api'}));
app.get('/api/public/posts',async(_req,res)=>{
  try{const snap=await db().collection('posts').where('status','==','PUBLISHED').orderBy('publishedAt','desc').limit(30).get();
    res.json({posts:snap.docs.map(d=>({id:d.id,...d.data(),publishedAt:d.data().publishedAt?.toDate?.()?.toISOString()||null}))});
  }catch(e){console.error(e);res.status(503).json({error:'Content feed is not configured.'});}
});
app.get('/api/me',requireUser,async(req,res)=>{
  try{const snap=await db().collection('users').doc(req.user.uid).get();res.json({profile:snap.exists?snap.data():null,emailVerified:req.user.email_verified});}
  catch{res.status(503).json({error:'Profile service unavailable.'});}
});
app.post('/api/payments/initialize',requireUser,async(req,res)=>{
  if(!req.user.email_verified)return res.status(403).json({error:'Verify your email before subscribing.'});
  if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:'Paystack is not configured.'});
  const reference='bwm_'+crypto.randomUUID().replaceAll('-','');
  try{
    const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:req.user.email,amount:Math.round(price()*100),currency:'GHS',reference,callback_url:(process.env.APP_ORIGIN||'http://localhost:5173')+'/payment/return',metadata:{uid:req.user.uid,product:'BUILDWITHELI MEDIA monthly membership'}})});
    const data=await response.json();
    if(!response.ok||!data.status) return res.status(502).json({error:'Payment provider could not initialize checkout.'});
    await db().collection('transactions').doc(reference).create({uid:req.user.uid,reference,amountPesewas:Math.round(price()*100),currency:'GHS',status:'INITIALIZED',createdAt:new Date(),provider:'paystack'});
    res.json({authorization_url:data.data.authorization_url,reference});
  }catch(e){console.error(e);res.status(502).json({error:'Unable to start checkout.'});}
});
app.post('/api/payments/webhook',async(req,res)=>{
  const signature=req.headers['x-paystack-signature'];
  if(!process.env.PAYSTACK_SECRET_KEY||!signature)return res.sendStatus(401);
  const expected=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
  const a=Buffer.from(String(signature)),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
  const event=JSON.parse(req.body.toString('utf8'));
  if(event.event!=='charge.success')return res.sendStatus(200);
  const tx=event.data,reference=String(tx.reference||'');
  try{
    const verify=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+process.env.PAYSTACK_SECRET_KEY}});
    const result=await verify.json();
    if(!verify.ok||!result.status||result.data.status!=='success')return res.sendStatus(200);
    const verified=result.data;
    const ref=db().collection('transactions').doc(reference);
    await db().runTransaction(async t=>{
      const snap=await t.get(ref);if(!snap.exists)return;
      const saved=snap.data();
      if(saved.status==='SUCCESS')return;
      if(saved.uid!==String(verified.metadata?.uid||'')||saved.amountPesewas!==verified.amount||saved.currency!==verified.currency)return;
      const userRef=db().collection('subscriptions').doc(saved.uid);
      const userSnap=await t.get(userRef);
      const now=new Date();
      const currentEnd=userSnap.exists?userSnap.data().expiresAt?.toDate?.():null;
      const start=currentEnd&&currentEnd>now?currentEnd:now;
      const expiresAt=new Date(start.getTime()+30*24*60*60*1000);
      t.set(userRef,{uid:saved.uid,status:'ACTIVE',startedAt:now,expiresAt,updatedAt:now},{merge:true});
      t.update(ref,{status:'SUCCESS',verifiedAt:now,providerTransactionId:String(verified.id)});
    });
    res.sendStatus(200);
  }catch(e){console.error(e);res.sendStatus(500);}
});
app.post('/api/creator/posts',requireUser,async(req,res)=>{
  if(!req.user.email_verified)return res.status(403).json({error:'Verify your email first.'});
  const schema=z.object({title:z.string().trim().min(5).max(120),excerpt:z.string().trim().max(280).optional(),body:z.string().trim().min(50).max(50000),category:z.string().trim().min(2).max(40),type:z.enum(['ARTICLE','VLOG']),videoUrl:z.string().url().optional()});
  const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Please check your submission fields.'});
  if(parsed.data.type==='VLOG'&&!parsed.data.videoUrl)return res.status(400).json({error:'A vlog needs an external video URL.'});
  try{
    const sub=await db().collection('subscriptions').doc(req.user.uid).get();
    if(!sub.exists||sub.data().status!=='ACTIVE'||!sub.data().expiresAt?.toDate?.()||sub.data().expiresAt.toDate()<=new Date())return res.status(402).json({error:'An active membership is required to submit content.'});
    const doc=await db().collection('posts').add({...parsed.data,uid:req.user.uid,status:'PENDING',createdAt:new Date(),publishedAt:null});
    await db().collection('moderationHistory').add({postId:doc.id,action:'SUBMITTED',actorUid:req.user.uid,createdAt:new Date()});
    res.status(201).json({id:doc.id,status:'PENDING'});
  }catch(e){console.error(e);res.status(503).json({error:'Could not save submission.'});}
});
app.get('/api/admin/overview',requireUser,requireOwner,async(_req,res)=>{
  try{const [users,posts,txs]=await Promise.all([db().collection('users').count().get(),db().collection('posts').count().get(),db().collection('transactions').get()]);
    const revenue=txs.docs.filter(d=>d.data().status==='SUCCESS').reduce((s,d)=>s+(d.data().amountPesewas||0),0);
    res.json({users:users.data().count,posts:posts.data().count,transactions:txs.size,revenueGHS:revenue/100});
  }catch{res.status(503).json({error:'Admin reporting unavailable.'});}
});
app.post('/api/admin/posts/:id/moderate',requireUser,requireOwner,async(req,res)=>{
  const action=req.body?.action;if(!['APPROVE','REJECT'].includes(action))return res.status(400).json({error:'Invalid moderation action.'});
  try{const ref=db().collection('posts').doc(req.params.id);const snap=await ref.get();if(!snap.exists)return res.sendStatus(404);
    await ref.update({status:action==='APPROVE'?'PUBLISHED':'REJECTED',publishedAt:action==='APPROVE'?new Date():null,moderatedAt:new Date(),moderatedBy:req.user.uid});
    await db().collection('moderationHistory').add({postId:req.params.id,action,actorUid:req.user.uid,createdAt:new Date()});res.json({ok:true});
  }catch{res.status(503).json({error:'Moderation failed.'});}
});
// In production the same Node service can serve the built Vite frontend.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (req,res,next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist,'index.html'));
  });
}
app.listen(port,()=>console.log('BUILDWITHELI MEDIA API listening on '+port));
