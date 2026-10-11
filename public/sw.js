const CACHE='avgust-care-shell-v7';
const SHELL=['/avgust-logo.svg','/favicon.svg','/manrope.woff2','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))).then(()=>caches.open(CACHE).then(cache=>cache.addAll(SHELL))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin||new URL(request.url).pathname.startsWith('/api/'))return;
 // Always network-first for HTML and JS/CSS so portal deploys show up immediately.
 if(request.mode==='navigate'||request.destination==='script'||request.destination==='style'||request.destination==='document'){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(async()=>await caches.match(request)||await caches.match('/')||Response.error()));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&['image','font'].includes(request.destination)){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));
});
