import { mkdir, rm, writeFile } from 'node:fs/promises';

const site = 'https://novaos-original.github.io/buildwitheli-media/';
const supabaseUrl = 'https://xtchvetdluriblzyknhp.supabase.co';
const publishableKey = 'sb_publishable_x09bPZTKwfqbMeYJh7llWQ_5IWavdcK';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stripMarkup = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const slugSafe = value => /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$/i.test(value) ? value : null;

const response = await fetch(
  supabaseUrl + '/rest/v1/bwm_posts?select=slug,title,excerpt,body,category,type,cover_image_url,published_at,status&status=eq.PUBLISHED&order=published_at.desc',
  { headers: { apikey: publishableKey, Authorization: 'Bearer ' + publishableKey } }
);
if (!response.ok) throw new Error('Could not fetch published stories for sitemap: HTTP ' + response.status);
const posts = (await response.json()).filter(post => slugSafe(post.slug));

await rm('public/story', { recursive: true, force: true });
const urls = [site];
for (const post of posts) {
  const slug = post.slug;
  const url = site + 'story/' + encodeURIComponent(slug);
  const title = escapeHtml(post.title || 'BUILDWITHELI MEDIA story');
  const description = escapeHtml(stripMarkup(post.excerpt || post.body).slice(0, 300) || 'Read this story on BUILDWITHELI MEDIA.');
  const body = escapeHtml(post.body || '').replace(/\r?\n/g, '<br>');
  const image = post.cover_image_url ? '<meta property="og:image" content="' + escapeHtml(post.cover_image_url) + '">' : '';
  const date = post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString();
  const article = {
    '@context': 'https://schema.org',
    '@type': post.type === 'VLOG' ? 'VideoObject' : 'Article',
    headline: post.title || 'BUILDWITHELI MEDIA story',
    description: stripMarkup(post.excerpt || post.body).slice(0, 300),
    datePublished: date,
    mainEntityOfPage: url,
    publisher: { '@type': 'Organization', name: 'BUILDWITHELI MEDIA', url: site },
    ...(post.cover_image_url ? { image: [post.cover_image_url] } : {})
  };
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | BUILDWITHELI MEDIA</title><meta name="description" content="${description}">
<link rel="canonical" href="${url}"><meta name="robots" content="index,follow">
<meta property="og:type" content="article"><meta property="og:site_name" content="BUILDWITHELI MEDIA"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}">${image}
<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${JSON.stringify(article).replace(/</g,'\\u003c')}</script>
<style>body{margin:0;background:#080b12;color:#f4f5f2;font:17px/1.85 system-ui,sans-serif}.wrap{max-width:800px;margin:0 auto;padding:36px 22px 80px}.brand{color:#c6f36b;font-weight:800;letter-spacing:.12em;text-decoration:none;font-size:13px}.tag{margin-top:55px;color:#c6f36b;font-size:11px;letter-spacing:.16em}h1{font-size:clamp(36px,7vw,64px);line-height:1.08;letter-spacing:-.05em}p{color:#d4dbe1}.excerpt{color:#aab5bf;font-size:19px}.cover{width:100%;max-height:460px;object-fit:cover;border-radius:12px}.back{display:inline-block;margin-top:38px;color:#c6f36b}</style></head>
<body><main class="wrap"><a class="brand" href="${site}">BUILDWITHELI MEDIA</a><div class="tag">${escapeHtml(post.type || 'ARTICLE')} · ${escapeHtml(post.category || 'STORIES')}</div><h1>${title}</h1><p class="excerpt">${description}</p>${post.cover_image_url ? '<img class="cover" src="' + escapeHtml(post.cover_image_url) + '" alt="' + title + '" loading="eager">' : ''}<article><p>${body}</p></article><a class="back" href="${site}">← Explore more stories</a></main></body></html>`;
  const dir = 'public/story/' + slug;
  await mkdir(dir, { recursive: true });
  await writeFile(dir + '/index.html', html);
  urls.push(url);
}
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(url => '  <url><loc>' + escapeHtml(url) + '</loc></url>').join('\n') +
  '\n</urlset>\n';
await writeFile('public/sitemap.xml', xml);
console.log('Generated sitemap with ' + urls.length + ' URLs and ' + posts.length + ' published story pages.');
