/* ГИА.мед v10.8 — обязательный вход и онлайн. */
const CACHE='gia-med-v10-8-auth-presence-20261118';
const CORE=['./','./index.html','./styles.css','./app.js','./config.js','./data.js','./media.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.all(CORE.map(async url=>{try{const response=await fetch(url,{cache:'reload'});if(response.ok)await cache.put(url,response)}catch{}}));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('gia-med-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()).then(async()=>{
    // One-time best-effort navigation on activation, so old guest tabs adopt the gate.
    // Do not await navigate(): its fetch may wait for activation to complete.
    const scope=new URL(self.registration.scope);
    for(const client of await self.clients.matchAll({type:'window'})){
      const u=new URL(client.url);
      if(u.origin===scope.origin&&(u.pathname===scope.pathname||u.pathname===scope.pathname+'index.html')&&u.searchParams.get('v')!=='108'){
        u.searchParams.set('v','108');client.navigate(u.href).catch(()=>{});
      }
    }
  }));
});
self.addEventListener('fetch',event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const freshFirst=request.mode==='navigate'||/\.(?:js|css|html|webmanifest)$/.test(url.pathname)||url.pathname.endsWith('/');
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);const cached=await cache.match(request,{ignoreSearch:true});
    if(!freshFirst&&cached)return cached;
    try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response}catch{return cached||Response.error()}
  })());
});
