import { firebaseAdmin, admin, db } from './firebase.js';
export async function requireUser(req,res,next){
  try{
    const header=req.headers.authorization||'';
    if(!header.startsWith('Bearer '))return res.status(401).json({error:'Authentication required.'});
    const decoded=await admin.auth(firebaseAdmin()).verifyIdToken(header.slice(7),true);
    const profile=await db().collection('users').doc(decoded.uid).get();
    if(profile.exists&&profile.data().status==='SUSPENDED')return res.status(403).json({error:'This account has been suspended. Contact support.'});
    req.user=decoded;next();
  }catch{return res.status(401).json({error:'Invalid session or authentication service unavailable.'});}
}
export function requireOwner(req,res,next){
  if(!process.env.OWNER_FIREBASE_UID||req.user?.uid!==process.env.OWNER_FIREBASE_UID)return res.status(403).json({error:'Owner access required.'});
  next();
}
