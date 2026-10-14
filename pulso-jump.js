/* PULSO JUMP — synchronized listening via Supabase Realtime Presence. */
(()=>{'use strict';
const $=id=>document.getElementById(id),cfg=window.PULSO_CONFIG||{},q=new URLSearchParams(location.search);
let sb=null,channel=null,role='host',room='',current=null,localPaused=false,lastPublished=0,syncTimer=null,subscribed=false;
const safeId=v=>/^[a-f0-9-]{30,40}$/i.test(String(v||''));
const app=()=>window.PULSO_APP;
function toast(m){if(app()?.toast)app().toast(m);else window.alert(m);}
function fmt(n){n=Math.max(0,Math.floor(Number(n)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function buildUI(){
 if($('pulsoJumpFab'))return;
 const fab=document.createElement('button');fab.id='pulsoJumpFab';fab.type='button';fab.innerHTML='<span class="pj-orb">↗</span><span>JUMP</span>';fab.setAttribute('aria-label','Abrir PULSO JUMP');document.body.appendChild(fab);
 const d=document.createElement('dialog');d.id='pulsoJumpDialog';d.className='pj-dialog';d.innerHTML='<div class="pj-head"><div><span class="pj-kicker">PULSO RADIO × LØSI</span><h2>PULSO <em>JUMP</em></h2></div><button type="button" id="pjClose" aria-label="Fechar">×</button></div><p class="pj-intro">Ouça a mesma faixa com alguém, cada um no seu ritmo. Pausar aqui não pausa o outro.</p><div id="pjStatus" class="pj-status">Pronto para conectar</div><div id="pjTrack" class="pj-track" hidden><strong id="pjTrackTitle"></strong><span id="pjTrackArtist"></span><small id="pjTrackTime"></small></div><div class="pj-actions"><button type="button" id="pjCreate" class="pj-primary">CRIAR JUMP E COPIAR LINK</button><button type="button" id="pjJoin" class="pj-secondary">ENTRAR NESTE JUMP</button><button type="button" id="pjCopy" class="pj-secondary" hidden>COPIAR LINK DO CONVITE</button><button type="button" id="pjLeave" class="pj-secondary" hidden>SAIR DA SESSÃO</button></div><p class="pj-foot">A sincronização de posição funciona com faixas de áudio hospedadas no PULSO. Players externos, YouTube e Spotify não permitem controle confiável de reprodução.</p>';document.body.appendChild(d);
 fab.addEventListener('click',()=>{d.showModal();refreshUI();});$('pjClose').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{if(e.target===d)d.close();});
 $('pjCreate').addEventListener('click',createRoom);$('pjJoin').addEventListener('click',joinRoom);$('pjCopy').addEventListener('click',copyInvite);$('pjLeave').addEventListener('click',()=>leaveRoom(true));
 const token=q.get('jump');if(token&&safeId(token)){room=token;role='guest';d.showModal();$('pjStatus').textContent='Convite detectado. Conectando…';joinRoom();}
}
function refreshUI(){ $('pjJoin').hidden=!!(room&&channel);$('pjCreate').hidden=!!(room&&channel);$('pjCopy').hidden=!room;$('pjLeave').hidden=!channel;
 const s=app()?.jumpState?.();if(s){$('pjTrack').hidden=false;$('pjTrackTitle').textContent=s.title;$('pjTrackArtist').textContent=s.artist;$('pjTrackTime').textContent='Posição atual '+fmt(s.time);if(!channel)$('pjStatus').textContent='Faixa pronta para compartilhar';}else if(!channel)$('pjStatus').textContent='Abra uma faixa de áudio do PULSO antes de criar a sessão.';}
function inviteURL(){const u=new URL(location.href);u.searchParams.set('jump',room);return u.href;}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Link do JUMP copiado. Envie pelo WhatsApp ou onde preferir.');}catch{window.prompt('Copie o link do convite:',text);}}
async function client(){if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase?.createClient)throw new Error('Supabase indisponível. Verifique a conexão.');if(!sb)sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);return sb;}
async function createRoom(){try{const s=app()?.jumpState?.();if(!s){toast('Abra uma faixa de áudio hospedada no PULSO e comece a reproduzir antes de criar o JUMP.');return;}room=crypto.randomUUID();role='host';current=s;localPaused=false;await client();await connectRoom();await publishState(s,true);refreshUI();await copy(inviteURL());}catch(e){toast('Não foi possível criar o JUMP: '+(e.message||'erro de conexão'));}}
async function joinRoom(){if(!room||!safeId(room)){toast('Link de convite inválido.');return;}try{role='guest';await client();await connectRoom();$('pjStatus').textContent='Conectado. Aguardando a faixa compartilhada…';refreshUI();}catch(e){toast('Não foi possível entrar no JUMP: '+(e.message||'erro de conexão'));}}
async function connectRoom(){if(channel){try{await sb.removeChannel(channel);}catch{}channel=null;subscribed=false;}channel=sb.channel('pulso-jump-'+room,{config:{presence:{key:role+'-'+crypto.randomUUID()}}});
 channel.on('presence',{event:'sync'},()=>{const states=channel.presenceState();for(const group of Object.values(states))for(const item of group||[])if(item?.jump?.id&&item?.jump?.url){receiveState(item.jump);return;}});
 channel.on('broadcast',{event:'jump-state'},({payload})=>{if(payload?.state)receiveState(payload.state);});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Tempo de conexão esgotado.')),10000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){subscribed=true;clearTimeout(timer);resolve();}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(new Error('Canal Realtime indisponível.'));}});});
 if(role==='host'&&current)await publishState(current,true);$('pjStatus').textContent=role==='host'?'JUMP criado. Compartilhe o convite.':'Conectado. Sincronizando a faixa…';refreshUI();}
async function publishState(s,force=false){if(!channel||!subscribed||!s)return;const now=Date.now();if(!force&&now-lastPublished<1000)return;lastPublished=now;
 const state={id:String(s.id),title:String(s.title||'PULSO'),artist:String(s.artist||''),url:String(s.url),cover:String(s.cover||''),position:Number(s.time)||0,anchorAt:now,updatedAt:now};current=state;
 await channel.track({role:'host',jump:state});await channel.send({type:'broadcast',event:'jump-state',payload:{state}});$('pjStatus').textContent='Você está compartilhando a faixa ao vivo.';refreshTrack(state);}
function refreshTrack(s){$('pjTrack').hidden=false;$('pjTrackTitle').textContent=s.title||'Faixa PULSO';$('pjTrackArtist').textContent=s.artist||'';$('pjTrackTime').textContent='Sincronização ativa · '+fmt(s.position||0);}
function receiveState(s){if(role==='host'||!s?.id||!s.url)return;current=s;const api=app();if(!api?.jumpPlay)return;const expected=Math.max(0,(Number(s.position)||0)+(Date.now()-(Number(s.anchorAt)||Date.now()))/1000),now=api.jumpState?.();
 if(!now||String(now.id)!==String(s.id)){if(!api.jumpPlay(s.id,expected)){$('pjStatus').textContent='Esta faixa não está disponível no catálogo aprovado do PULSO.';return;}}
 else if(!localPaused){const drift=Math.abs((Number(now.time)||0)-expected);if(drift>2.5){const media=document.querySelector('#embedContainer audio, #radioEmbed audio');if(media&&Number.isFinite(media.duration))media.currentTime=Math.min(expected,media.duration-0.1);}}
 current=s;refreshTrack(s);$('pjStatus').textContent=localPaused?'Você pausou apenas a sua reprodução.':'Ouvindo junto com o anfitrião.';}
async function copyInvite(){if(room)await copy(inviteURL());}
async function leaveRoom(removeQuery=true){if(syncTimer){clearInterval(syncTimer);syncTimer=null;}if(channel){try{await channel.untrack();await sb.removeChannel(channel);}catch{}channel=null;}subscribed=false;room='';current=null;if(removeQuery){const u=new URL(location.href);u.searchParams.delete('jump');history.replaceState({},'',u.href);}if($('pjStatus'))$('pjStatus').textContent='Você saiu da sessão.';if($('pjTrack'))$('pjTrack').hidden=true;if($('pjCopy'))$('pjCopy').hidden=true;if($('pjLeave'))$('pjLeave').hidden=true;if($('pjJoin'))$('pjJoin').hidden=false;if($('pjCreate'))$('pjCreate').hidden=false;}
function bindPlayback(){
 document.addEventListener('play',e=>{if(!(e.target instanceof HTMLMediaElement))return;if(role==='guest'){localPaused=false;if(current)receiveState(current);return;}if(channel){const s=app()?.jumpState?.();if(s&&current&&String(s.id)===String(current.id)){const expected=Math.max(0,(Number(current.position)||0)+(Date.now()-(Number(current.anchorAt)||Date.now()))/1000);if(Math.abs((Number(s.time)||0)-expected)>2.5&&Number.isFinite(e.target.duration))e.target.currentTime=Math.min(expected,e.target.duration-0.1);}else if(s)publishState(s,true);}},true);
 document.addEventListener('seeking',e=>{if(!(e.target instanceof HTMLMediaElement)||role!=='host'||!channel)return;const s=app()?.jumpState?.();if(s)publishState(s,true);},true);
 document.addEventListener('loadedmetadata',()=>{if(role==='guest'&&current&&!localPaused)receiveState(current);},true);
 document.addEventListener('pause',e=>{if(e.target instanceof HTMLMediaElement&&role==='guest')localPaused=true;},true);
 syncTimer=setInterval(()=>{if(!channel)return;if(role==='host'){const s=app()?.jumpState?.();if(s&&(!current||String(s.id)!==String(current.id)))publishState(s,true);}else if(current&&!localPaused)receiveState(current);},1800);
}
document.addEventListener('DOMContentLoaded',()=>{buildUI();bindPlayback();});
})();
