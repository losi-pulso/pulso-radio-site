/* PULSO social: avisos de novos DJ sets e opt-in Web Push. */
(()=>{'use strict';
 const byId=id=>document.getElementById(id);
 const config=window.PULSO_CONFIG||{};
 let sb=null,currentUser=null,items=[],subscribed=false,loading=false;
 const storeKey='pulso_read_announcements_v1';
 const readIds=()=>{try{return new Set(JSON.parse(localStorage.getItem(storeKey)||'[]'));}catch{return new Set();}};
 const writeIds=ids=>{try{localStorage.setItem(storeKey,JSON.stringify([...ids].slice(-300)));}catch{}};
 function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||!!navigator.standalone;
 function updateBadge(){
   const unread=items.filter(x=>!readIds().has(x.id));
   const badge=byId('pulsoNotifyBadge');if(!badge)return;
   badge.hidden=unread.length===0;badge.textContent=unread.length>9?'9+':String(unread.length);
   if(isStandalone()&&'setAppBadge' in navigator)navigator.setAppBadge(unread.length).catch(()=>{});
 }
 function render(){
   const list=byId('pulsoNotifyList');if(!list)return;
   if(!items.length){list.innerHTML='<p class="pulso-notify-explain">Nenhum DJ set novo por enquanto. Os próximos aparecerão aqui.</p>';updateBadge();return;}
   const read=readIds();
   list.innerHTML=items.map(i=>`<button class="pulso-notify-item" type="button" data-announcement="${escapeHtml(i.id)}" data-post="${escapeHtml(i.post_id)}"><i class="${read.has(i.id)?'pulso-old-dot':'pulso-new-dot'}"></i><span><strong>${escapeHtml(i.title)}</strong><small>${escapeHtml(i.artist)} • ${new Date(i.created_at).toLocaleDateString('pt-BR')} • Ver DJ set ↗</small></span></button>`).join('');updateBadge();
 }
 async function refresh(){
   if(!sb||loading)return;loading=true;
   try{
     const {data,error}=await sb.from('pulso_announcements').select('id,post_id,title,artist,created_at').order('created_at',{ascending:false}).limit(25);
     if(error)throw error;items=data||[];render();
   }catch(err){console.warn('Avisos PULSO:',err);}
   finally{loading=false;}
 }
 function errorHint(text){const el=byId('pulsoNotifyStatus');if(el)el.textContent=text;}
 function toBytes(base64){const input=base64.replace(/-/g,'+').replace(/_/g,'/');const raw=atob(input+'='.repeat((4-input.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
 async function status(){
   if(!currentUser){subscribed=false;byId('pulsoNotifyEnable').textContent='Entrar para ativar';errorHint('Entre na conta PULSO para receber notificações.');return;}
   if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
     errorHint('Este navegador não oferece Web Push. As novidades continuam disponíveis nesta tela.');byId('pulsoNotifyEnable').disabled=true;return;
   }
   if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!isStandalone()){
     errorHint('No iPhone, abra o PULSO pela Tela de Início para ativar notificações.');return;
   }
   try{
     const reg=await navigator.serviceWorker.ready;
     subscribed=!!await reg.pushManager.getSubscription();
     byId('pulsoNotifyEnable').textContent=subscribed?'Desativar avisos':'Ativar avisos';
     errorHint(subscribed?'Avisos autorizados neste aparelho. O envio remoto depende da configuração do servidor.':'Receba avisos quando um DJ set for aprovado.');
   }catch(err){errorHint('O serviço de notificações ainda está carregando.');}
 }
 async function toggle(){
   if(!sb){errorHint('Supabase indisponível.');return;}
   const button=byId('pulsoNotifyEnable');
   if(!currentUser){document.getElementById('accountButton')?.click();return;}
   if(!config.vapidPublicKey){errorHint('As notificações ainda não foram configuradas no servidor.');return;}
   button.disabled=true;
   try{
     const reg=await navigator.serviceWorker.ready;
     let subscription=await reg.pushManager.getSubscription();
     if(subscription){
       const endpoint=subscription.endpoint;
       const {error}=await sb.from('pulso_push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',currentUser.id);
       if(error)throw error;
       await subscription.unsubscribe();subscribed=false;
       errorHint('Avisos desativados neste dispositivo.');
     }else{
       if(Notification.permission==='denied')throw new Error('As notificações estão bloqueadas nos Ajustes do iPhone/navegador.');
       const permission=await Notification.requestPermission();
       if(permission!=='granted')throw new Error('Permissão de notificação não concedida.');
       subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(config.vapidPublicKey)});
       const j=subscription.toJSON();
       // Remova um registro antigo do mesmo aparelho antes de inserir, sem acesso a outros usuários.
       await sb.from('pulso_push_subscriptions').delete().eq('endpoint',subscription.endpoint).eq('user_id',currentUser.id);
       const {error}=await sb.from('pulso_push_subscriptions').insert({endpoint:subscription.endpoint,user_id:currentUser.id,p256dh:j.keys.p256dh,auth_secret:j.keys.auth});
       if(error){await subscription.unsubscribe();throw error;}
       subscribed=true;errorHint('Este dispositivo está inscrito. Os alertas só chegarão quando o envio remoto estiver ativado.');
     }
   }catch(err){errorHint('Não foi possível mudar a configuração: '+(err.message||String(err)));}
   finally{button.disabled=false;button.textContent=subscribed?'Desativar avisos':'Ativar avisos';}
 }
 function open(){const d=byId('pulsoNotifyDialog');if(d&&!d.open)d.showModal();refresh();status();}
 async function notifyPublishedSet(postId){
   if(!sb||!currentUser)return;
   try{
     const {error}=await sb.functions.invoke('pulso-send-new-set',{body:{post_id:postId}});
     if(error)console.info('Notificações externas ainda não configuradas:',error.message);
   }catch(e){console.info('Notificações externas aguardando ativação.');}
   refresh();
 }
 function init(opts){
   sb=opts?.sb||null;
   if(!byId('pulsoNotifyButton'))return;
   byId('pulsoNotifyButton').addEventListener('click',open);
   byId('pulsoNotifyClose').addEventListener('click',()=>byId('pulsoNotifyDialog').close());
   byId('pulsoNotifyDialog').addEventListener('click',e=>{if(e.target===byId('pulsoNotifyDialog'))e.target.close();});
   byId('pulsoNotifyEnable').addEventListener('click',toggle);
   byId('pulsoNotifyList').addEventListener('click',e=>{const b=e.target.closest('[data-announcement]');if(!b)return;const ids=readIds();ids.add(b.dataset.announcement);writeIds(ids);render();const url=new URL(location.href);url.hash='';url.searchParams.set('track',b.dataset.post);location.href=url.href;});
   refresh();status();
   window.setInterval(()=>{if(!document.hidden)refresh();},90000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 }
 function onAuthChange(u){currentUser=u||null;status();}
 window.PULSO_NOTIFICATIONS={init,refresh,onAuthChange,notifyPublishedSet};
})();
