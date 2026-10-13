/* PULSO AUDIO STREAM v1
 * Reconstitui áudios MP3 enviados em partes no Supabase como mídia com suporte
 * a HTTP Range. O navegador pode pedir qualquer trecho por byte, inclusive ao
 * avançar a minutagem, sem esperar o download do MP3 completo.
 * Nunca guarda os áudios permanentemente no dispositivo.
 */
const AUDIO_ROUTE = new URL('./pulso-audio-stream',self.registration.scope).pathname;
const PIECE_BYTES=8*1024*1024;
const MAX_BYTES=400*1024*1024;
const RESPONSE_BYTES=4*1024*1024;
const recent=new Map();
const MAX_RECENT=3;
self.addEventListener('install',evt=>evt.waitUntil(self.skipWaiting()));
self.addEventListener('activate',evt=>evt.waitUntil(self.clients.claim()));
function validManifest(url){
  try{
    const u=new URL(url);
    return u.protocol==='https:' &&
      /^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname) &&
      /^\/storage\/v1\/object\/public\/pulso-audio\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/manifest\.json$/i.test(u.pathname) && !u.username&&!u.password&&!u.search&&!u.hash;
  }catch{return false;}
}
function manifestOK(m){
  return m?.version===1 && m?.codec==='audio/mpeg' &&
    Number.isInteger(m.bytes)&&m.bytes>0&&m.bytes<=MAX_BYTES &&
    Number.isInteger(m.parts)&&m.parts>=2&&m.parts<=50 &&
    m.chunkBytes===PIECE_BYTES && m.parts===Math.ceil(m.bytes/PIECE_BYTES);
}
async function getPiece(url){
  if(recent.has(url)){
    const bytes=recent.get(url);recent.delete(url);recent.set(url,bytes);return bytes;
  }
  const response=await fetch(url,{mode:'cors',credentials:'omit'});
  if(!response.ok)throw new Error('Trecho de áudio indisponível');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length>PIECE_BYTES)throw new Error('Trecho fora do limite');
  recent.set(url,bytes);
  while(recent.size>MAX_RECENT)recent.delete(recent.keys().next().value);
  return bytes;
}
async function handleAudio(request){
  const u=new URL(request.url);const manifestUrl=u.searchParams.get('src');
  if(!validManifest(manifestUrl))return new Response('Fonte inválida',{status:400});
  const manifestResponse=await fetch(manifestUrl,{mode:'cors',credentials:'omit',cache:'no-store'});
  if(!manifestResponse.ok)throw new Error('Manifesto indisponível');
  const manifest=await manifestResponse.json();
  if(!manifestOK(manifest))throw new Error('Manifesto inválido');
  const size=manifest.bytes,rangeHeader=request.headers.get('range');
  let first=0,last=size-1,status=200;
  if(rangeHeader){
    const range=/^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
    if(!range)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
    first=Number(range[1]);last=range[2]?Number(range[2]):size-1;
    if(!Number.isSafeInteger(first)||first>=size||last<first||!Number.isSafeInteger(last))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
    last=Math.min(last,first+RESPONSE_BYTES-1,size-1);status=206;
  }
  const base=manifestUrl.slice(0,-'manifest.json'.length);
  const end=last;
  const body=new ReadableStream({
    async start(controller){
      try{
        for(let pos=first;pos<=end;){
          const index=Math.floor(pos/PIECE_BYTES);
          const from=pos-index*PIECE_BYTES;
          const partUrl=`${base}${String(index).padStart(4,'0')}.mp3`;
          const bytes=await getPiece(partUrl);
          const stop=Math.min(bytes.length,end-index*PIECE_BYTES+1);
          if(stop<=from)throw new Error('Parte de MP3 incompleta');
          controller.enqueue(bytes.subarray(from,stop));
          pos+=stop-from;
        }
        controller.close();
      }catch(err){controller.error(err);}
    }
  });
  const headers={
    'Content-Type':'audio/mpeg',
    'Accept-Ranges':'bytes',
    'Content-Length':String(end-first+1),
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'
  };
  if(status===206)headers['Content-Range']=`bytes ${first}-${end}/${size}`;
  return new Response(body,{status,headers});
}
self.addEventListener('fetch',evt=>{
  const u=new URL(evt.request.url);
  if(u.origin!==self.location.origin||u.pathname!==AUDIO_ROUTE)return;
  if(evt.request.method!=='GET')return;
  evt.respondWith(handleAudio(evt.request).catch(err=>{
    console.warn('PULSO audio stream:',err);
    return new Response('Falha ao carregar o áudio',{status:502,headers:{'Content-Type':'text/plain'}});
  }));
});


/* PWA shell: guarda a interface para abrir sem conexão, não baixa músicas/vídeos. */
const PWA_CACHE='pulso-pwa-v56-resume';
const PWA_FILES=['./','./index.html','./styles.css','./pulso-visual-refresh.css','./script.js','./pulso5.js','./pulso51.js','./pulso52.js','./pulso54.js','./pulso-capsule.js','./pulso-capsule-export.js','./pulso-insights.js','./pulso-media-actions.js','./pulso-share.js','./pulso-video.js','./pulso5.css','./pulso51.css','./pulso52.css','./pulso54.css','./desert-artcar.webp','./burningman-real.webp','./background.js','./notifications.js','./social.js','./identify.js','./config.js','./manifest.webmanifest','./favicon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(PWA_CACHE).then(cache=>cache.addAll(PWA_FILES)).catch(()=>{}));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('pulso-pwa-')&&n!==PWA_CACHE).map(n=>caches.delete(n)))));
});
self.addEventListener('fetch',event=>{
  const request=event.request,u=new URL(request.url);
  if(request.method!=='GET'||u.origin!==self.location.origin||u.pathname===AUDIO_ROUTE)return;
  const asset=/\.(css|js|svg|png|webp|webmanifest|html)$/.test(u.pathname)||u.pathname==='/'||u.pathname==='/index.html';
  if(!asset)return;
  event.respondWith(fetch(request).then(response=>{
    if(response.ok && response.type==='basic'){
      const copy=response.clone();event.waitUntil(caches.open(PWA_CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));
    }
    return response;
  }).catch(()=>caches.match(request,{ignoreSearch:true}).then(r=>r||new Response('Sem conexão. Conecte-se para ouvir músicas.',{status:503}))));
});

/* Alertas push PULSO: só exibir quando o usuário autorizou o app. */
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  const title=String(data.title||'Novo DJ set no PULSO').slice(0,120);
  const body=String(data.body||'Uma nova frequência está no ar.').slice(0,220);
  const safeId=/^[0-9a-f-]{36}$/i.test(data.post_id||'')?data.post_id:'';
  event.waitUntil(self.registration.showNotification(title,{body,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:safeId||'pulso-set',renotify:false,data:{url:safeId?'./?track='+encodeURIComponent(safeId):'./'}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const same=windows.find(c=>new URL(c.url).origin===self.location.origin);
    if(same){await same.focus();if('navigate' in same)await same.navigate(target);return;}
    await clients.openWindow(target);
  })());
});
