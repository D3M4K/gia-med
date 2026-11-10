const CACHE='gia-med-v6-login-reset-fix-v1',CORE=['./', './index.html', './styles.css', './app.js', './config.js', './data.js', './media.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './touch-icon.png', './source.pdf', './media/case-001-1.webp', './media/case-002-1.webp', './media/case-003-1.webp', './media/case-004-1.webp', './media/case-005-1.webp', './media/case-009-1.webp', './media/case-010-1.webp', './media/case-011-1.webp', './media/case-024-1.webp', './media/case-028-1.webp', './media/case-028-2.webp', './media/case-032-1.webp', './media/case-050-1.webp', './media/case-051-1.webp', './media/case-052-1.webp', './media/case-052-2.webp', './media/case-056-1.webp', './media/case-056-2.webp', './media/case-058-1.webp', './media/case-058-2.webp', './media/case-059-1.webp', './media/case-102-1.webp', './media/case-102-2.webp', './media/case-103-1.webp', './media/case-103-2.webp', './media/case-119-1.webp', './media/case-120-1.webp', './media/case-172-1.webp', './media/case-173-1.webp', './media/case-174-1.webp', './media/case-175-1.webp', './media/case-176-1.webp', './media/case-177-1.webp', './media/case-178-1.webp', './media/case-179-1.webp', './media/case-180-1.webp'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 const freshFirst=e.request.mode==='navigate'||/\.(js|css|html|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');
 e.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(e.request);
  if(!freshFirst&&cached)return cached;
  try{const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response}
  catch{return cached||Response.error()}
 }));
});
