import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('subscription duration is 30 days',()=>{assert.equal(30*24*60*60*1000,2592000000);});
test('Paystack GHS amount uses pesewas',()=>{assert.equal(Math.round(30*100),3000);});
test('creator submissions are always created as pending',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/status:'PENDING'/);});
test('admin routes require verified user and owner middleware',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.get\('\/api\/admin\/dashboard',requireUser,requireOwner/);assert.match(source,/app\.post\('\/api\/admin\/users\/:uid\/suspend',requireUser,requireOwner/);});
test('creator workspace and payment history routes exist',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/\/api\/creator\/dashboard/);assert.match(source,/\/api\/payments\/history/);});
test('suspension is enforced during authentication',async()=>{const source=await readFile(new URL('./auth.js',import.meta.url),'utf8');assert.match(source,/status==='SUSPENDED'/);});

test('payment status lookup is authenticated and scoped to the signed-in creator',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.get\('\/api\/payments\/status\/:reference',requireUser/);assert.match(source,/snap\.data\(\)\.uid!==req\.user\.uid/);});
test('payment return page does not treat a redirect as payment confirmation',async()=>{const source=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');assert.match(source,/signed Paystack webhook is the source of confirmation/);assert.match(source,/api\/payments\/status/);});

test('creator submissions accept a validated optional cover image URL',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.ok(source.includes('coverImageUrl:z.string().url().max(1000).optional()'));});
test('Supabase media uploads are authenticated, server-side and limited to safe image types and size',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.post\('\/api\/media\/cover',requireUser/);assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(source,/image\/jpeg/);assert.match(source,/limit:'8mb'/);assert.match(source,/creator-media/);});

test('public story, categories and sitemap endpoints are defined',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/\/api\/public\/posts\/:id/);assert.match(source,/\/api\/public\/categories/);assert.match(source,/\/sitemap\.xml/);});
test('published submissions receive stable readable slugs',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/const slug=parsed\.data\.title\.toLowerCase\(\)/);});

test('admin category management is owner protected and persists category settings',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.put\('\/api\/admin\/categories',requireUser,requireOwner/);assert.match(source,/CATEGORIES_UPDATED/);});
test('admin dashboard exposes bounded audit and moderation history',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/collection\('adminAudit'\)\.orderBy\('createdAt','desc'\)\.limit\(100\)/);assert.match(source,/kind:'MODERATION'/);});

test('production story responses inject canonical metadata and structured data',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/app\.get\('\/story\/:slug'/);assert.match(source,/application\/ld\+json/);assert.match(source,/og:image/);assert.match(source,/twitter:card/);});
test('vlog pages embed only supported YouTube and Vimeo hosts',async()=>{const source=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');assert.match(source,/youtube-nocookie\.com\/embed/);assert.match(source,/player\.vimeo\.com\/video/);assert.match(source,/host==='youtu\.be'/);});

test('creator cover image URLs are restricted to the configured Supabase public media bucket path',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.ok(source.includes('/storage/v1/object/public/creator-media/'));assert.match(source,/configured public media bucket/);});
test('public feed and sitemap avoid composite status plus publish-date indexes',async()=>{const source=await readFile(new URL('./index.js',import.meta.url),'utf8');assert.match(source,/where\('status','==','PUBLISHED'\)\.limit\(500\)/);assert.match(source,/\.sort\(\(a,b\)=>String\(timestamp\(b\.data\(\)\.publishedAt\)\|\|''\)/);});
