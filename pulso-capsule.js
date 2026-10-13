/* PULSO 5.15 — Capsula Sonora: estatisticas locais de escuta e faixas identificadas. */
(()=>{
 'use strict';
 const KEY='pulso_capsula_v1',DAY_MS=86400000,MAX_AGE_DAYS=400;
 const $=id=>document.getElementById(id);
 let data={version:1,listens:[],tracks:[]},period='week';
 let cloudRows=[],capsuleClient=null,capsuleUser=null,cloudReady=false,cloudTimer=null,cloudBusy=false;
 const DEVICE_KEY='pulso_capsule_device_v1';
 function deviceId(){
   try{let id=localStorage.getItem(DEVICE_KEY);if(!id){id='dev_'+(crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));localStorage.setItem(DEVICE_KEY,id);}return id;}catch{return 'dev_'+location.hostname+'_'+navigator.userAgent.slice(0,35);}
 }
 const thisDevice=deviceId();
 function initCloud(){
   const cfg=window.PULSO_CONFIG||{};
   if(!window.supabase?.createClient||!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
   try{
     capsuleClient=window.supabase.createClient(cfg.supabaseUrl.trim().replace(/\/$/,''),cfg.supabaseAnonKey.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
     capsuleClient.auth.getUser().then(({data,error})=>{capsuleUser=error?null:data?.user||null;syncCloud(true);});
     capsuleClient.auth.onAuthStateChange((_event,session)=>{capsuleUser=session?.user||null;syncCloud(true);});
   }catch(err){console.warn('PULSO cápsula: sincronização indisponível',err);}
 }
 function mergedData(){
   // O histórico remoto é a referência para todos os dispositivos; mantém também
   // eventos locais que ainda não conseguiram sincronizar com a conta.
   const cloudListenKeys=new Set(cloudRows.filter(r=>r.event_type==='listen').map(r=>String(r.device_id)+'|'+String(r.day).slice(0,10)+'|'+String(r.item_key)));
   const cloudTrackKeys=new Set(cloudRows.filter(r=>r.event_type!=='listen').map(r=>String(r.device_id)+'|'+String(r.day).slice(0,10)+'|'+String(r.item_key)));
   const listens=data.listens
     .filter(x=>!cloudListenKeys.has(thisDevice+'|'+String(x.day).slice(0,10)+'|'+String(x.id)))
     .map(x=>({...x,_device:thisDevice}));
   const tracks=data.tracks
     .filter(x=>!cloudTrackKeys.has(thisDevice+'|'+String(x.day).slice(0,10)+'|'+[x.artist,x.title,x.source].join('|').toLowerCase().slice(0,240)))
     .map(x=>({...x,_device:thisDevice}));
   for(const r of cloudRows){
     if(r.event_type==='listen')listens.push({day:String(r.day).slice(0,10),id:r.item_key,artist:r.artist,title:r.title,seconds:Number(r.seconds)||0,cover:r.cover||'',_device:r.device_id});
     else tracks.push({day:String(r.day).slice(0,10),title:r.title,artist:r.artist,source:r.source==='identified'?'identified':'manual',count:Number(r.count)||1,setId:'',_device:r.device_id});
   }
   return {listens,tracks};
 }
 function scheduleCloudSync(){
   if(!capsuleUser||!capsuleClient)return;
   if(cloudTimer)clearTimeout(cloudTimer);
   cloudTimer=setTimeout(()=>syncCloud(true),1800);
 }
 async function syncCloud(pushLocal=false){
   if(!capsuleClient||!capsuleUser){cloudRows=[];cloudReady=false;draw();return;}
   if(cloudBusy)return;
   cloudBusy=true;
   try{
     if(pushLocal){
       const rows=[
         ...data.listens.map(r=>({user_id:capsuleUser.id,device_id:thisDevice,day:r.day,event_type:'listen',item_key:String(r.id),artist:r.artist,title:r.title||r.artist,seconds:Number(r.seconds)||0,count:0,source:'listen',cover:r.cover||null,updated_at:new Date().toISOString()})),
         ...data.tracks.map(r=>({user_id:capsuleUser.id,device_id:thisDevice,day:r.day,event_type:'track',item_key:[r.artist,r.title,r.source].join('|').toLowerCase().slice(0,240),artist:r.artist,title:r.title,seconds:0,count:Number(r.count)||1,source:r.source==='identified'?'identified':'manual',cover:null,updated_at:new Date().toISOString()}))
       ];
       if(rows.length){
         const {error}=await capsuleClient.from('pulso_capsule_events').upsert(rows,{onConflict:'user_id,device_id,day,event_type,item_key'});
         if(error)throw error;
       }
     }
     const {data:rows,error}=await capsuleClient.from('pulso_capsule_events').select('device_id,day,event_type,item_key,artist,title,seconds,count,source,cover,updated_at').eq('user_id',capsuleUser.id).order('day',{ascending:false}).limit(10000);
     if(error)throw error;
     cloudRows=rows||[];cloudReady=true;draw();
   }catch(err){console.warn('PULSO cápsula: falha ao sincronizar histórico',err);setCloudStatus('Não foi possível sincronizar agora. Seu histórico continua salvo neste aparelho.');}
   finally{cloudBusy=false;}
 }
 function setCloudStatus(message){
   const el=$('pulsoCapsuleStatus');if(el)el.textContent=message;
 }
 let ytPlayer=null,ytSet=null,ytPlaying=false,ytLastTime=null,ytTick=null;
 let nativeAudio=null,nativeSet=null,nativeLastTime=null,nativeTick=null;
 const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const norm=s=>String(s||'').trim().replace(/\s+/g,' ').slice(0,110);
 const dayString=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 function startDay(p){
   const d=new Date();d.setHours(0,0,0,0);
   if(p==='month')d.setDate(1);
   else d.setDate(d.getDate()-((d.getDay()+6)%7));
   return d;
 }
 function clean(){
   const limit=new Date(Date.now()-MAX_AGE_DAYS*DAY_MS).toISOString().slice(0,10);
   data.listens=data.listens.filter(r=>r&&r.day>=limit&&r.artist&&Number.isFinite(Number(r.seconds))).slice(-2000);
   data.tracks=data.tracks.filter(r=>r&&r.day>=limit&&r.title&&r.artist).slice(-1000);
 }
 function load(){
   try{
     const raw=JSON.parse(localStorage.getItem(KEY)||'null');
     if(raw?.version===1&&Array.isArray(raw.listens)&&Array.isArray(raw.tracks))data=raw;
   }catch{}
   clean();
 }
 function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
 const dateLabel=p=>{
   const d=new Date();
   return p==='all'?'Todo o histórico':p==='month'?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(d):
     'Semana de '+new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(startDay('week'));
 };
 function addSeconds(set,seconds){
   if(!set?.artist||!set?.id)return;
   const delta=Number(seconds);if(!Number.isFinite(delta)||delta<=0||delta>12)return;
   const day=dayString(new Date()),id=String(set.id);
   let r=data.listens.find(x=>x.day===day&&x.id===id);
   if(!r){r={day,id,artist:norm(set.artist),title:norm(set.title)||norm(set.artist),seconds:0,cover:set.cover||''};data.listens.push(r);}
   r.seconds+=delta;
   save();
   scheduleCloudSync();
   draw();
 }
 function observed(youtubePlayer,set){
   ytPlayer=youtubePlayer||null;
   ytSet=set||null;
   ytPlaying=false;
   ytLastTime=null;
   if(ytTick)clearInterval(ytTick);
   if(!ytPlayer||!ytSet)return;
   ytTick=setInterval(()=>{
     if(!ytPlayer||!ytSet){ytLastTime=null;return;}
     try{
       const state=ytPlayer.getPlayerState?.(),muted=ytPlayer.isMuted?.();
       const t=Number(ytPlayer.getCurrentTime?.());
       if(state!==1||muted!==false||!Number.isFinite(t)){ytLastTime=null;return;}
       if(ytLastTime!==null){
         const d=t-ytLastTime;
         if(d>0&&d<=45)addSeconds(ytSet,Math.min(d,30));
       }
       ytLastTime=t;
     }catch{ytLastTime=null}
   },4000);
 }
 function ytState(state){
   ytPlaying=Number(state)===1;
   if(!ytPlaying)ytLastTime=null;
 }
 function detachYouTube(){ytPlayer=null;ytSet=null;ytPlaying=false;ytLastTime=null;if(ytTick)clearInterval(ytTick);ytTick=null;}
 function observeNative(post,audio){
   if(nativeTick)clearInterval(nativeTick);
   nativeAudio=audio;nativeSet=post;nativeLastTime=null;
   if(!audio||!post?.id)return;
   nativeTick=setInterval(()=>{
     if(!nativeAudio||!nativeSet||nativeAudio.paused||nativeAudio.muted||nativeAudio.volume===0){nativeLastTime=null;return;}
     const t=Number(nativeAudio.currentTime);
     if(!Number.isFinite(t)){nativeLastTime=null;return}
     if(nativeLastTime!==null){const d=t-nativeLastTime;if(d>0&&d<=45)addSeconds(nativeSet,Math.min(d,30))}
     nativeLastTime=t;
   },4000);
 }
 function recordTrack({title,artist,source='manual',setId=''}){
   const cleaned={title:norm(title),artist:norm(artist),source:source==='identified'?'identified':'manual',setId:String(setId||''),day:dayString(new Date())};
   if(!cleaned.title||!cleaned.artist)return false;
   const todaySame=data.tracks.find(x=>x.day===cleaned.day&&x.title.toLowerCase()===cleaned.title.toLowerCase()&&x.artist.toLowerCase()===cleaned.artist.toLowerCase()&&x.source===cleaned.source);
   if(todaySame)todaySame.count=Math.min(999,(Number(todaySame.count)||1)+1);
   else data.tracks.push({...cleaned,count:1});
   save();scheduleCloudSync();draw();
   return true;
 }
 const rangeRows=()=>{const cutoff=period==='all'?'0000-01-01':dayString(startDay(period));return mergedData().listens.filter(x=>x.day>=cutoff);};
 const rangeTracks=()=>{const cutoff=period==='all'?'0000-01-01':dayString(startDay(period));return mergedData().tracks.filter(x=>x.day>=cutoff);};
 const collect=(rows,key)=>{
   const m=new Map();
   for(const r of rows){const name=r[key];if(!name)continue;const a=m.get(name)||{name,seconds:0,cover:r.cover||'',times:0};a.seconds+=Number(r.seconds)||0;a.times++;m.set(name,a);}
   return [...m.values()].sort((a,b)=>b.seconds-a.seconds);
 };
 const minutes=seconds=>Math.floor((Number(seconds)||0)/60);
 const dur=secs=>{
   const n=Math.floor(secs);
   if(n<60)return n+' s';
   const h=Math.floor(n/3600),m=Math.floor(n%3600/60);
   return h?h+'h '+m+'min':m+' min';
 };
 function safeImg(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:''}catch{return''}}
 function draw(){
   const root=$('pulsoCapsule');if(!root)return;
   const rows=rangeRows(),total=rows.reduce((a,b)=>a+Number(b.seconds||0),0);
   const artists=collect(rows,'artist').slice(0,5),sets=collect(rows,'title').slice(0,5);
   const trackMap=new Map();
   for(const t of rangeTracks()){const key=(t.artist+'|'+t.title).toLowerCase(),v=trackMap.get(key)||{artist:t.artist,title:t.title,count:0,confirmed:false,manual:false};v.count+=Number(t.count)||1;v.confirmed||=t.source==='identified';v.manual||=t.source==='manual';trackMap.set(key,v);}
   const tracks=[...trackMap.values()].sort((a,b)=>b.count-a.count).slice(0,5);
   $('pulsoCapsuleWhen').textContent=dateLabel(period);
   $('pulsoCapsuleMinutes').textContent=new Intl.NumberFormat('pt-BR').format(minutes(total));
   $('pulsoCapsuleSetsCount').textContent=String(rows.length?new Set(rows.map(r=>r.id)).size:0);
   document.querySelectorAll('[data-capsule-period]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.capsulePeriod===period)));
   const empty=what=>'<div class="capsule-empty">'+what+'</div>';
   $('pulsoCapsuleArtists').innerHTML=artists.length?artists.map((a,i)=>'<div class="capsule-list-item"><span class="capsule-number">'+(i+1)+'</span><span class="capsule-list-name">'+escape(a.name)+'</span><span class="capsule-duration">'+dur(a.seconds)+'</span></div>').join(''):empty('Seus DJs mais ouvidos aparecerão aqui assim que você ouvir um set com som.');
   $('pulsoCapsuleSets').innerHTML=sets.length?sets.map((a,i)=>'<div class="capsule-list-item"><span class="capsule-number">'+(i+1)+'</span><span class="capsule-list-name">'+escape(a.name)+'</span><span class="capsule-duration">'+dur(a.seconds)+'</span></div>').join(''):empty('Os sets mais reproduzidos aparecerão aqui.');
   $('pulsoCapsuleTracks').innerHTML=tracks.length?tracks.map((a,i)=>'<div class="capsule-list-item"><span class="capsule-number">'+(i+1)+'</span><span class="capsule-list-name">'+escape(a.title)+'<small>'+escape(a.artist)+' · '+(a.confirmed?'Identificada':'Registrada manualmente')+'</small></span><span class="capsule-duration">'+a.count+'×</span></div>').join(''):empty('Ainda não há faixas identificadas. O nome do DJ set não é considerado uma música.');
   const scope=$('pulsoCapsuleStatus');
   if(scope)scope.textContent=cloudReady?'Histórico sincronizado da sua conta, reunindo os dispositivos que enviaram dados ao PULSO.':'Histórico local deste aparelho. Entre na conta e aguarde a sincronização para reunir dados de outros dispositivos.';
   const personal=document.querySelector('.capsule-personal');if(personal)personal.textContent=cloudReady?'CONTA SINCRONIZADA · DISPOSITIVOS CONECTADOS':'DADOS LOCAIS · SINCRONIZAÇÃO PENDENTE';
   return {artists,sets,tracks,total,setsCount:new Set(rows.map(r=>r.id)).size};
 }
 function saveImage(){
   const summary=draw();if(!summary)return;
   const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1650;
   const g=canvas.getContext('2d');if(!g)return;
   const bg=g.createLinearGradient(0,0,1080,1410);bg.addColorStop(0,'#182b21');bg.addColorStop(1,'#0a100e');g.fillStyle=bg;g.fillRect(0,0,1080,1650);
   const txt=(t,x,y,size=30,color='#e8f4dc',weight=600)=>{g.fillStyle=color;g.font=weight+' '+size+'px Arial,sans-serif';g.fillText(String(t),x,y)};
   g.fillStyle='#d1ff6b';g.fillRect(66,72,7,64);
   txt('PULSO RADIO × LØSI',93,111,31,'#d1ff6b',800);
   txt('MINHA CÁPSULA SONORA',66,205,51,'#fff',800);
   txt(dateLabel(period).toUpperCase(),66,253,26,'#aac49f',700);
   txt('TEMPO REPRODUZIDO COM SOM',66,350,28,'#d2ff90',800);
   txt(new Intl.NumberFormat('pt-BR').format(minutes(summary.total))+' MINUTOS',66,435,63,'#84e9a8',800);
   const cols=[['ARTISTAS MAIS OUVIDOS',summary.artists],['SETS MAIS OUVIDOS',summary.sets],['FAIXAS REGISTRADAS',summary.tracks]];
   let y=542;
   for(const [head,list] of cols){
     txt(head,66,y,28,'#e4ffbe',800);y+=50;
     if(!list.length){txt(period==='all'?'Sem dados no histórico disponível':'Sem dados nesta '+(period==='week'?'semana':'mês'),73,y,23,'#8da892',500);y+=43;}
     else for(let i=0;i<Math.min(list.length,5);i++){let item=list[i];let label=item.name||item.title||'';if(label.length>40)label=label.slice(0,37)+'…';txt((i+1)+'. '+label,77,y,25,'#fff',600);y+=39;}
     y+=36;
   }
   txt('Dados locais do PULSO · Faixas dos sets não são inferidas automaticamente',66,1545,20,'#8ca48c',500);
   txt('sunny-paletas-ca93b2.netlify.app',66,1590,21,'#d1ff6b',600);
   const link=document.createElement('a');link.download='capsula-sonora-pulso-'+period+'.png';link.href=canvas.toDataURL('image/png');link.click();
 }
 function onIdentification(event){
   const match=event?.detail;
   if(match?.title&&match?.artist)recordTrack({title:match.title,artist:match.artist,source:'identified'});
 }
 document.addEventListener('DOMContentLoaded',()=>{
   load();draw();initCloud();
   document.querySelectorAll('[data-capsule-period]').forEach(button=>button.addEventListener('click',()=>{period=button.dataset.capsulePeriod;draw()}));
   $('pulsoCapsuleIdentify')?.addEventListener('click',()=>{$('identifyRadio')?.click();});
   $('pulsoCapsuleTrackForm')?.addEventListener('submit',event=>{
     event.preventDefault();
     const form=event.currentTarget,title=form.elements.namedItem('trackTitle')?.value,artist=form.elements.namedItem('trackArtist')?.value;
     if(recordTrack({title,artist})){form.reset();$('pulsoCapsuleFormStatus').textContent='Faixa adicionada ao histórico como registro manual.';}
   });
   document.addEventListener('pulso:track-identified',onIdentification);
   window.addEventListener('storage',event=>{if(event.key===KEY){load();draw();}});
 });
 window.PULSO_CAPSULE={observeYouTube:observed,onYouTubeState:ytState,detachYouTube,observeNative,recordTrack,getSnapshot:()=>({...(draw()||{artists:[],sets:[],tracks:[],total:0}),period,label:dateLabel(period)}),sync:()=>syncCloud(true)};
})();