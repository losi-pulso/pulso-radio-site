/* PULSO by LØSI — portal estático + Supabase (ou prévia local sem configuração). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const videoTypes = new Set(['Videoclipe','Vídeo DJ Set','Live']);
  const isVideoPost = p => videoTypes.has(p?.type);
  const genres = ['Todos','House','Tech House','Deep House','Afro House','Organic House','Progressive House','Melodic House','Minimal House','Bass House','Funky House','Jackin House','Latin House','Techno','Hard Techno','Industrial Techno','Peak Time Techno','Hypnotic Techno','Melodic Techno','Acid Techno','Hardgroove','Progressive','Melodic','Indie Dance','Organic','Minimal','Trance','Psytrance','Drum & Bass','UK Garage','Breakbeat','Electro','Nu Disco','Disco','Dubstep','Outros'];

  // Ícones desenhados em SVG, substituem os símbolos de texto do player.
  function pulsoIcon(name){
    const paths={
      play:'<path d="M8 5.5 19 12 8 18.5Z" fill="currentColor" stroke="none"/>',
      pause:'<path d="M8 5v14M16 5v14"/>',
      back:'<path d="M4 10a8 8 0 1 1 3 8M4 4v6h6"/>',
      forward:'<path d="M20 10a8 8 0 1 0-3 8M20 4v6h-6"/>',
      previous:'<path d="M5 5v14M19 6l-10 6 10 6V6Z"/>',
      next:'<path d="M19 5v14M5 6l10 6-10 6V6Z"/>'
    };
    return `<svg class="pulso-control-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.play}</svg>`;
  }
  function setArtwork(id,url){
    const img=$(id);if(!img)return;
    const cover=typeof url==='string' ? secureUrl(url) : '';
    if(cover){img.src=cover;img.hidden=false;img.parentElement.classList.add('has-record-cover');}
    else{img.removeAttribute('src');img.hidden=true;img.parentElement.classList.remove('has-record-cover');}
  }
  const themes = [
    ['#3b4830','#84995b','∿'],['#291d40','#8161ab','◉'],
    ['#57352e','#c47444','✳'],['#1c4948','#4fa29c','⟡'],
    ['#3b3558','#9b7cba','✦'],['#333944','#8b94ac','↗'],
    ['#443b21','#ae9254','◎'],['#3a2540','#b6789b','⌁']
  ];
  const demoPosts = [
    {id:'demo-1', title:'Midnight Frequency',artist:'ARTISTA EXEMPLO',genre:'Techno',type:'DJ Set',description:'Um set de referência para você imaginar a sua próxima madrugada.',demo:true,created_at:'2026-10-11T12:00:00',index:0,status:'approved',likes_count:0},
    {id:'demo-2', title:'Beyond the Horizon',artist:'ARTISTA EXEMPLO',genre:'Progressive',type:'Faixa',description:'Atmosfera progressiva com grooves hipnóticos e longas transições.',demo:true,created_at:'2026-10-10T12:00:00',index:1,status:'approved',likes_count:0},
    {id:'demo-3', title:'After The Lights',artist:'ARTISTA EXEMPLO',genre:'House',type:'Faixa',description:'Uma vibe quente para o início da noite e para a pista inteira.',demo:true,created_at:'2026-10-09T12:00:00',index:2,status:'approved',likes_count:0},
    {id:'demo-4', title:'Deep Into Motion',artist:'ARTISTA EXEMPLO',genre:'Melodic',type:'DJ Set',description:'Texturas melódicas que crescem a cada batida. Exemplo de postagem.',demo:true,created_at:'2026-10-08T12:00:00',index:3,status:'approved',likes_count:0},
    {id:'demo-5', title:'Ritual de Domingo',artist:'ARTISTA EXEMPLO',genre:'Afro House',type:'Playlist',description:'Percussão, ritmo e energia em uma seleção para descobrir.',demo:true,created_at:'2026-10-07T12:00:00',index:4,status:'approved',likes_count:0},
    {id:'demo-6', title:'Low End Theory',artist:'ARTISTA EXEMPLO',genre:'Minimal',type:'Faixa',description:'Menos elementos, mais groove. Uma amostra do visual do feed.',demo:true,created_at:'2026-10-06T12:00:00',index:5,status:'approved',likes_count:0}
  ];
  const config = window.PULSO_CONFIG || {};
  const allowedUploadMB = Math.min(48, Math.max(1, Number(config.maxVideoUploadMB)||48));
  const videoBytesLimit = allowedUploadMB * 1024 * 1024;
  const audioChunkBytes = 8 * 1024 * 1024;
  const audioMaxBytes = 400 * 1024 * 1024;
  const audioSmallBytes = 48 * 1024 * 1024;
  let activeVideoUpload = null;
  let activeLargeAudioPlayer = null;
  let audioWorkerReadyPromise = null;
  function registerAudioWorker() {
    if(!('serviceWorker' in navigator) || !window.isSecureContext)return Promise.resolve(false);
    if(audioWorkerReadyPromise)return audioWorkerReadyPromise;
    audioWorkerReadyPromise=(async()=>{
      try {
        const reg=await navigator.serviceWorker.register('./pulso-audio-sw.js', {scope:'./',updateViaCache:'none'});
        const ready=await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(()=>resolve(null),5000))]);
        if(!ready)return false;
        if(navigator.serviceWorker.controller)return true;
        await new Promise(resolve=>{
          const timeout=setTimeout(resolve,3500);
          navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve();},{once:true});
        });
        return !!navigator.serviceWorker.controller;
      }catch(err){console.warn('Player avançado indisponível:',err);return false;}
    })();
    return audioWorkerReadyPromise;
  }
  function audioStreamUrl(manifestUrl){
    const u=new URL('./pulso-audio-stream',location.href);
    u.searchParams.set('src',manifestUrl);
    return u.href;
  }

  const cloud = /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test((config.supabaseUrl || '').trim()) &&
                !!(config.supabaseAnonKey || '').trim();
  let sb = null;
  if (cloud && window.supabase && typeof window.supabase.createClient === 'function') {
    sb = window.supabase.createClient(config.supabaseUrl.trim().replace(/\/$/,''), config.supabaseAnonKey.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  const connected = !!sb;
  const localKey = 'pulso_posts_v1';
  const localLikeKey = 'pulso_likes_v1';
  const savedKey = 'pulso_saved_v1';
  const stored = (key,fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch {return fallback;}};
  const store = (key,val) => {try {localStorage.setItem(key, JSON.stringify(val));return true;}catch {toast('Não foi possível salvar neste navegador.');return false;}};
  let posts = connected ? [] : [...(Array.isArray(stored(localKey, [])) ? stored(localKey, []) : []).map(p => ({...p,created_at:p.created_at || p.timestamp,status:'approved',likes_count:0})), ...demoPosts];
  let localLikes = new Set(Array.isArray(stored(localLikeKey, [])) ? stored(localLikeKey,[]) : []);
  let likes = new Set();
  let saved = new Set(Array.isArray(stored(savedKey, [])) ? stored(savedKey,[]) : []);
  let user = null, isAdmin = false, reports = [], reportLoading = false;
  async function cloudPlaybackSave(kind,state){
    if(!connected||!sb||!user?.id||!['radio','video'].includes(kind)||!state)return;
    try{
      const {data:existing}=await sb.from('pulso_playback_state').select('radio_state,video_state').eq('user_id',user.id).maybeSingle();
      const row={user_id:user.id,radio_state:existing?.radio_state||null,video_state:existing?.video_state||null,updated_at:new Date().toISOString()};
      row[kind+'_state']=state;
      const {error}=await sb.from('pulso_playback_state').upsert(row,{onConflict:'user_id'});
      if(error)console.warn('Falha ao sincronizar ponto de reprodução:',error.message);
    }catch(err){console.warn('Sincronização do ponto de reprodução indisponível:',err);}
  }
  async function cloudPlaybackSync(){
    if(!connected||!sb||!user?.id)return;
    try{
      const {data,error}=await sb.from('pulso_playback_state').select('radio_state,video_state').eq('user_id',user.id).maybeSingle();
      if(error){console.warn('Não foi possível recuperar os pontos de reprodução:',error.message);return;}
      for(const kind of ['radio','video']){
        const remote=data?.[kind+'_state'];if(!remote)continue;
        const key='pulso-playback-'+kind+'-v1-'+String(user.id).replace(/[^a-z0-9_-]/gi,'');
        let local=null;try{local=JSON.parse(localStorage.getItem(key)||'null');}catch{}
        if(!local||Number(remote.savedAt||0)>Number(local.savedAt||0)){
          try{localStorage.setItem(key,JSON.stringify(remote));}catch{}
        }else if(Number(local.savedAt||0)>Number(remote.savedAt||0)){
          cloudPlaybackSave(kind,local);
        }
      }
      window.PULSO_VIDEO?.restore?.();
    }catch(err){console.warn('Falha ao sincronizar reprodução:',err);}
  }
  window.PULSO_PLAYBACK_CLOUD={save:cloudPlaybackSave,sync:cloudPlaybackSync};
  let activeGenre = 'Todos', mediaFilter = 'all', mode = 'all', query = '', sort = 'recent';
  let authMode = 'login', adminTab = 'pending', editingId = null;
  let pendingComposer = false, currentRefresh = 0, initialDeepLinkChecked = false;
  let toastTimer = null;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = input => {
    try {const u=new URL(String(input));return ['http:','https:'].includes(u.protocol) ? u.href : '';} catch {return '';}
  };
  const secureUrl = input => {
    try {const u=new URL(String(input));return u.protocol === 'https:' ? u.href : '';} catch {return '';}
  };
  const dateLabel = post => {
    if(post.demo) return 'Exemplo';
    const date=new Date(post.created_at || post.timestamp);
    return isNaN(date.getTime()) ? 'Recente' : date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');
  };
  const icons = {
    heart:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
    bookmark:'<svg viewBox="0 0 24 24"><path d="M5 4h14v17l-7-5-7 5z"/></svg>',
    link:'<svg viewBox="0 0 24 24"><path d="m10 13 4-4"/><path d="M8.5 15.5H7a5 5 0 0 1 0-10h3a5 5 0 0 1 5 5v.5"/><path d="M15.5 8.5H17a5 5 0 0 1 0 10h-3a5 5 0 0 1-5-5V13"/></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg>',
    flag:'<svg viewBox="0 0 24 24"><path d="M5 22V4m0 1c6-4 8 4 15 0v11c-7 4-9-4-15 0"/></svg>',
    star:'<svg viewBox="0 0 24 24"><path d="m12 2 3.2 6.5 7.2 1.1-5.2 5.1 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1.1z"/></svg>'
  };
  function toast(message) {const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),4200);}
  function dialogOpen(id) {if(!$(id).open) $(id).showModal();}
  function dialogClose(id) {if($(id).open) $(id).close();}
  function isMine(p) {return !p.demo && (connected ? !!(user && p.owner_id === user.id) : true);}
  function canDelete(p) {return !p.demo && (connected ? (isAdmin || (isMine(p) && ['pending','rejected'].includes(p.status))) : true);}
  function visiblePosts() {
    let result=posts.filter(p => {
      if (mode==='mine') {if(!isMine(p))return false;}
      else {if(p.status!=='approved')return false;}
      if (mode==='saved' && !saved.has(p.id))return false;
      if (activeGenre!=='Todos' && p.genre!==activeGenre)return false;
      if (mediaFilter==='video' && !isVideoPost(p))return false;
      if (mediaFilter==='music' && isVideoPost(p))return false;
      if(query && ![p.title,p.artist,p.genre,p.description,p.type].join(' ').toLocaleLowerCase('pt-BR').includes(query))return false;
      return true;
    });
    if(sort==='popular')result.sort((a,b)=>((connected?b.likes_count:Number(localLikes.has(b.id)))||0)-((connected?a.likes_count:Number(localLikes.has(a.id)))||0) || new Date(b.created_at)-new Date(a.created_at));
    else if(sort==='az')result.sort((a,b)=>String(a.title).localeCompare(String(b.title),'pt-BR'));
    else result.sort((a,b)=> Number(!!b.featured)-Number(!!a.featured) || new Date(b.created_at)-new Date(a.created_at));
    return result;
  }
  function themeFor(p) {return themes[Number.isInteger(p.index) ? Math.abs(p.index)%themes.length : Math.abs([...String(p.id)].reduce((v,c)=>v+c.charCodeAt(0),0))%themes.length];}
  function renderFilters() {
    const featured=['Todos','Techno','Tech House','House','Deep House','Afro House','Progressive House','Melodic Techno','Hard Techno'];
    const buttons=(featured.includes(activeGenre)?featured:[...featured,activeGenre]).map(g=>`<button type="button" class="genre-chip ${activeGenre===g?'active':''}" data-genre="${e(g)}" aria-pressed="${activeGenre===g}">${e(g)}</button>`).join('');
    const select=`<label class="genre-more-label"><span class="sr-only">Escolher outro gênero</span><select id="genreMoreFilter" aria-label="Todos os outros gêneros"><option value="">+ MAIS ESTILOS</option>${genres.filter(g=>!featured.includes(g)).map(g=>`<option value="${e(g)}" ${activeGenre===g?'selected':''}>${e(g)}</option>`).join('')}</select></label>`;
    $('genreFilters').innerHTML=buttons+select;
  }
  function renderMediaFilters() {document.querySelectorAll('[data-media]').forEach(b=>{const active=b.dataset.media===mediaFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function card(p) {
    const [a,b,symbol]=themeFor(p), liked=connected ? likes.has(p.id) : localLikes.has(p.id);
    const cover=safeUrl(p.cover);
    const youtubeId=youtubeVideoId(p.url);
    const displayCover=cover||(isVideoPost(p)&&youtubeId?`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`:'');
    const image=displayCover?`<img src="${e(displayCover)}" loading="lazy" alt="Capa de ${e(p.title)}">`:'';
    const count=connected ? Number(p.likes_count||0) : Number(liked);
    const state=p.status!=='approved'?`<span class="status-tag ${e(p.status)}">${p.status==='pending'?'AGUARDANDO APROVAÇÃO':'RECUSADO'}</span>`:'';
    return `<article class="track-card" data-id="${e(p.id)}">
      <div class="cover" style="--cover-a:${a};--cover-b:${b}"><div class="cover-grid"></div><div class="cover-ornament" aria-hidden="true">${symbol}</div>${image}<div class="cover-overlay"></div><span class="cover-label ${isVideoPost(p)?'label-video':''}">${isVideoPost(p)?'▣ ':''}${e(p.type||'Faixa').toLocaleUpperCase('pt-BR')}</span>${p.demo?'<span class="demo-label">POSTAGEM EXEMPLO</span>':''}${p.featured?'<span class="featured-label">✳ DESTAQUE LØSI</span>':''}<span class="cover-bottom">PULSO × LØSI</span><button class="card-play" type="button" data-action="play" aria-label="${isVideoPost(p)?'Assistir':'Ouvir'} ${e(p.title)}">${pulsoIcon('play')}</button></div>
      <div class="card-info"><div class="card-category">${e(p.genre)} ${state}</div><h3 class="card-title" title="${e(p.title)}">${e(p.title)}</h3><p class="card-artist">${e(p.artist)}</p><p class="card-description">${e(p.description||'Uma nova frequência para o seu radar.')}</p></div>
      <div class="card-bottom"><div class="card-meta"><span>◉ ${e(dateLabel(p))}</span><span>• ${e(p.type||'Faixa')}</span></div><div class="card-actions">
      ${p.status==='approved'?`<button class="icon-button ${liked?'is-active':''}" type="button" data-action="like" title="Curtir" aria-label="${liked?'Remover curtida':'Curtir'} ${e(p.title)}">${icons.heart}${count?`<span>${count}</span>`:''}</button><button class="icon-button ${saved.has(p.id)?'is-active':''}" type="button" data-action="save" aria-label="Salvar ${e(p.title)}" title="Salvar">${icons.bookmark}</button><button class="icon-button" type="button" data-action="share" aria-label="Compartilhar ${e(p.title)}" title="Copiar link">${icons.link}</button>${connected?`<button class="icon-button" type="button" data-action="report" aria-label="Denunciar ${e(p.title)}" title="Denunciar">${icons.flag}</button>`:''}`:''}
      ${isAdmin?`<button class="icon-button" type="button" data-action="edit" title="Editar">✎</button><button class="icon-button ${p.featured?'is-active':''}" type="button" data-action="feature" title="Destacar">${icons.star}</button>`:''}
      ${canDelete(p)?`<button class="icon-button delete-button" type="button" data-action="delete" aria-label="Excluir ${e(p.title)}" title="Excluir">${icons.trash}</button>`:''}
      </div></div>${window.PULSO_SOCIAL?.footer?.(p)||''}</article>`;
  }
  function communityDownloadAvailable(p){
    if(!p||!p.url)return false;
    try{
      const u=new URL(p.url);if(u.protocol!=='https:')return false;
      const ext=u.pathname.toLowerCase().split('.').pop();
      const video=videoTypes.has(p.type);
      if(video&&['mp4','m4v','mov','webm','ogv'].includes(ext))return true;
      const cfg=window.PULSO_CONFIG||{};
      if(video&&cfg.r2WorkerUrl&&u.origin===new URL(cfg.r2WorkerUrl).origin)return true;
      return false;
    }catch{return false;}
  }
  function renderCommunitySets(){
    const grid=$('communitySetGrid');if(!grid)return;
    const videos=posts.filter(p=>p.status==='approved'&&!p.demo&&videoTypes.has(p.type)&&p.url)
      .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,8);
    if(!videos.length){grid.innerHTML='<p class="community-sets-empty">Ainda não há sets ou vídeos aprovados da comunidade. Publica o teu primeiro set e ele aparecerá aqui após a aprovação.</p>';return;}
    grid.innerHTML=videos.map(p=>{
      const id=escapeHtml(String(p.id)),cover=postCover(p),download=communityDownloadAvailable(p);
      const preview=cover
        ?'<img class="community-set-cover" loading="lazy" src="'+escapeHtml(cover)+'" alt="Prévia de '+escapeHtml(p.title||'vídeo da comunidade')+'">'
        :'<div class="community-set-cover community-set-cover-empty" aria-hidden="true"></div>';
      return '<article class="community-set-card" data-community-post="'+id+'">'
       +'<div class="community-set-preview">'+preview+'<button type="button" class="community-set-play" data-community-play="'+id+'" aria-label="Reproduzir '+escapeHtml(p.title||'vídeo')+'" title="Reproduzir vídeo"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5 19 12 8 18.5Z" fill="currentColor" stroke="none"/></svg><span>ASSISTIR</span></button><span class="community-set-preview-label">PULSO COMMUNITY</span></div>'
       +'<div class="community-set-body"><small>'+escapeHtml(p.type||'SET DA COMUNIDADE').toUpperCase()+'</small><h3>'+escapeHtml(p.title||'Set sem título')+'</h3><p>'+escapeHtml(p.artist||'Artista da comunidade')+'</p>'
       +'<div class="community-set-actions">'+(download?'<button type="button" class="community-set-download" data-pulso-download="'+id+'" aria-label="Salvar vídeo para assistir offline"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 16v4h14v-4"/></svg><span><strong>BAIXAR</strong><small>PARA OFFLINE</small></span></button>':'')+'<button type="button" class="community-set-share" data-community-share="'+id+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg><span><strong>COMPARTILHAR</strong><small>ENVIAR ESTE SET</small></span></button></div></div></article>';
    }).join('');
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function postCover(p){if(p.cover&&/^https:\/\//i.test(p.cover))return p.cover;const m=String(p.url||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);return m?'https://img.youtube.com/vi/'+m[1]+'/hqdefault.jpg':'';}
  document.addEventListener('click',ev=>{
    const play=ev.target.closest('[data-community-play]');if(play){window.PULSO_APP?.playById?.(play.dataset.communityPlay);return;}
    const share=ev.target.closest('[data-community-share]');if(share){const p=posts.find(x=>String(x.id)===String(share.dataset.communityShare));if(!p)return;const u=new URL(location.href);u.searchParams.set('track',p.id);u.hash='';const data={title:(p.title||'Set')+' · PULSO',text:'Escuta este set no PULSO RADIO × LØSI',url:u.href};if(navigator.share)navigator.share(data).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(u.href).then(()=>toast('Link copiado!'));else prompt('Copie o link do set:',u.href);}
    if(ev.target.closest('[data-open-composer]')){const trigger=$('openComposer')||$('heroPublish');trigger?.click();}
  });
  function render() {
    renderFilters();renderMediaFilters();const shown=visiblePosts();
    renderCommunitySets();
    $('cardsGrid').innerHTML=shown.map(card).join('');
    $('emptyState').classList.toggle('hidden',shown.length!==0);
    $('cardsGrid').classList.toggle('hidden',shown.length===0);
    $('trackCount').textContent=`${shown.length} ${shown.length===1?'publicação':'publicações'} no radar`;
    $('myPostsCount').textContent=String(posts.filter(isMine).length);
    $('myPostsButton').classList.toggle('active',mode==='mine');
    radioSync();
    $('emptyMessage').textContent=mode==='saved'?'Salve as faixas para encontrá-las aqui. Favoritos são guardados neste navegador.':mode==='mine'?'Suas faixas enviadas, pendentes e recusadas aparecem aqui.':'Nenhuma publicação encontrada. Experimente outro estilo ou publique a primeira música ou vídeo.';
  }
  function setMode(next) {
    mode=next==='recent'?'all':next;
    if(next==='recent'){sort='recent';$('sortSelect').value='recent';}
    activeGenre='Todos';query='';$('searchInput').value='';render();
    const selected={all:'explorar',recent:'novidades',saved:'salvos',mine:'explorar'}[next]||'explorar';
    document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===selected));
  }
  function refreshUserButtons() {
    $('accountButton').innerHTML=user?'Minha conta <span>✓</span>':'Entrar <span>↗</span>';
    $('mobileAccount').textContent=user?'Minha conta / Sair':'Entrar / Criar conta';
    $('adminButton').classList.toggle('hidden',!isAdmin);
    $('mobileAdmin').classList.toggle('hidden',!isAdmin);
    $('authSignedIn').classList.toggle('hidden',!user);
    $('authSignedOut').classList.toggle('hidden',!!user);
    if(user)$('currentEmail').textContent=user.email||'usuário';
  }
  function errorText(error) {
    const message=String(error?.message||'Erro desconhecido.');
    if (/invalid login credentials/i.test(message))return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(message))return 'Confirme seu e-mail antes de entrar.';
    if (/user already registered/i.test(message))return 'Este e-mail já possui uma conta.';
    if (/rate limit|too many|over_email_send_rate_limit/i.test(message))return 'Muitas tentativas. Tente novamente mais tarde.';
    if (/row.level.security|permission denied|violates row-level/i.test(message))return 'Permissão negada. Confira seu login e a configuração SQL.';
    return message;
  }
  async function syncAuthAndFeed() {
    if(!connected)return;
    const {data:{user:currentUser},error:authError}=await sb.auth.getUser();
    if(currentUser && !authError){
      try{
        const assurance=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if(!assurance.error && assurance.data?.nextLevel==='aal2' && assurance.data?.currentLevel!=='aal2'){
          user=null;isAdmin=false;likes=new Set();refreshUserButtons();
          window.PULSO_SECURITY?.showChallenge?.();
          return;
        }
      }catch(err){console.warn('MFA indisponível:',err);}
    }
    user=authError?null:currentUser;
    if(user)await cloudPlaybackSync();
    isAdmin=false;likes=new Set();
    if(user){
      const [membership,liked]=await Promise.all([
        sb.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle(),
        sb.from('likes').select('post_id').eq('user_id',user.id).limit(2000)
      ]);
      if(membership.error)console.warn('Falha ao verificar administrador:',membership.error.message);
      isAdmin=!!membership.data?.user_id;
      if(!liked.error)likes=new Set((liked.data||[]).map(r=>r.post_id));
    }
    refreshUserButtons();
    window.PULSO_NOTIFICATIONS?.onAuthChange?.(user);
    await refreshPosts();
    window.PULSO5?.onSessionChanged?.();
    window.PULSO_NOTIFICATIONS?.refresh?.();
  }
  async function refreshPosts(silent=false) {
    if(!connected){render();return;}
    const seq=++currentRefresh;
    const {data,error}=await sb.from('posts').select('id,owner_id,title,artist,genre,type,url,cover,description,status,featured,likes_count,created_at').order('created_at',{ascending:false}).limit(500);
    if(seq!==currentRefresh)return;
    if(error){if(!silent)toast(`Não foi possível carregar as músicas: ${errorText(error)}`);return;}
    posts=data||[];render();window.PULSO_SOCIAL?.refresh?.().catch(console.warn);window.PULSO5?.onPostsChanged?.();window.PULSO_REELS?.refresh?.();
    radioSync();
    if(isAdmin && $('adminDialog').open) await refreshAdmin();
    if(!initialDeepLinkChecked){
      initialDeepLinkChecked=true;
      const target=new URLSearchParams(location.search).get('track');
      if(target){const p=posts.find(t=>t.id===target && t.status==='approved');if(p)playPost(p);}
    }
  }
  function authDialog() {
    if(!connected){toast('Prévia local: conecte o Supabase em config.js para ativar contas e publicações compartilhadas.');return;}
    refreshUserButtons();dialogOpen('authDialog');
  }
  function setAuthMode(next) {
    authMode=next;
    $('loginTab').classList.toggle('active',next==='login');
    $('signupTab').classList.toggle('active',next==='signup');
    $('authTitle').innerHTML=next==='login'?'ENTRAR <em>NA PISTA.</em>':'CRIAR <em>CONTA.</em>';
    $('authSubmit').textContent=next==='login'?'Entrar ↗':'Cadastrar ↗';
    $('authError').textContent='';
    $('authPassword').autocomplete=next==='login'?'current-password':'new-password';
    $('authPassword').minLength=next==='signup'?12:6;
    $('authPassword').placeholder=next==='signup'?'Crie uma senha forte de 12+ caracteres':'Digite sua senha';
    $('signupPasswordHint').hidden=next!=='signup';
    window.PULSO_SECURITY?.refreshCaptcha?.();
  }
  async function submitAuth(ev) {
    ev.preventDefault();if(!connected)return;
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    $('authError').textContent='';$('authSubmit').disabled=true;
    try {
      if(authMode==='signup' && !window.PULSO_SECURITY?.strongPassword?.(password))
        throw new Error('Para cadastrar: use 12 ou mais caracteres com maiúscula, minúscula, número e símbolo.');
      const captchaToken=window.PULSO_SECURITY?.captchaToken?.();
      const authOptions=captchaToken?{captchaToken}:{};
      if(window.PULSO_SECURITY?.captchaRequired?.() && !captchaToken)
        throw new Error('Conclua a verificação de segurança antes de continuar.');
      if(authMode==='signup'){
        const {data,error}=await sb.auth.signUp({email,password,options:{...authOptions,emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
        if(!data.session){$('authError').textContent='Cadastro solicitado. Confira seu e-mail e confirme a conta antes de entrar.';toast('Confira seu e-mail para confirmar o cadastro.');pendingComposer=false;return;}
      } else {
        const {error}=await sb.auth.signInWithPassword({email,password,options:authOptions});if(error)throw error;
      }
      dialogClose('authDialog');$('authForm').reset();
      await syncAuthAndFeed();window.PULSO_SOCIAL?.refresh?.().catch(console.warn);
      if(!user){toast('Confira o código de autenticação de dois fatores para entrar.');return;}
      toast('Conectado! Bem-vindo à frequência.');
      if(pendingComposer){pendingComposer=false;openComposer();}
    } catch(error){$('authError').textContent=errorText(error);}
    finally {$('authSubmit').disabled=false;window.PULSO_SECURITY?.resetCaptcha?.();}
  }
  function openComposer(p=null) {
    if(connected && !user){pendingComposer=true;authDialog();toast('Entre ou crie uma conta para enviar seu som.');return;}
    if(p && (!isAdmin || !connected)){toast('Somente administradores podem editar publicações.');return;}
    editingId=p?.id || null;
    $('postForm').reset();$('formError').textContent='';
    $('composerTitle').innerHTML=p?'EDITAR <em>PUBLICAÇÃO.</em>':'PUBLICAR <em>UM SOM.</em>';
    $('composerIntro').textContent=p?'Atualize o conteúdo selecionado. Nos vídeos, somente o título é um campo de texto obrigatório.':connected?'Para músicas e DJ sets, você pode escolher um arquivo de áudio da galeria. MP3 até 400 MB; outros áudios até 48 MB. Ao enviar arquivo, somente o título é obrigatório. Para vídeos, use MP4/MOV/WebM ou um link do YouTube.':'Prévia local: publique links do YouTube. Os arquivos serão armazenados quando conectar o Supabase.';
    $('submitPost').innerHTML=p?'Salvar alterações <span>↗</span>':connected?(isAdmin?'Publicar imediatamente <span>↗</span>':'Enviar para aprovação <span>↗</span>'):'Publicar neste navegador <span>↗</span>';
    $('uploadRow').classList.toggle('hidden',!connected);
    if(p){$('postTitle').value=p.title;$('postArtist').value=p.artist;$('postGenre').value=p.genre;$('postType').value=p.type;$('postUrl').value=p.url;$('postDescription').value=p.description||'';$('postCover').value=p.cover||'';}
    updateComposerMedia();
    dialogOpen('composerDialog');setTimeout(()=>$('postTitle').focus(),80);
  }
  const closeComposer=()=>{if(activeVideoUpload){toast('Cancele o upload antes de fechar.');return;}dialogClose('composerDialog');editingId=null;};
  function uploadProgress(done, total, labelType='vídeo') {
    const ui=$('videoUploadProgress'), meter=$('videoUploadMeter'), label=$('videoUploadStatus');
    ui.classList.remove('hidden');
    meter.value = total ? Math.max(0,Math.min(100,Math.round(done/total*100))) : 0;
    label.textContent = total ? `Enviando ${labelType}: ${meter.value}% — ${(done/1048576).toFixed(0)} de ${(total/1048576).toFixed(0)} MB` : 'Preparando envio…';
  }
  function clearUploadUI() {
    $('videoUploadProgress').classList.add('hidden');
    $('videoUploadMeter').value=0;
    $('cancelVideoUpload').disabled=false;
    activeVideoUpload=null;
  }
  function updateComposerMedia() {
    const video=videoTypes.has($('postType').value);
    const audioFile=!video&&!!$('postAudioFile').files[0];
    $('videoUploadRow').classList.toggle('hidden',!video||!connected);
    $('audioUploadRow').classList.toggle('hidden',video||!connected);
    $('postTitleLabel').innerHTML=video?'TÍTULO DO VÍDEO <b>*</b>':'TÍTULO DA MÚSICA / SET <b>*</b>';
    $('postTitle').placeholder=video?'Ex.: Meu set ao vivo':'Ex.: Midnight Orbit';
    $('postArtistLabel').innerHTML=video||audioFile?'ARTISTA / DJ <small>(OPCIONAL)</small>':'ARTISTA / DJ <b>*</b>';
    $('postArtist').required=!video&&!audioFile;
    $('postGenreLabel').innerHTML=video||audioFile?'GÊNERO <small>(OPCIONAL)</small>':'GÊNERO <b>*</b>';
    $('postGenre').required=!video&&!audioFile;
    $('postUrlLabel').innerHTML=video?'LINK DO YOUTUBE <small>(OPCIONAL SE ENVIAR ARQUIVO)</small>':audioFile?'LINK EXTERNO <small>(OPCIONAL AO ENVIAR ARQUIVO)</small>':'LINK DA MÚSICA <b>*</b>';
    $('postUrlHint').textContent=video?'Se preferir, cole o link de um vídeo ou DJ set do YouTube. Não precisa preencher este campo quando selecionar um arquivo da galeria.':audioFile?'Arquivo de áudio selecionado: não é necessário informar link.':'Envie MP3 pela galeria acima ou utilize SoundCloud, Spotify e YouTube.';
    $('postUrl').placeholder=video?'https://www.youtube.com/watch?v=...':'https://soundcloud.com/...';
    $('postUrl').required=!video&&!audioFile;
    $('audioUploadHint').textContent=useR2()?'Cloudflare R2: MP3, M4A, WAV, AAC e OGG até 400 MB para administradores. Upload multipart com reprodução por minuto.':'MP3 até 400 MB: acima de 48 MB o PULSO envia em partes no Supabase. M4A, WAV, AAC e OGG até 48 MB.';
    $('videoUploadHint').textContent=useR2()?'Cloudflare R2 configurado: MP4, MOV do iPhone e WebM até 2 GB. A reprodução de MOV/HEVC depende do navegador.':`Envie MP4, MOV ou WebM da galeria, até ${allowedUploadMB} MB no Supabase. Para melhor compatibilidade com Android e Windows, prefira MP4 (H.264).`;
  }
  async function uploadVideoSupabase(file, path) {
    if (file.size <= 6 * 1024 * 1024) {
      uploadProgress(0,file.size);
      const {error} = await sb.storage.from('pulso-videos').upload(path,file,{contentType:videoFileKind(file)?.mime||file.type,upsert:false,cacheControl:'3600'});
      if(error)throw error;
      uploadProgress(file.size,file.size);
    } else {
      if (!window.tus || !window.tus.Upload) throw new Error('Biblioteca de upload retomável indisponível. Recarregue e tente novamente.');
      const {data:{session},error:sessionError}=await sb.auth.getSession();
      if(sessionError || !session?.access_token)throw new Error('Sessão expirada. Faça login novamente.');
      const endpoint=config.supabaseUrl.replace(/\.supabase\.co\/?$/i,'.storage.supabase.co')+'/storage/v1/upload/resumable';
      await new Promise((resolve,reject)=>{
        let cancelled=false;
        const upload = new window.tus.Upload(file,{
          endpoint, retryDelays:[0,2000,5000,10000,20000],
          headers:{authorization:`Bearer ${session.access_token}`,apikey:config.supabaseAnonKey},
          uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
          metadata:{bucketName:'pulso-videos',objectName:path,contentType:videoFileKind(file)?.mime||file.type,cacheControl:'3600'},
          chunkSize:6*1024*1024,
          onProgress:(current,total)=>uploadProgress(current,total),
          onError:(error)=>reject(new Error(cancelled?'Envio cancelado.':error.message || String(error))),
          onSuccess:()=>resolve(),
        });
        activeVideoUpload=()=>{cancelled=true;upload.abort(true).catch(()=>{});reject(new Error('Envio cancelado.'));};
        upload.findPreviousUploads().then(previous=>{
          if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        }).catch(reject);
      });
    }
    const {data}=sb.storage.from('pulso-videos').getPublicUrl(path);
    return secureUrl(data.publicUrl);
  }
  function videoFileKind(file){
    const ext=(file?.name?.split('.').pop()||'').toLowerCase();
    const mime={mov:'video/quicktime',mp4:'video/mp4',webm:'video/webm'}[ext];
    if(!mime)return null;
    const reported=(file.type||'').toLowerCase().split(';')[0];
    const permitted={mov:['','video/quicktime','video/x-quicktime','video/mov','video/x-mov','application/octet-stream'],mp4:['','video/mp4','application/octet-stream'],webm:['','video/webm','application/octet-stream']}[ext];
    return permitted.includes(reported)?{ext,mime}:null;
  }
  async function uploadVideo() {
    const file=$('postVideoFile').files[0];if(!file)return '';
    if(!connected||!user)throw new Error('Faça login para enviar vídeos.');
    const kind=videoFileKind(file);
    if(!kind)throw new Error('Escolha um vídeo MP4, MOV do iPhone ou WebM.');
    const {ext}=kind;
    if(useR2()) {
      if(file.size>videoR2Bytes)throw new Error('O limite de vídeo no Cloudflare R2 é 2 GB.');
      uploadProgress(0,file.size,'ao Cloudflare R2');
      return await r2Upload(file);
    }
    if(file.size>videoBytesLimit)throw new Error(`Vídeo acima de ${allowedUploadMB} MB. Para sets ou vídeos grandes, publique no YouTube e cole o link no formulário.`);
    uploadProgress(0,file.size);
    // Guardar o mesmo caminho entre recargas permite retomar upload TUS após queda de rede.
    const fingerprintKey=`pulso_upload_pendente_${user.id}_${file.name}_${file.size}_${file.lastModified}`;
    let path='';
    try{path=localStorage.getItem(fingerprintKey)||'';}catch{}
    if(!new RegExp(`^${user.id}/[a-z0-9-]+\\.${ext}$`,'i').test(path)){
      const uuid=window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      path=`${user.id}/${uuid}.${ext}`;
    }
    try{localStorage.setItem(fingerprintKey,path);}catch{}
    const publicUrl=await uploadVideoSupabase(file,path);
    try{localStorage.removeItem(fingerprintKey);}catch{}
    return publicUrl;
  }
  const r2Endpoint = String(config.r2WorkerUrl || '').trim().replace(/\/$/,'');
  const r2Enabled = /^https:\/\/[-a-z0-9.]+(?:\:[0-9]{2,5})?$/i.test(r2Endpoint);
  const videoR2Bytes=2*1024*1024*1024;
  const useR2 = () => r2Enabled && isAdmin && connected && !!user;
  async function r2Fetch(path, opts={}) {
    if(!r2Enabled)throw new Error('O endereço do Worker Cloudflare R2 ainda não foi configurado.');
    const {data,error}=await sb.auth.getSession();
    if(error || !data?.session?.access_token)throw new Error('Sessão expirada. Entre novamente na conta LØSI.');
    const headers={Authorization:`Bearer ${data.session.access_token}`,...(opts.headers||{})};
    let resp;
    try {
      resp=await fetch(`${r2Endpoint}${path}`,{...opts,headers,mode:'cors'});
    } catch (err) {
      if (opts.signal?.aborted) throw new Error('Envio cancelado.');
      const etapa=String(path).split('?')[0];
      console.warn('PULSO R2 — falha de conexão na etapa', etapa, err);
      throw new Error(`Não foi possível conectar ao Cloudflare R2 (${etapa}). Verifique a conexão e se o Worker permite o domínio ${location.origin} nas configurações CORS. Se continuar, envie esta mensagem ao suporte.`);
    }
    if(!resp.ok){
      let detail='';try{detail=(await resp.json()).error||'';}catch{}
      throw new Error(detail||`Cloudflare respondeu com erro ${resp.status}.`);
    }
    return resp.json();
  }
  async function r2Upload(file){
    const kind=audioFileKind(file);
    const mime=kind?.mime || videoFileKind(file)?.mime || file.type;
    const start=await r2Fetch('/api/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime,size:file.size})});
    const slices=[],partsCount=Math.ceil(file.size/start.partSize);
    let cancelled=false;
    const controller=new AbortController();
    activeVideoUpload=()=>{cancelled=true;controller.abort();};
    try {
      for(let i=0;i<partsCount;i++){
        if(cancelled)throw new Error('Envio cancelado.');
        const blob=file.slice(i*start.partSize,Math.min(file.size,(i+1)*start.partSize));
        let part=null;
        for(let attempt=0;attempt<3;attempt++){
          if(cancelled)throw new Error('Envio cancelado.');
          try{
            const qp=new URLSearchParams({key:start.key,uploadId:start.uploadId,partNumber:String(i+1)});
            part=await r2Fetch(`/api/part?${qp}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:blob,signal:controller.signal});
            break;
          }catch(err){if(cancelled||attempt===2)throw err;await new Promise(resolve=>setTimeout(resolve,850*(attempt+1)));}
        }
        slices.push(part);
        uploadProgress(Math.min(file.size,(i+1)*start.partSize),file.size,'ao Cloudflare R2');
      }
      if(cancelled)throw new Error('Envio cancelado.');
      const res=await r2Fetch('/api/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:start.key,uploadId:start.uploadId,size:file.size,parts:slices})});
      uploadProgress(file.size,file.size,'ao Cloudflare R2');
      return secureUrl(res.url);
    }catch(err){
      try{await r2Fetch('/api/abort',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:start.key,uploadId:start.uploadId})});}catch{}
      throw err;
    }
  }
  // Áudios grandes são repartidos no browser: cada objeto é <= 8 MB,
  // respeitando o limite individual de 50 MB do Supabase Free.
  // A franquia total do plano não aumenta e os uploads grandes podem consumir tudo.
  function audioFileKind(file) {
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    const mime=({mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',aac:'audio/aac'})[ext];
    return mime?{ext,mime}:null;
  }
  async function uploadAudio() {
    const file=$('postAudioFile').files[0];if(!file)return '';
    if(!connected||!user)throw new Error('Faça login para publicar áudios.');
    const kind=audioFileKind(file);
    if(!kind)throw new Error('Escolha MP3, M4A, WAV, AAC ou OGG.');
    if(!file.size)throw new Error('O arquivo de áudio está vazio.');
    if(file.size>audioMaxBytes)throw new Error('Limite de 400 MB por áudio. Para arquivos maiores, publique no SoundCloud e cole o link.');
    if(useR2()) {
      uploadProgress(0,file.size,'ao Cloudflare R2');
      return await r2Upload(file);
    }
    if(file.size>audioSmallBytes && kind.ext!=='mp3')throw new Error('Acima de 48 MB, envie MP3. Converta este arquivo para MP3 ou use o SoundCloud.');
    const id=window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const base=`${user.id}/${id}`;
    const store=sb.storage.from('pulso-audio');
    if(file.size<=audioSmallBytes){
      const path=`${base}.${kind.ext}`;
      uploadProgress(0,file.size,'áudio');
      let cancelled=false;activeVideoUpload=()=>{cancelled=true;};
      const {error}=await store.upload(path,file,{contentType:kind.mime,upsert:false,cacheControl:'3600'});
      if(error)throw error;
      if(cancelled){await store.remove([path]);throw new Error('Envio cancelado.');}
      uploadProgress(file.size,file.size,'áudio');
      return secureUrl(store.getPublicUrl(path).data.publicUrl);
    }
    const created=[];let cancelled=false;
    activeVideoUpload=()=>{cancelled=true;};
    try {
      const pieces=Math.ceil(file.size/audioChunkBytes);
      for(let i=0;i<pieces;i++){
        if(cancelled)throw new Error('Envio cancelado.');
        const path=`${base}/${String(i).padStart(4,'0')}.mp3`;
        const data=file.slice(i*audioChunkBytes,Math.min(file.size,(i+1)*audioChunkBytes),'audio/mpeg');
        let chunkUploaded=false, lastError;
        for(let attempt=0;attempt<3&&!chunkUploaded;attempt++){
          if(cancelled)throw new Error('Envio cancelado.');
          try {
            const {error}=await store.upload(path,data,{contentType:'audio/mpeg',upsert:false,cacheControl:'3600'});
            if(error)throw error;
            chunkUploaded=true;
          } catch(error) {
            lastError=error;
            if(attempt<2&&!cancelled){
              uploadProgress(i*audioChunkBytes,file.size,'áudio');
              await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
            }
          }
        }
        if(!chunkUploaded)throw new Error(`Falha na parte ${i+1}/${pieces}: ${lastError?.message||lastError}. Tente novamente com uma conexão estável.`);
        created.push(path);
        uploadProgress(Math.min(file.size,(i+1)*audioChunkBytes),file.size,'áudio');
      }
      if(cancelled)throw new Error('Envio cancelado.');
      const manifestPath=`${base}/manifest.json`;
      const manifest={version:1,codec:'audio/mpeg',bytes:file.size,parts:pieces,chunkBytes:audioChunkBytes};
      const {error}=await store.upload(manifestPath,new Blob([JSON.stringify(manifest)],{type:'application/json'}),{contentType:'application/json',upsert:false,cacheControl:'300'});
      if(error)throw error;
      created.push(manifestPath);
      return secureUrl(store.getPublicUrl(manifestPath).data.publicUrl);
    }catch(error){
      if(created.length)await store.remove(created).catch(()=>{});
      throw error;
    }
  }
  async function uploadCover() {
    const file=$('postCoverFile').files[0];if(!file)return '';
    if(!connected||!user)throw new Error('Faça login para enviar imagens.');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    if(!ext)throw new Error('Use uma imagem JPG, PNG ou WEBP.');
    if(file.size>3*1024*1024)throw new Error('A capa deve ter no máximo 3 MB.');
    const unique=window.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path=`${user.id}/${unique}.${ext}`;
    const {error}=await sb.storage.from('pulso-covers').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
    if(error)throw error;
    const {data}=sb.storage.from('pulso-covers').getPublicUrl(path);
    return secureUrl(data.publicUrl);
  }
  async function submitPost(ev) {
    ev.preventDefault();
    const type=$('postType').value,isVideo=videoTypes.has(type);
    const title=$('postTitle').value.trim();
    const hasAudioFile=!isVideo&&connected&&!!$('postAudioFile').files[0];
    // O banco existente exige artista e gênero. Quando o visitante não informar
    // esses campos para um vídeo, guardamos valores neutros automaticamente.
    const artist=$('postArtist').value.trim()||((isVideo||hasAudioFile)?'Artista não informado':'');
    const genre=$('postGenre').value||((isVideo||hasAudioFile)?'Outros':'');
    const urlRaw=$('postUrl').value.trim(),coverRaw=$('postCover').value.trim();
    const hasVideoFile=isVideo && connected && !!$('postVideoFile').files[0];
    const url=urlRaw?(connected?secureUrl(urlRaw):safeUrl(urlRaw)):'',cover=coverRaw?(connected?secureUrl(coverRaw):safeUrl(coverRaw)):'';
    const description=$('postDescription').value.trim();
    if(!title){$('formError').textContent='Informe o título da publicação.';return;}
    if(!isVideo && !hasAudioFile && (!artist||!genres.includes(genre)||genre==='Todos')){$('formError').textContent='Para músicas, informe também artista e gênero.';return;}
    if(!url&&!hasVideoFile&&!hasAudioFile){$('formError').textContent=isVideo?'Escolha um vídeo da galeria ou cole o link do YouTube.':'Escolha um arquivo de áudio da galeria ou cole o link da música.';return;}
    if(isVideo&&url&&!hasVideoFile&&!(videoEmbedSource(url)||isDirectVideo(url))){$('formError').textContent='Para postagens de vídeo, use YouTube, Vimeo, MP4, MOV ou WebM com HTTPS.';return;}
    if(hasVideoFile&&!videoFileKind($('postVideoFile').files[0])){$('formError').textContent='Arquivo inválido. Aceitamos MP4, MOV do iPhone e WebM.';return;}
    if(hasVideoFile&&$('postVideoFile').files[0].size>(useR2()?videoR2Bytes:videoBytesLimit)){$('formError').textContent=useR2()?'Vídeo acima de 2 GB. Reduza o arquivo.':`Arquivo acima de ${allowedUploadMB} MB. Faça upload no YouTube ou entre como administrador LØSI para usar o Cloudflare R2.`;return;}
    if(hasAudioFile){
      const file=$('postAudioFile').files[0],kind=audioFileKind(file);
      if(!kind){$('formError').textContent='Escolha MP3, M4A, WAV, AAC ou OGG.';return;}
      if(file.size>audioMaxBytes || !file.size){$('formError').textContent='O áudio deve ter entre 1 byte e 400 MB. Para arquivos maiores, use SoundCloud.';return;}
      if(!useR2()&&file.size>audioSmallBytes&&kind.ext!=='mp3'){$('formError').textContent='Para áudio com mais de 48 MB, escolha um arquivo MP3.';return;}
    }
    if(coverRaw&&!cover){$('formError').textContent='A capa precisa ter uma URL segura (HTTPS no modo público).';return;}
    const submit=$('submitPost');submit.disabled=true;submit.textContent=hasVideoFile?'Enviando vídeo…':hasAudioFile?'Enviando áudio…':'Salvando…';$('formError').textContent='';
    $('cancelVideoUpload').disabled=false;
    try {
      if(!connected){
        const record={id:`local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,artist,genre,type,url,cover,description,created_at:new Date().toISOString(),status:'approved',likes_count:0};
        const own=[record,...posts.filter(p=>!p.demo)];
        if(!store(localKey,own))return;
        posts=[...own,...demoPosts];toast('Publicação salva nesta prévia local.');
      } else {
        if(!user)throw new Error('Você precisa entrar na conta antes de publicar.');
        let finalCover=cover||null;
        if($('postCoverFile').files[0])finalCover=await uploadCover();
        const finalUrl=hasVideoFile?await uploadVideo():hasAudioFile?await uploadAudio():url;
        const payload={title,artist,genre,type,url:finalUrl,cover:finalCover,description};
        if(editingId){
          if(!isAdmin)throw new Error('Somente o administrador pode editar.');
          const {error}=await sb.from('posts').update(payload).eq('id',editingId);
          if(error)throw error;
          const oldPost=posts.find(p=>p.id===editingId);
          if(oldPost?.url && oldPost.url!==finalUrl)await freeOldMedia(oldPost.url);
          toast('Publicação atualizada.');
        } else {
          const {data:newPost,error}=await sb.from('posts').insert({...payload,owner_id:user.id,status:isAdmin?'approved':'pending'}).select('id').single();
          if(error)throw error;
          if(isAdmin&&newPost?.id&&['DJ Set','Vídeo DJ Set'].includes(type))window.PULSO_NOTIFICATIONS?.notifyPublishedSet?.(newPost.id);
          toast(isAdmin?'Publicação disponível para todos!':'Envio recebido! Aguarde a aprovação do administrador.');
        }
        await refreshPosts();
      }
      closeComposer();setMode(connected&&!isAdmin?'mine':'all');$('explorar').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){$('formError').textContent=errorText(err);}
    finally{clearUploadUI();submit.disabled=false;submit.innerHTML=editingId?'Salvar alterações <span>↗</span>':connected?(isAdmin?'Publicar imediatamente ↗':'Enviar para aprovação ↗'):'Publicar neste navegador ↗';}
  }
  function youtubeVideoId(link) {
    try {
      if(!link)return '';const u=new URL(link),h=u.hostname.toLowerCase().replace(/^www\./,'');
      let id='';if(h==='youtu.be')id=u.pathname.slice(1).split('/')[0];
      if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(h)){
        if(u.pathname==='/watch')id=u.searchParams.get('v')||'';
        else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:'';
    }catch{return '';}
  }
  function videoEmbedSource(link) {
    const yt=youtubeVideoId(link);if(yt)return {kind:'youtube',url:`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,title:'Vídeo do YouTube'};
    try {
      const u=new URL(link),h=u.hostname.toLowerCase().replace(/^www\./,'');
      if(['vimeo.com','player.vimeo.com'].includes(h)){
        const m=u.pathname.match(/(?:^\/|\/video\/)([0-9]{6,15})(?:\/|$)/);
        if(m)return {kind:'vimeo',url:`https://player.vimeo.com/video/${m[1]}?autoplay=1`,title:'Vídeo do Vimeo'};
      }
    }catch{}
    return null;
  }
  function isDirectVideo(link) {try {return /\.(mp4|webm|mov)$/i.test(new URL(link).pathname);}catch{return false;}}
  function ownUploadedAudioInfo(link) {
    try{
      const u=new URL(link),supa=new URL(config.supabaseUrl);
      const prefix='/storage/v1/object/public/pulso-audio/';
      if(u.origin!==supa.origin||!u.pathname.startsWith(prefix))return null;
      const path=decodeURIComponent(u.pathname.slice(prefix.length));
      const chunked=/^([a-f0-9-]{36})\/([a-f0-9-]{36})\/manifest\.json$/i.exec(path);
      if(chunked)return {chunked:true,path,base:`${chunked[1]}/${chunked[2]}`,url:u.href};
      if(/^([a-f0-9-]{36})\/([a-f0-9-]{36})\.(mp3|m4a|wav|ogg|aac)$/i.test(path))return {chunked:false,path,url:u.href};
      return null;
    }catch{return null;}
  }
  function mediaEmbed(link) {
    const url=new URL(link),host=url.hostname.toLowerCase().replace(/^www\./,'');let video='';
    if(ownUploadedAudioInfo(link)?.chunked)return {kind:'chunked-audio',url:link,title:'Player de DJ set MP3'};
    if(/\.(mp3|m4a|aac|ogg|oga|wav|flac)$/i.test(url.pathname))return {kind:'audio',url:link,title:'Player de áudio'};
    if(isDirectVideo(link))return {kind:'video',url:link,title:'Player de vídeo'};
    const videoEmbed=videoEmbedSource(link);if(videoEmbed)return videoEmbed;
    if(host==='youtu.be')video=url.pathname.slice(1).split('/')[0];
    if(['youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
      if(url.pathname==='/watch')video=url.searchParams.get('v')||'';
      if(/^\/(shorts|live|embed)\//.test(url.pathname))video=url.pathname.split('/')[2]||'';
    }
    if(/^[a-zA-Z0-9_-]{11}$/.test(video))return {kind:'youtube',url:`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`,title:'Player do YouTube'};
    if(['spotify.com','open.spotify.com'].includes(host)){
      const match=url.pathname.match(/\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
      if(match)return {kind:'spotify',url:`https://open.spotify.com/embed/${match[1]}/${match[2]}`,title:'Player do Spotify'};
    }
    if(['soundcloud.com','m.soundcloud.com','on.soundcloud.com'].includes(host))return {kind:'soundcloud',url:`https://w.soundcloud.com/player/?url=${encodeURIComponent(link)}&color=%23d2fb63&auto_play=true&hide_related=true&show_comments=false`,title:'Player do SoundCloud'};
    return null;
  }
  // Player de MP3 armazenado em partes. MSE usa carregamento progressivo,
  // e navegadores sem MSE recebem um Blob completo (pode demorar para sets longos).
  function mountChunkedAudio(manifestUrl,root,callbacks={}) {
    const info=ownUploadedAudioInfo(manifestUrl);
    const audio=document.createElement('audio');audio.controls=true;audio.preload='auto';audio.playsInline=true;audio.crossOrigin='anonymous';
    const status=document.createElement('p');status.className='audio-chunk-status';status.textContent='Preparando áudio grande…';
    root.append(audio,status);
    const abort=new AbortController();let dead=false,objectUrl='';
    const dispose=()=>{dead=true;abort.abort();audio.pause();audio.removeAttribute('src');audio.load();if(objectUrl)URL.revokeObjectURL(objectUrl);};
    const notify=msg=>{if(!dead)status.textContent=msg;};
    audio.addEventListener('ended',()=>{if(!dead)callbacks.ended?.();});
    audio.addEventListener('playing',()=>{if(!dead){notify('Reproduzindo • PULSO');callbacks.playing?.();}});
    audio.addEventListener('pause',()=>{if(!dead)callbacks.pause?.();});
    audio.addEventListener('error',()=>{if(!dead){notify('Não foi possível reproduzir este áudio.');callbacks.error?.();}});
    (async()=>{
      if(!info?.chunked)throw new Error('Endereço do áudio inválido.');
      const workerReady=await registerAudioWorker();
      if(dead)return;
      if(workerReady){
        notify('Carregando áudio • avance pela barra ou indique o minuto…');
        audio.src=audioStreamUrl(manifestUrl);
        audio.preload='metadata';
        await audio.play().catch(()=>notify('Toque em ▶ para iniciar o set.'));
        return;
      }
      notify('Modo de compatibilidade: atualize seu navegador para avançar pelo áudio sem espera.');
      const response=await fetch(manifestUrl,{signal:abort.signal});
      if(!response.ok)throw new Error('Manifesto de áudio não encontrado.');
      const m=await response.json();
      if(m.version!==1||m.codec!=='audio/mpeg'||!Number.isInteger(m.parts)||m.parts<2||m.parts>100||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>audioMaxBytes||m.chunkBytes!==audioChunkBytes)throw new Error('Formato do áudio armazenado inválido.');
      const baseUrl=manifestUrl.slice(0,-'manifest.json'.length);
      const getPart=async i=>{
        const response=await fetch(`${baseUrl}${String(i).padStart(4,'0')}.mp3`,{signal:abort.signal});
        if(!response.ok)throw new Error(`Não foi possível carregar a parte ${i+1}.`);
        return await response.arrayBuffer();
      };
      if(window.MediaSource?.isTypeSupported?.('audio/mpeg')){
        const ms=new MediaSource();objectUrl=URL.createObjectURL(ms);audio.src=objectUrl;
        await new Promise((resolve,reject)=>{ms.addEventListener('sourceopen',resolve,{once:true});ms.addEventListener('error',()=>reject(new Error('MediaSource indisponível')),{once:true});});
        if(dead)return;
        const buffer=ms.addSourceBuffer('audio/mpeg');buffer.mode='sequence';
        let next=0,busy=false,done=false;
        const awaitUpdate=()=>new Promise((resolve,reject)=>{if(!buffer.updating)return resolve();const ok=()=>{buffer.removeEventListener('error',fail);resolve();};const fail=()=>{buffer.removeEventListener('updateend',ok);reject(new Error('Não foi possível decodificar MP3.'));};buffer.addEventListener('updateend',ok,{once:true});buffer.addEventListener('error',fail,{once:true});});
        const feed=async()=>{
          if(dead||busy||done||next>=m.parts)return;
          const last=audio.buffered.length?audio.buffered.end(audio.buffered.length-1):0;
          if(next>0&&last-audio.currentTime>150)return;
          busy=true;
          try{
            notify(`Carregando áudio: parte ${next+1}/${m.parts}…`);
            const bytes=await getPart(next);if(dead)return;
            await awaitUpdate();if(dead)return;
            try{buffer.appendBuffer(bytes);}catch(err){
              if(err.name!=='QuotaExceededError'||audio.currentTime<=45)throw err;
              buffer.remove(0,Math.max(0,audio.currentTime-30));await awaitUpdate();buffer.appendBuffer(bytes);
            }
            await awaitUpdate();next++;
            if(next===m.parts){done=true;if(ms.readyState==='open'&&!buffer.updating)ms.endOfStream();notify('Áudio pronto para ouvir.');}
          }catch(err){if(!dead){notify('Erro ao carregar áudio: '+err.message);callbacks.error?.();}}
          finally{busy=false;}
          if(!dead&&!done){const end=audio.buffered.length?audio.buffered.end(audio.buffered.length-1):0;if(end-audio.currentTime<150)feed();}
        };
        audio.addEventListener('timeupdate',feed);
        await feed();
      }else{
        // Fallback universal: carrega os MP3 em sequência; requer RAM disponível.
        notify('Baixando as partes do set para iniciar (pode demorar no celular)…');
        const data=[];
        for(let i=0;i<m.parts;i++){if(dead)return;data.push(await getPart(i));notify(`Preparando DJ set: ${Math.round((i+1)/m.parts*100)}%`);}
        if(dead)return;
        objectUrl=URL.createObjectURL(new Blob(data,{type:'audio/mpeg'}));
        audio.src=objectUrl;
      }
      if(!dead){audio.play().catch(()=>notify('Toque em ▶ para começar a ouvir.'));}
    })().catch(err=>{if(!dead){notify('Não foi possível abrir o áudio: '+err.message);callbacks.error?.();}});
    return {audio,dispose};
  }
  function formatAudioTime(seconds){
    if(!Number.isFinite(seconds)||seconds<0)return '--:--';
    const t=Math.floor(seconds);const s=String(t%60).padStart(2,'0');
    const m=Math.floor(t/60)%60;const h=Math.floor(t/3600);
    return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`;
  }
  function addBeautifulAudioControls(root,audio,title,artist,cover,post){
    audio.controls=false;audio.classList.add('pulso-native-audio');
    const deck=document.createElement('div');deck.className='pulso-audio-deck';
    deck.innerHTML=`<div class="pulso-deck-hero"><div class="pulso-deck-disc"><img class="record-cover-image pulso-deck-cover-image" alt="" hidden><span>LØSI</span><i></i></div><div class="pulso-deck-info"><span class="pulso-deck-kicker">◉ PULSO PLAYER / AUDIO EXPERIENCE</span><strong>${e(title)}</strong><span>${e(artist||'PULSO RADIO')}</span></div></div><div class="pulso-deck-timeline"><div class="pulso-deck-time"><time class="pulso-now">00:00</time><span>ARRASTE ATÉ O PONTO DESEJADO</span><time class="pulso-length">--:--</time></div><input type="range" class="pulso-seek" min="0" max="1000" value="0" step="1" disabled aria-label="Selecionar minutagem da música"></div><div class="pulso-deck-actions"><button type="button" class="pulso-mini-back" aria-label="Voltar 15 segundos">${pulsoIcon('back')}<small>15</small></button><button type="button" class="pulso-big-play" aria-label="Tocar ou pausar">${pulsoIcon('play')}</button><button type="button" class="pulso-mini-next" aria-label="Avançar 15 segundos">${pulsoIcon('forward')}<small>15</small></button><label>IR PARA <span class="pulso-mmss pulso-mmss-deck pulso-hhmmss" role="group" aria-label="Posição: horas, minutos e segundos"><input type="text" class="pulso-hour" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="hh" aria-label="Horas desejadas" autocomplete="off" autocorrect="off" spellcheck="false"><b aria-hidden="true">:</b><input type="text" class="pulso-minute" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="mm" aria-label="Minutos desejados" autocomplete="off" autocorrect="off" spellcheck="false"><b aria-hidden="true">:</b><input type="text" class="pulso-second" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="ss" aria-label="Segundos desejados" autocomplete="off" autocorrect="off" spellcheck="false"></span></label><button type="button" class="pulso-minute-go">IR ↗</button><select class="pulso-speed" aria-label="Velocidade do áudio"><option value="1">1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></div><p class="pulso-deck-tip">Para sets grandes: a primeira reprodução pode levar alguns segundos. O player carrega somente os trechos necessários ao avançar.</p>`;
    root.prepend(deck);deck.appendChild(audio);
    const deckImage=deck.querySelector('.pulso-deck-cover-image'), artwork=cover?secureUrl(cover):'';
    if(artwork){deckImage.src=artwork;deckImage.hidden=false;deckImage.parentElement.classList.add('has-record-cover');}
    window.PULSO_BACKGROUND?.bind(audio,{title,artist,cover:artwork});
    const slider=deck.querySelector('.pulso-seek'),playBtn=deck.querySelector('.pulso-big-play');
    const update=()=>{
      const d=audio.duration,t=audio.currentTime;
      deck.querySelector('.pulso-now').textContent=formatAudioTime(t);
      deck.querySelector('.pulso-length').textContent=formatAudioTime(d);
      slider.disabled=!(Number.isFinite(d)&&d>0);
      if(!slider.matches(':active')){
        const fraction=slider.disabled?0:Math.min(1,Math.max(0,t/d));
        slider.value=Math.round(fraction*1000);slider.style.setProperty('--progress',`${fraction*100}%`);
      }
      playBtn.innerHTML=pulsoIcon(audio.paused?'play':'pause');
      deck.classList.toggle('playing',!audio.paused);
    };
    ['timeupdate','durationchange','loadedmetadata','playing','pause','seeking','seeked','ended'].forEach(evt=>audio.addEventListener(evt,update));
    slider.addEventListener('input',()=>{if(Number.isFinite(audio.duration))deck.querySelector('.pulso-now').textContent=formatAudioTime(audio.duration*Number(slider.value)/1000);slider.style.setProperty('--progress',`${slider.value/10}%`);});
    slider.addEventListener('change',()=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(slider.value)/1000;update();});
    playBtn.addEventListener('click',()=>audio.paused?audio.play().catch(()=>toast('Toque para habilitar o áudio.')):audio.pause());
    deck.querySelector('.pulso-mini-back').addEventListener('click',()=>audio.currentTime=Math.max(0,audio.currentTime-15));
    deck.querySelector('.pulso-mini-next').addEventListener('click',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+15);});
    deck.querySelector('.pulso-speed').addEventListener('change',ev=>audio.playbackRate=Number(ev.target.value));
    const seekFields=[deck.querySelector('.pulso-hour'),deck.querySelector('.pulso-minute'),deck.querySelector('.pulso-second')];
    const go=()=>{
      const s=parseSplitTime(...seekFields.map(field=>field.value));
      if(s===null){toast('Informe horas, minutos e segundos válidos.');return;}
      if(!Number.isFinite(audio.duration)||audio.duration<=0){toast('Aguarde carregar a duração do set.');return;}
      audio.currentTime=Math.min(Math.max(0,s),Math.max(0,audio.duration-0.05));
      seekFields.forEach(field=>field.blur());update();
    };
    deck.querySelector('.pulso-minute-go').addEventListener('click',go);
    seekFields.forEach(field=>field.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();go();}}));
    update();
    if(post)window.PULSO5?.onAudioReady?.(post,audio,deck);
  }
  function parseSplitTime(h,m,s){
    const entries=[h,m,s].map(value=>String(value??'').trim());
    if(entries.every(value=>value===''))return null;
    if(entries.some(value=>value!==''&&!/^\d{1,2}$/.test(value)))return null;
    const [hours,minutes,seconds]=entries.map(value=>value===''?0:Number(value));
    if(hours>99||minutes>59||seconds>59)return null;
    return hours*3600+minutes*60+seconds;
  }
  function parseAudioMinute(v){
    const s=String(v).trim();if(!/^\d{1,4}(:[0-5]\d){0,2}$/.test(s))return null;
    const p=s.split(':').map(Number);return p.reduce((acc,v)=>acc*60+v,0);
  }
  function playPost(p) {
    window.PULSO_VIDEO?.pause?.(); // Pausa o vídeo flutuante antes de abrir outra publicação.
    if(p.demo){toast('Exemplo de layout. Publique um link real para ativar o player.');return;}
    if (radioActive) radioPause(); // Ao abrir outra mídia, pausa a rádio sem perder a fila nem o ponto de escuta.
    const url=safeUrl(p.url);if(!url){toast('Esta publicação não tem link válido.');return;}
    const embedInfo=mediaEmbed(url);
    if(!embedInfo){window.open(url,'_blank','noopener,noreferrer');return;}
    window.PULSO5?.onPostOpened?.(p);
    $('playerTitle').textContent=p.title;$('playerArtist').textContent=`${p.artist} · ${p.genre}`;
    $('playerExternal').href=url;
    const youtube=embedInfo.kind==='youtube';
    $('playerExternal').textContent=youtube?'CONTINUAR NO YOUTUBE ↗':'Abrir na plataforma original ↗';
    $('youtubePlayerHint').hidden=!youtube;
    const node=$('embedContainer');node.className=`embed-container ${embedInfo.kind}`;node.replaceChildren();
    if(embedInfo.kind==='chunked-audio'){if(activeLargeAudioPlayer)activeLargeAudioPlayer.dispose();activeLargeAudioPlayer=mountChunkedAudio(url,node);addBeautifulAudioControls(node,activeLargeAudioPlayer.audio,p.title,p.artist,p.cover,p);dialogOpen('playerDialog');return;}
    if(embedInfo.kind==='audio'){const audio=document.createElement('audio');audio.autoplay=true;audio.preload='metadata';audio.crossOrigin='anonymous';audio.src=embedInfo.url;addBeautifulAudioControls(node,audio,p.title,p.artist,p.cover,p);dialogOpen('playerDialog');audio.play().catch(()=>{});return;}
    if(embedInfo.kind==='video'){const video=document.createElement('video');video.controls=true;video.autoplay=true;video.playsInline=false;video.preload='metadata';video.src=embedInfo.url;video.setAttribute('controlsList','nodownload');
      video.addEventListener('error',()=>{
        if(node.querySelector('.mov-fallback'))return;
        const message=document.createElement('p');message.className='mov-fallback';
        message.textContent='Este vídeo não pode ser reproduzido neste navegador. Arquivos MOV do iPhone podem usar HEVC; para assistir em todos os aparelhos, publique uma versão MP4 (H.264). ';
        const a=document.createElement('a');a.href=embedInfo.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir arquivo original ↗';
        message.append(a);node.appendChild(message);
      });node.appendChild(video);dialogOpen('playerDialog');return;}
    const iframe=document.createElement('iframe');iframe.src=embedInfo.url;iframe.title=embedInfo.title;
    iframe.allow='autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture';
    iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;
    node.appendChild(iframe);dialogOpen('playerDialog');
  }
  async function copyText(value) {
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return true;}}catch{}
    const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();let ok=false;
    try{ok=document.execCommand('copy');}catch{}t.remove();return ok;
  }
  async function toggleLike(p) {
    if(!connected){localLikes.has(p.id)?localLikes.delete(p.id):localLikes.add(p.id);store(localLikeKey,[...localLikes]);render();return;}
    if(!user){authDialog();toast('Entre para curtir. Assim sua curtida fica registrada para todos.');return;}
    const already=likes.has(p.id);
    const {error}=already?await sb.from('likes').delete().eq('post_id',p.id).eq('user_id',user.id):await sb.from('likes').insert({post_id:p.id,user_id:user.id});
    if(error){toast(`Não foi possível ${already?'descurtir':'curtir'}: ${errorText(error)}`);return;}
    already?likes.delete(p.id):likes.add(p.id);
    const match=posts.find(row=>row.id===p.id);if(match)match.likes_count=Math.max(0,(match.likes_count||0)+(already?-1:1));render();
  }
  function ownUploadedVideoPath(url) {
    try {
      const u=new URL(url), supa=new URL(config.supabaseUrl);
      const prefix='/storage/v1/object/public/pulso-videos/';
      if(u.origin!==supa.origin || !u.pathname.startsWith(prefix))return '';
      const path=decodeURIComponent(u.pathname.slice(prefix.length));
      return /^[0-9a-f-]{36}\/[0-9a-z-]+\.(mp4|webm|mov)$/i.test(path)?path:'';
    }catch{return '';}
  }
  async function freeOldVideo(url) {
    if(!connected||!user)return;
    const path=ownUploadedVideoPath(url);
    if(!path)return;
    const {error}=await sb.storage.from('pulso-videos').remove([path]);
    if(error)toast('Publicação atualizada, mas o vídeo antigo não pôde ser removido do armazenamento.');
  }
  async function freeOldMedia(url) {
    if(r2Enabled){
      try{
        const origin=new URL(r2Endpoint).origin,u=new URL(url);
        if(u.origin===origin && /^\/media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp3|m4a|wav|aac|ogg|mp4|webm)$/i.test(u.pathname)){
          await r2Fetch('/api/delete',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:u.pathname.slice(1)})});
          return;
        }
      }catch(err){toast('A postagem foi excluída, mas o arquivo no R2 precisa ser removido manualmente.');return;}
    }
    await freeOldVideo(url);
    if(!connected||!user)return;
    const info=ownUploadedAudioInfo(url);if(!info)return;
    const store=sb.storage.from('pulso-audio');
    if(!info.chunked){const {error}=await store.remove([info.path]);if(error)toast('Não foi possível liberar o áudio antigo.');return;}
    const {data,error}=await store.list(info.base,{limit:100});
    if(error){toast('Não foi possível listar as partes do áudio para limpeza.');return;}
    const paths=(data||[]).filter(x=>/^([0-9]{4}\.mp3|manifest\.json)$/.test(x.name)).map(x=>`${info.base}/${x.name}`);
    if(paths.length){const result=await store.remove(paths);if(result.error)toast('O áudio foi removido do feed, mas algumas partes precisam de limpeza no armazenamento.');}
  }
  async function deletePost(p) {
    if(!canDelete(p))return;
    if(!window.confirm(`Excluir definitivamente “${p.title}”?`))return;
    if(connected){
      const {error}=await sb.from('posts').delete().eq('id',p.id);
      if(error){toast(errorText(error));return;}
      await freeOldMedia(p.url);
      await refreshPosts();
    }
    else{posts=posts.filter(row=>row.id!==p.id);store(localKey,posts.filter(row=>!row.demo));render();}
    toast('Publicação excluída.');
  }
  async function changeFeatured(p) {
    if(!connected||!isAdmin)return;
    const {error}=await sb.from('posts').update({featured:!p.featured}).eq('id',p.id);
    if(error)toast(errorText(error));else{await refreshPosts();toast(p.featured?'Destaque removido.':'Adicionado aos destaques LØSI.');}
  }
  async function reportPost(p) {
    if(!connected)return;
    if(!user){authDialog();toast('Entre para denunciar uma publicação.');return;}
    const response=window.prompt('Informe o motivo da denúncia (mínimo 8 caracteres):');
    if(response===null)return;
    const reason=response.trim();if(reason.length<8 || reason.length>500){toast('Escreva um motivo entre 8 e 500 caracteres.');return;}
    const {error}=await sb.from('reports').insert({post_id:p.id,reporter_id:user.id,reason});
    if(error)toast(error.code==='23505'?'Você já denunciou esta música.':errorText(error));
    else toast('Denúncia enviada para a equipe de moderação.');
  }
  async function onCardAction(ev) {
    const button=ev.target.closest('[data-action]');if(!button)return;
    const el=button.closest('[data-id]'),p=posts.find(row=>String(row.id)===el?.dataset.id);if(!p)return;
    switch(button.dataset.action){
      case 'play':playPost(p);break;
      case 'like':await toggleLike(p);break;
      case 'save':saved.has(p.id)?saved.delete(p.id):saved.add(p.id);store(savedKey,[...saved]);render();window.PULSO5?.onLegacySave?.(p.id,saved.has(p.id));toast(saved.has(p.id)?'Adicionado aos salvos.':'Removido dos salvos.');break;
      case 'share':{
        if(p.demo){toast('Publicação de exemplo sem link real.');break;}
        const link=connected?new URL(location.href):null;
        if(link){link.hash='';link.searchParams.set('track',p.id);}
        toast(await copyText(link?link.href:safeUrl(p.url))?'Link copiado!':'Não foi possível copiar o link.');break;
      }
      case 'report':await reportPost(p);break;
      case 'edit':if(isAdmin)openComposer(p);break;
      case 'feature':await changeFeatured(p);break;
      case 'delete':await deletePost(p);break;
    }
  }
  const adminStatusNames={pending:'Aguardando',approved:'Publicadas',rejected:'Recusadas',reports:'Denúncias'};
  async function refreshAdmin() {
    if(!connected||!isAdmin)return;
    if(adminTab==='reports'){
      reportLoading=true;renderAdmin();
      const {data,error}=await sb.from('reports').select('id,post_id,reason,reporter_id,created_at').order('created_at',{ascending:false}).limit(300);
      reports=error?[]:(data||[]);reportLoading=false;
      if(error)toast(errorText(error));
    }
    renderAdmin();
  }
  function renderAdmin() {
    if(!isAdmin)return;
    const counts={pending:posts.filter(p=>p.status==='pending').length,approved:posts.filter(p=>p.status==='approved').length,rejected:posts.filter(p=>p.status==='rejected').length};
    $('adminStats').innerHTML=`<span><strong>${counts.pending}</strong>Pendentes</span><span><strong>${counts.approved}</strong>Publicadas</span><span><strong>${counts.rejected}</strong>Recusadas</span>`;
    document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===adminTab));
    if(adminTab==='reports'){
      $('adminList').innerHTML=reportLoading?'<p class="admin-empty">Carregando denúncias…</p>':reports.length?reports.map(r=>{
        const p=posts.find(post=>post.id===r.post_id);
        return `<div class="admin-item" data-report-id="${e(r.id)}"><div class="admin-item-head"><strong>${e(p?.title||'Publicação removida')}</strong><small>${e(new Date(r.created_at).toLocaleString('pt-BR'))}</small></div><p>${e(r.reason)}</p><div class="admin-item-actions"><button type="button" data-admin-action="dismiss">Dispensar denúncia</button>${p?`<button type="button" data-admin-action="report-delete" data-post-id="${e(p.id)}" class="danger">Excluir música</button>`:''}</div></div>`;
      }).join(''):'<p class="admin-empty">Nenhuma denúncia registrada.</p>';
      return;
    }
    const match=posts.filter(p=>p.status===adminTab);
    $('adminList').innerHTML=match.length?match.map(p=>`<div class="admin-item" data-id="${e(p.id)}"><div class="admin-item-head"><strong>${e(p.title)}</strong><small>${e(dateLabel(p))} • ${e(p.genre)}</small></div><p>${e(p.artist)} — ${e(p.description||'Sem descrição')}</p><a href="${e(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">Abrir publicação ↗</a><div class="admin-item-actions">${adminTab!=='approved'?'<button data-admin-action="approve" type="button" class="approve">Aprovar ✓</button>':''}${adminTab!=='rejected'?'<button data-admin-action="reject" type="button">Recusar ✕</button>':''}<button data-admin-action="edit" type="button">Editar ✎</button>${adminTab==='approved'?`<button data-admin-action="feature" type="button">${p.featured?'Remover destaque':'Destacar ★'}</button>`:''}<button data-admin-action="delete" type="button" class="danger">Excluir</button></div></div>`).join(''):`<p class="admin-empty">Nenhuma música em “${adminStatusNames[adminTab]}”.</p>`;
  }
  async function changeStatus(p,status) {
    if(!connected||!isAdmin)return;
    const {error}=await sb.from('posts').update({status,featured:status==='approved'?p.featured:false}).eq('id',p.id);
    if(error){toast(errorText(error));return;}
    await refreshPosts();
    if(status==='approved'&&['DJ Set','Vídeo DJ Set'].includes(p.type))window.PULSO_NOTIFICATIONS?.notifyPublishedSet?.(p.id);
    toast(status==='approved'?'Música aprovada e publicada!':'Música recusada.');
  }
  async function onAdminAction(ev) {
    const b=ev.target.closest('[data-admin-action]');if(!b||!isAdmin)return;
    const item=b.closest('[data-id]'),p=posts.find(row=>row.id===item?.dataset.id);
    switch(b.dataset.adminAction){
      case 'approve':if(p)await changeStatus(p,'approved');break;
      case 'reject':if(p)await changeStatus(p,'rejected');break;
      case 'feature':if(p)await changeFeatured(p);break;
      case 'edit':if(p)openComposer(p);break;
      case 'delete':if(p)await deletePost(p);break;
      case 'dismiss':{
        const reportId=b.closest('[data-report-id]')?.dataset.reportId;
        if(!reportId)return;
        const {error}=await sb.from('reports').delete().eq('id',reportId);
        if(error)toast(errorText(error));else{reports=reports.filter(r=>r.id!==reportId);renderAdmin();toast('Denúncia dispensada.');}
        break;
      }
      case 'report-delete':{
        const related=posts.find(row=>row.id===b.dataset.postId);
        if(related){await deletePost(related);await refreshAdmin();}break;
      }
    }
  }
  async function importBackup(ev) {
    const file=ev.target.files[0];ev.target.value='';if(!file||!isAdmin||!connected||!user)return;
    if(file.size>2*1024*1024){toast('O arquivo deve ter no máximo 2 MB.');return;}
    try {
      const json=JSON.parse(await file.text()),entries=Array.isArray(json)?json:json.posts;
      if(!Array.isArray(entries)||entries.length<1||entries.length>150)throw new Error('Backup precisa ter entre 1 e 150 posts.');
      const rows=entries.map(p=>{
        const url=secureUrl(p.url),cover=p.cover?secureUrl(p.cover):null;
        if(!p.title||!p.artist||!url||!genres.includes(p.genre)||p.genre==='Todos'||(p.cover&&!cover))return null;
        return {owner_id:user.id,title:String(p.title).trim().slice(0,90),artist:String(p.artist).trim().slice(0,60),genre:p.genre,type:['Faixa','DJ Set','Playlist','Videoclipe','Vídeo DJ Set','Live'].includes(p.type)?p.type:'Faixa',url,cover,description:String(p.description||'').slice(0,220),status:'approved'};
      });
      if(rows.some(r=>!r))throw new Error('O backup contém links inválidos ou gêneros desconhecidos. Use somente links HTTPS.');
      if(!window.confirm(`Importar ${rows.length} postagens como aprovadas?`))return;
      const {error}=await sb.from('posts').insert(rows);if(error)throw error;
      await refreshPosts();toast(`${rows.length} postagens antigas importadas!`);
    }catch(error){toast(`Não foi possível importar: ${errorText(error)}`);}
  }
  function exportPosts() {
    const own=posts.filter(isMine).map(p=>({title:p.title,artist:p.artist,genre:p.genre,type:p.type,url:p.url,cover:p.cover,description:p.description,timestamp:p.created_at}));
    if(!own.length){toast('Você ainda não tem postagens para exportar.');return;}
    const blob=new Blob([JSON.stringify({platform:'PULSO by LØSI',exportedAt:new Date().toISOString(),posts:own},null,2)],{type:'application/json;charset=utf-8'});
    const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='pulso-backup-postagens.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Backup exportado.');
  }

  // ============================================================================
  // PULSO RADIO — sequenciador local das músicas publicadas, sem stream 24h global.
  // SoundCloud: Widget FINISH; YouTube: IFrame ENDED; arquivos de áudio: ended.
  // Spotify usa o player incorporado, sem promessa de troca automática.
  // ============================================================================
  let radioActive=false, radioPaused=false, radioShuffle=true, radioGenre='Todos', radioDockMinimized=false;
  let radioQueue=[], radioIndex=-1, radioEpoch=0, radioEngine=null;
  let radioTimeDrag=false,radioDurationKnown=0,radioCurrentKnown=0;
  let radioResumePoint=null,radioLastPersist=0;
  function playbackStorageKey(kind){
    const account=user?.id||window.PULSO_APP?.user?.()?.id;
    return 'pulso-playback-'+kind+'-v1'+(account?'-'+String(account).replace(/[^a-z0-9_-]/gi,''):'-local');
  }
  function readPlayback(kind){
    try{return JSON.parse(localStorage.getItem(playbackStorageKey(kind))||'null');}catch{return null;}
  }
  function saveRadioPlayback(force=false){
    if(!radioActive||!radioQueue[radioIndex])return;
    if(!force&&Date.now()-radioLastPersist<5000)return;
    radioLastPersist=Date.now();
    const item=radioQueue[radioIndex];
    const state={id:String(item.id),title:item.title||'',artist:item.artist||'',time:Math.max(0,Number(radioCurrentKnown)||0),savedAt:Date.now()};
    try{localStorage.setItem(playbackStorageKey('radio'),JSON.stringify(state));}catch{}
    window.PULSO_PLAYBACK_CLOUD?.save?.('radio',state);
  }
  function applyRadioResume(engine){
    if(!radioResumePoint||!engine)return;
    const point=Math.max(0,Number(radioResumePoint.time)||0);
    if(point<3){radioResumePoint=null;return;}
    try{
      if(engine.kind==='audio'&&engine.player.readyState>=1)engine.player.currentTime=point;
      else if(engine.kind==='youtube'&&engine.player.getDuration?.()>point)engine.player.seekTo(point,true);
      else if(engine.kind==='soundcloud')engine.player.seekTo(Math.round(point*1000));
      else return;
      radioCurrentKnown=point;radioResumePoint=null;radioRefreshTime();
    }catch{}
  }
  function radioSeekEnabled(){return radioActive && !['spotify'].includes(radioEngine?.kind) && !!radioEngine && Number.isFinite(radioDurationKnown) && radioDurationKnown>0;}
  function radioDrawTimeline(){
    const ok=radioSeekEnabled();
    const slider=$('radioSeek');slider.disabled=!ok;
    $('radioBack15').disabled=!ok;$('radioForward15').disabled=!ok;
    $('radioHour').disabled=!ok;$('radioMinute').disabled=!ok;$('radioSecond').disabled=!ok;$('radioGoMinute').disabled=!ok;
    $('radioSpeed').disabled=!radioEngine||!['audio','youtube'].includes(radioEngine.kind);
    $('radioElapsed').textContent=formatAudioTime(radioCurrentKnown);
    $('radioDuration').textContent=formatAudioTime(radioDurationKnown);
    if(!radioTimeDrag){const frac=ok?Math.max(0,Math.min(1,radioCurrentKnown/radioDurationKnown)):0;slider.value=Math.round(frac*1000);slider.style.setProperty('--progress',`${frac*100}%`);}
    $('radioSeekGroup').classList.toggle('disabled',!ok);
  }
  function radioApplySeek(seconds){
    if(!radioSeekEnabled())return;
    const target=Math.min(Math.max(0,seconds),Math.max(0,radioDurationKnown-0.05));
    try {
      const engine=radioEngine;
      if(engine.kind==='audio')engine.player.currentTime=target;
      else if(engine.kind==='youtube')engine.player.seekTo(target,true);
      else if(engine.kind==='soundcloud')engine.player.seekTo(Math.round(target*1000));
      radioCurrentKnown=target;radioDrawTimeline();
    }catch(err){toast('Não foi possível avançar nesta plataforma.');console.warn(err);}
  }
  function radioRefreshTime(){
    if(!radioActive||!radioEngine)return;
    try{
      const engine=radioEngine;
      if(engine.kind==='audio'){
        const a=engine.player;
        if(Number.isFinite(a.duration)&&a.duration>0)radioDurationKnown=a.duration;
        if(Number.isFinite(a.currentTime))radioCurrentKnown=a.currentTime;
      }else if(engine.kind==='youtube'){
        const d=engine.player.getDuration?.(),t=engine.player.getCurrentTime?.();
        if(d>0)radioDurationKnown=d;if(Number.isFinite(t))radioCurrentKnown=t;
      }else if(engine.kind==='soundcloud'){
        engine.player.getDuration?.(ms=>{if(radioEngine===engine && ms>0){radioDurationKnown=ms/1000;radioDrawTimeline();}});
        engine.player.getPosition?.(ms=>{if(radioEngine===engine&&Number.isFinite(ms)){radioCurrentKnown=ms/1000;radioDrawTimeline();}});
      }
      if(radioResumePoint)applyRadioResume(engine);
      radioDrawTimeline();
      saveRadioPlayback();
    }catch(err){console.warn('Tempo da faixa indisponível',err);}
  }
  let youtubeReadyPromise=null, radioFailures=0;

  function radioSource(post) {
    const url=safeUrl(post?.url);
    if (!url) return null;
    let path;
    try {path=new URL(url).pathname;}catch{return null;}
    if (ownUploadedAudioInfo(url)?.chunked)return {kind:'chunked-audio',url,link:url};
    if (/\.(mp3|m4a|aac|ogg|oga|wav|flac)$/i.test(path)) return {kind:'audio',url,link:url};
    const embedded=mediaEmbed(url);
    if (!embedded || embedded.kind==='video' || embedded.kind==='vimeo') return null; // MP4 e Vimeo ficam no feed, não interrompem a rádio.
    if (embedded.kind==='youtube') {
      const video=embedded.url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (!video) return null;
      return {kind:'youtube',videoId:video[1],link:url};
    }
    return {...embedded,link:url};
  }
  function radioCandidates() {
    return posts.filter(p => p.status==='approved' && !p.demo &&
      (radioGenre==='Todos' || p.genre===radioGenre) && radioSource(p));
  }
  function radioRandomize(list) {
    const out=[...list];
    if(radioShuffle)for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    else out.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return out;
  }
  // A rádio toca primeiro os arquivos de áudio diretos/armazenados, depois
  // fontes de áudio externas e deixa os sets do YouTube para a segunda etapa.
  function radioOrdered(list) {
    const files=[], externalAudio=[], youtube=[], other=[];
    for(const p of list){
      const kind=radioSource(p)?.kind;
      if(kind==='audio'||kind==='chunked-audio')files.push(p);
      else if(kind==='youtube')youtube.push(p);
      else if(kind==='soundcloud')externalAudio.push(p);
      else other.push(p);
    }
    return [...radioRandomize(files),...radioRandomize(externalAudio),...radioRandomize(other),...radioRandomize(youtube)];
  }
  function radioStatus(message) { $('radioStatus').textContent=message; }
  function radioUpdateUI() {
    $('radioDock').hidden=!radioActive;
    const currentlyPlaying=radioActive && !radioPaused;
    document.querySelector('.hero-visual').classList.toggle('is-radio-playing',currentlyPlaying);
    $('vinylRadioToggle').setAttribute('aria-pressed',String(currentlyPlaying));
    $('vinylRadioToggle').setAttribute('aria-label',!radioActive?'Ligar a Rádio PULSO no disco giratório':radioPaused?'Retomar a Rádio PULSO':'Pausar a Rádio PULSO');
    $('vinylRadioLabel').innerHTML=(radioActive&&!radioPaused?pulsoIcon('pause'):pulsoIcon('play'))+' '+(!radioActive?'OUVIR RÁDIO':radioPaused?'RETOMAR RÁDIO':'PAUSAR RÁDIO');
    $('waveRadioTitle').textContent=currentlyPlaying?'RÁDIO LIGADA.':radioActive?'RÁDIO PAUSADA.':'SINTONIZE.';
    $('waveRadioSubtitle').textContent=radioActive?'PULSO × LØSI':'APERTE PARA OUVIR A RÁDIO';
    $('waveRadioToggle').setAttribute('aria-label',radioActive?(radioPaused?'Retomar a rádio':'Pausar a rádio'):'Ligar a Rádio PULSO');
    $('radioToggle').innerHTML=pulsoIcon(radioPaused?'play':'pause');
    $('radioToggle').setAttribute('aria-label',radioPaused?'Retomar a rádio':'Pausar a rádio');
    const item=radioQueue[radioIndex], spotify=item && radioSource(item)?.kind==='spotify';
    $('radioToggle').disabled=!!spotify;
    $('radioToggle').title=spotify?'Use play/pausa dentro do Spotify':'Tocar / Pausar';
    $('radioCount').textContent=radioQueue.length+' '+(radioQueue.length===1?'MÚSICA':'MÚSICAS');
    $('radioMiniTitle').textContent=radioQueue[radioIndex]?.title||'Sua frequência';
    $('radioDock').classList.toggle('is-minimized',radioActive&&radioDockMinimized);
    $('radioMinimize').innerHTML=radioDockMinimized?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
    $('radioMinimize').setAttribute('aria-label',radioDockMinimized?'Expandir rádio':'Minimizar rádio');
    $('radioMinimize').title=radioDockMinimized?'Expandir rádio':'Minimizar rádio';
    $('radioShuffle').setAttribute('aria-pressed',String(radioShuffle));
    $('radioShuffle').setAttribute('aria-label',radioShuffle?'Desativar modo aleatório':'Ativar modo aleatório');
  }
  function radioDispose() {
    window.PULSO_BACKGROUND?.clear();
    radioEpoch++; // invalida callbacks do player anterior
    if (radioEngine) {
      try {
        if(radioEngine.kind==='youtube')radioEngine.player.destroy();
        else if(radioEngine.kind==='soundcloud')radioEngine.player.pause();
        else if(radioEngine.kind==='audio')radioEngine.player.pause();
      } catch(e) {console.warn('Rádio: limpeza do player:',e);}
    }
    if(radioEngine?.dispose)radioEngine.dispose();
    radioEngine=null;
    $('radioEmbed').replaceChildren();
    $('radioEmbed').classList.remove('is-audio');
    radioDurationKnown=0;radioCurrentKnown=0;radioTimeDrag=false;
    $('radioSpeed').value='1';radioDrawTimeline();
  }
  function radioStop() {
    radioDispose();radioActive=false;radioPaused=false;radioDockMinimized=false;radioIndex=-1;radioQueue=[];
    setArtwork('heroRecordCover','');setArtwork('radioCoverImage','');
    radioUpdateUI();
  }
  function radioSync() {
    if(!radioActive)return;
    const candidates=radioCandidates();
    const current=radioQueue[radioIndex]?.id;
    const byId=new Map(candidates.map(p=>[String(p.id),p]));
    const keep=radioQueue.filter(p=>byId.has(String(p.id))).map(p=>byId.get(String(p.id)));
    const known=new Set(keep.map(p=>String(p.id)));
    const added=radioOrdered(candidates.filter(p=>!known.has(String(p.id))));
    radioQueue=[...keep,...added];
    if(!radioQueue.length){radioStop();toast('A rádio ainda não tem músicas aprovadas para reproduzir.');return;}
    const nextIndex=radioQueue.findIndex(p=>String(p.id)===String(current));
    if(nextIndex<0)radioSelect(0);
    else {radioIndex=nextIndex;radioUpdateUI();}
  }
  function radioStart() {
    window.PULSO_VIDEO?.pause?.(); // Rádio e vídeo não devem tocar simultaneamente.
    radioQueue=radioOrdered(radioCandidates());
    if(!radioQueue.length){toast('Ainda não há faixas reproduzíveis aprovadas. Publique um link do SoundCloud, YouTube, Spotify ou MP3.');return;}
    const saved=readPlayback('radio');
    const savedIndex=saved?radioQueue.findIndex(p=>String(p.id)===String(saved.id)):-1;
    radioResumePoint=savedIndex>=0&&Number(saved.time)>0?saved:null;
    dialogClose('playerDialog');$('embedContainer').replaceChildren();
    radioActive=true;radioPaused=false;radioFailures=0;radioIndex=savedIndex>=0?savedIndex:0;
    radioSelect(radioIndex);
  }
  function radioPause() {
    if(!radioActive||radioPaused)return;
    saveRadioPlayback(true);
    const source=radioSource(radioQueue[radioIndex]);
    if(source?.kind==='spotify'){toast('Use o botão de pausa dentro do player do Spotify.');return;}
    radioPaused=true;
    try {
      if(radioEngine?.kind==='youtube')radioEngine.player.pauseVideo();
      if(radioEngine?.kind==='soundcloud')radioEngine.player.pause();
      if(radioEngine?.kind==='audio')radioEngine.player.pause();
    }catch(e){console.warn(e);}
    radioStatus('Pausado. Aperte play para retomar.');radioUpdateUI();
  }
  function radioResume() {
    if(!radioActive||!radioPaused)return;
    window.PULSO_VIDEO?.pause?.();
    const source=radioSource(radioQueue[radioIndex]);
    if(source?.kind==='spotify'){toast('Use o botão play dentro do Spotify.');return;}
    radioPaused=false;
    try {
      if(radioEngine?.kind==='youtube')radioEngine.player.playVideo();
      if(radioEngine?.kind==='soundcloud')radioEngine.player.play();
      if(radioEngine?.kind==='audio')radioEngine.player.play().catch(()=>radioStatus('Use ▶ no player para permitir reprodução.'));
    }catch(e){console.warn(e);}
    radioStatus('Tentando reproduzir…');radioUpdateUI();
  }
  function radioToggle() {
    if(radioActive&&radioDockMinimized){radioDockMinimized=false;radioUpdateUI();return;}
    if(!radioActive){radioStart();return;}
    if(radioPaused)radioResume();else radioPause();
  }
  function radioNext(automatic=false) {
    if(!radioActive || !radioQueue.length)return;
    let index=(radioIndex+1)%radioQueue.length;
    if(automatic){
      // O Spotify não oferece troca de faixa universalmente garantida em embeds.
      // Mantenha-o selecionável manualmente e preserve a sequência automática dos demais.
      for(let i=0;i<radioQueue.length;i++){
        if(radioSource(radioQueue[index])?.kind!=='spotify')break;
        index=(index+1)%radioQueue.length;
      }
    }else radioFailures=0;
    radioSelect(index);
  }
  function radioPrevious() {
    if(!radioActive || !radioQueue.length)return;
    radioFailures=0;
    radioSelect((radioIndex-1+radioQueue.length)%radioQueue.length);
  }
  function radioSkipError(epoch) {
    if(epoch!==radioEpoch || !radioActive)return;
    radioFailures++;
    if(radioFailures>=radioQueue.length){radioPaused=true;radioStatus('Não foi possível reproduzir a seleção. Tente avançar ou abra a plataforma.');radioUpdateUI();return;}
    radioNext(true);
  }
  function radioYouTubeAPI() {
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(youtubeReadyPromise)return youtubeReadyPromise;
    youtubeReadyPromise=new Promise((resolve,reject)=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{if(typeof previous==='function')previous();resolve(window.YT);};
      const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.async=true;
      tag.onerror=()=>{youtubeReadyPromise=null;reject(new Error('API do YouTube indisponível'));};
      document.head.appendChild(tag);
    });
    return youtubeReadyPromise;
  }
  async function radioSelect(index) {
    radioDispose();
    if(!radioActive||!radioQueue.length)return;
    radioIndex=((index%radioQueue.length)+radioQueue.length)%radioQueue.length;
    radioPaused=false;
    const p=radioQueue[radioIndex],src=radioSource(p), epoch=radioEpoch;
    if(!src){radioSkipError(epoch);return;}
    $('radioTitle').textContent=p.title;
    $('radioArtist').textContent=p.artist+' · '+p.genre;
    setArtwork('heroRecordCover',p.cover);setArtwork('radioCoverImage',p.cover);
    $('radioExternal').href=src.link;
    $('radioExternal').textContent=src.kind==='youtube'?'YOUTUBE ↗':'ABRIR ↗';
    $('radioExternal').title=src.kind==='youtube'?'Continuar no app YouTube; segundo plano depende do Premium':'Ouvir na plataforma original';
    radioStatus('Carregando player…');
    radioUpdateUI();
    const container=$('radioEmbed');
    if(src.kind==='chunked-audio'){
      const handle=mountChunkedAudio(src.url,container,{
        playing:()=>{if(epoch===radioEpoch){radioFailures=0;radioPaused=false;radioStatus('No ar • DJ set MP3');radioUpdateUI();}},
        ended:()=>{if(epoch===radioEpoch)radioNext(true);},
        error:()=>{if(epoch===radioEpoch)radioSkipError(epoch);},
        pause:()=>{if(epoch===radioEpoch){radioPaused=true;radioUpdateUI();}}
      });
      radioEngine={kind:'audio',player:handle.audio,dispose:handle.dispose};
      window.PULSO5?.onAudioReady?.(p,handle.audio,null,{radio:true});
      window.PULSO_BACKGROUND?.bind(handle.audio,{title:p.title,artist:p.artist,cover:p.cover,previous:radioPrevious,next:()=>radioNext()});
      handle.audio.controls=false;handle.audio.classList.add('pulso-native-audio');container.classList.add('is-audio');
      handle.audio.addEventListener('loadedmetadata',radioRefreshTime);
      handle.audio.addEventListener('durationchange',radioRefreshTime);
      handle.audio.addEventListener('timeupdate',radioRefreshTime);
      handle.audio.addEventListener('loadedmetadata',()=>applyRadioResume(radioEngine));
      return;
    }
    if(src.kind==='audio'){
      const audio=document.createElement('audio');audio.controls=true;audio.autoplay=true;audio.preload='metadata';audio.crossOrigin='anonymous';audio.src=src.url;
      audio.addEventListener('playing',()=>{if(epoch!==radioEpoch)return;radioFailures=0;radioPaused=false;radioStatus('No ar • áudio direto');radioUpdateUI();});
      audio.addEventListener('pause',()=>{if(epoch!==radioEpoch||audio.ended)return;radioPaused=true;radioUpdateUI();});
      audio.addEventListener('ended',()=>{if(epoch===radioEpoch)radioNext(true);});
      audio.addEventListener('error',()=>{if(epoch===radioEpoch)radioSkipError(epoch);});
      radioEngine={kind:'audio',player:audio};
      window.PULSO5?.onAudioReady?.(p,audio,null,{radio:true});
      window.PULSO_BACKGROUND?.bind(audio,{title:p.title,artist:p.artist,cover:p.cover,previous:radioPrevious,next:()=>radioNext()});container.classList.add('is-audio');audio.controls=false;audio.classList.add('pulso-native-audio');container.appendChild(audio);
      ['loadedmetadata','durationchange','timeupdate','seeked'].forEach(evt=>audio.addEventListener(evt,radioRefreshTime));
      audio.addEventListener('loadedmetadata',()=>applyRadioResume(radioEngine));
      audio.play().catch(()=>{if(epoch===radioEpoch)radioStatus('Clique em ▶ no player para liberar o áudio.');});
      return;
    }
    if(src.kind==='youtube'){
      const holder=document.createElement('div');holder.className='radio-youtube-holder';container.appendChild(holder);
      try {
        const yt=await radioYouTubeAPI();
        if(epoch!==radioEpoch)return;
        const player=new yt.Player(holder,{
          height:'205',width:'100%',videoId:src.videoId,
          playerVars:{autoplay:1,playsinline:1,rel:0,controls:1},
          events:{
            onReady:()=>{if(epoch!==radioEpoch)return;applyRadioResume(radioEngine);if(!radioPaused)player.playVideo();radioStatus('YouTube • se não iniciar, toque no vídeo.');},
            onStateChange:ev=>{
              if(epoch!==radioEpoch)return;
              if(ev.data===0)radioNext(true);
              else if(ev.data===1){radioFailures=0;radioPaused=false;radioStatus('No ar • YouTube');radioUpdateUI();}
              else if(ev.data===2){radioPaused=true;radioStatus('YouTube pausado');radioUpdateUI();}
            },
            onError:()=>radioSkipError(epoch)
          }
        });
        radioEngine={kind:'youtube',player};radioDrawTimeline();
      }catch(err){if(epoch===radioEpoch){radioStatus('YouTube indisponível. Use o link externo ou avance.');console.warn(err);}}
      return;
    }
    const iframe=document.createElement('iframe');iframe.src=src.url;iframe.title='Rádio PULSO • '+p.title;
    iframe.allow='autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture';
    iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;
    iframe.loading='eager';iframe.setAttribute('scrolling','no');
    container.appendChild(iframe);
    if(src.kind==='spotify'){
      radioStatus('Spotify • inicie no player e use ⏭ para avançar.');
      radioUpdateUI();return;
    }
    if(src.kind==='soundcloud'){
      if(!window.SC?.Widget){radioStatus('SoundCloud • clique no player; avance manualmente.');return;}
      try{
        const widget=window.SC.Widget(iframe);
        radioEngine={kind:'soundcloud',player:widget};radioDrawTimeline();
        widget.bind(window.SC.Widget.Events.READY,()=>{
          if(epoch!==radioEpoch)return;
          if(!radioPaused)widget.play();
          radioStatus('SoundCloud • se não iniciar, aperte ▶ no player.');
        });
        widget.bind(window.SC.Widget.Events.FINISH,()=>{if(epoch===radioEpoch)radioNext(true);});
        widget.bind(window.SC.Widget.Events.PLAY,()=>{if(epoch!==radioEpoch)return;radioFailures=0;radioPaused=false;radioStatus('No ar • SoundCloud');radioUpdateUI();});
        widget.bind(window.SC.Widget.Events.PAUSE,()=>{if(epoch!==radioEpoch)return;radioPaused=true;radioStatus('SoundCloud pausado');radioUpdateUI();});
        widget.bind(window.SC.Widget.Events.ERROR,()=>radioSkipError(epoch));
      }catch(err){radioStatus('SoundCloud • use o player incorporado.');console.warn(err);}
    }
  }
  function wireRadioEvents() {
    const seek=$('radioSeek');
    seek.addEventListener('input',()=>{radioTimeDrag=true;seek.style.setProperty('--progress',`${seek.value/10}%`);if(radioDurationKnown>0)$('radioElapsed').textContent=formatAudioTime(radioDurationKnown*Number(seek.value)/1000);});
    seek.addEventListener('change',()=>{const seconds=radioDurationKnown*Number(seek.value)/1000;radioTimeDrag=false;radioApplySeek(seconds);});
    $('radioBack15').addEventListener('click',()=>radioApplySeek(radioCurrentKnown-15));
    $('radioForward15').addEventListener('click',()=>radioApplySeek(radioCurrentKnown+15));
    const radioSeekFields=[$('radioHour'),$('radioMinute'),$('radioSecond')];
    const go=()=>{
      const seconds=parseSplitTime(...radioSeekFields.map(field=>field.value));
      if(seconds===null){toast('Digite horas, minutos e segundos válidos.');return;}
      radioApplySeek(seconds);
      radioSeekFields.forEach(field=>field.blur());
    };
    $('radioGoMinute').addEventListener('click',go);
    radioSeekFields.forEach(field=>field.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();go();}}));
    $('radioSpeed').addEventListener('change',ev=>{
      const rate=Number(ev.target.value);
      if(radioEngine?.kind==='audio')radioEngine.player.playbackRate=rate;
      else if(radioEngine?.kind==='youtube')radioEngine.player.setPlaybackRate?.(rate);
    });
    window.setInterval(radioRefreshTime,650);
    $('vinylRadioToggle').addEventListener('click',radioToggle);
    $('waveRadioToggle').addEventListener('click',radioToggle);
    $('radioToggle').addEventListener('click',radioToggle);
    $('radioClose').addEventListener('click',radioStop);
    $('radioMinimize').addEventListener('click',()=>{radioDockMinimized=!radioDockMinimized;radioUpdateUI();});
    window.addEventListener('pagehide',()=>saveRadioPlayback(true));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveRadioPlayback(true);});
    $('radioNext').addEventListener('click',()=>radioNext());
    $('radioPrev').addEventListener('click',radioPrevious);
    $('radioShuffle').addEventListener('click',()=>{
      radioShuffle=!radioShuffle;
      if(radioActive){const current=radioQueue[radioIndex];radioQueue=[current,...radioRandomize(radioQueue.filter(p=>p.id!==current.id))];radioIndex=0;}
      radioUpdateUI();
    });
    $('radioGenre').addEventListener('change',ev=>{
      radioGenre=ev.target.value;
      if(!radioActive)return;
      radioQueue=radioRandomize(radioCandidates());
      if(!radioQueue.length){radioStop();toast('Não há músicas desse estilo na rádio ainda.');return;}
      radioFailures=0;radioSelect(0);
    });
    radioUpdateUI();
  }

  function wireEvents() {
    $('cardsGrid').addEventListener('click',onCardAction);
    $('genreFilters').addEventListener('click',ev=>{const b=ev.target.closest('[data-genre]');if(b){activeGenre=b.dataset.genre;render();}});
    $('genreFilters').addEventListener('change',ev=>{if(ev.target.id==='genreMoreFilter'&&ev.target.value){activeGenre=ev.target.value;render();}});
    $('mediaFilters').addEventListener('click',ev=>{const b=ev.target.closest('[data-media]');if(b){mediaFilter=b.dataset.media;render();}});
    $('postType').addEventListener('change',updateComposerMedia);
    $('postAudioFile').addEventListener('change',()=>{
      updateComposerMedia();
      const file=$('postAudioFile').files[0];if(!file)return;
      const kind=audioFileKind(file),mb=(file.size/1048576).toFixed(1);
      if(!kind || !file.size || file.size>audioMaxBytes || (file.size>audioSmallBytes && kind.ext!=='mp3')){
        $('formError').textContent='Arquivo incompatível ou maior que o permitido. MP3 até 400 MB; demais formatos até 48 MB.';
      }else{
        $('formError').textContent='';
        $('audioUploadHint').textContent=`Selecionado: ${file.name} (${mb} MB). ${file.size>audioSmallBytes?'O upload será dividido em partes de 8 MB. ':''}Basta preencher o título e publicar.`;
      }
    });
    $('postVideoFile').addEventListener('change',()=>{
    updateComposerMedia();
    const file=$('postVideoFile').files[0];
    if(!file)return;
    const mb=(file.size/1048576).toFixed(1);
    if(!videoFileKind(file)){
      $('formError').textContent='Selecione MP4, MOV do iPhone ou WebM.';
      return;
    }
    if(file.size>(useR2()?videoR2Bytes:videoBytesLimit)){
      $('formError').textContent=useR2()?'O vídeo ultrapassa 2 GB no Cloudflare R2.':`O vídeo tem ${mb} MB e ultrapassa ${allowedUploadMB} MB do Supabase. Use YouTube ou entre como administrador para usar o R2.`;
      $('videoUploadHint').textContent='Arquivo muito grande para o armazenamento atual.';
    }else{
      $('formError').textContent='';
      $('videoUploadHint').textContent=videoFileKind(file)?.ext==='mov'?`MOV selecionado: ${file.name} (${mb} MB). Se for HEVC, a reprodução pode ficar restrita a aparelhos compatíveis.`:`Selecionado da galeria: ${file.name} (${mb} MB). Agora basta preencher o título e publicar.`;
    }
  });
    $('searchInput').addEventListener('input',ev=>{query=ev.target.value.trim().toLocaleLowerCase('pt-BR');render();});
    $('sortSelect').addEventListener('change',ev=>{sort=ev.target.value;render();});
    $('myPostsButton').addEventListener('click',()=>{if(connected&&!user){authDialog();return;}setMode(mode==='mine'?'all':'mine');});
    $('refreshPosts').addEventListener('click',()=>{refreshPosts().then(()=>toast(connected?'Feed atualizado.':'Prévia local atualizada.'));});
    document.querySelectorAll('[data-nav]').forEach(a=>a.addEventListener('click',()=>{
      if(a.dataset.nav==='sobre')document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav==='sobre'));
      else setMode(a.dataset.nav==='novidades'?'recent':a.dataset.nav==='salvos'?'saved':'all');
      $('mobileNav').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');
    }));
    $('menuToggle').addEventListener('click',()=>{const open=$('mobileNav').classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open));});
    for(const id of ['openComposer','heroPublish','bannerPublish','emptyPublish','mobilePublish'])$(id).addEventListener('click',()=>{openComposer();$('mobileNav').classList.remove('open');});
    for(const id of ['closeComposer','cancelComposer'])$(id).addEventListener('click',closeComposer);
    $('composerDialog').addEventListener('click',ev=>{if(ev.target===$('composerDialog'))closeComposer();});
    $('postForm').addEventListener('submit',submitPost);
    $('closePlayer').addEventListener('click',()=>dialogClose('playerDialog'));
    $('playerDialog').addEventListener('click',ev=>{if(ev.target===$('playerDialog'))dialogClose('playerDialog');});
    $('playerDialog').addEventListener('close',()=>{window.PULSO5?.onPlayerClosed?.();window.PULSO_BACKGROUND?.clear();if(activeLargeAudioPlayer){activeLargeAudioPlayer.dispose();activeLargeAudioPlayer=null;}$('embedContainer').replaceChildren();});
    $('accountButton').addEventListener('click',authDialog);
    $('mobileAccount').addEventListener('click',()=>{authDialog();$('mobileNav').classList.remove('open');});
    $('closeAuth').addEventListener('click',()=>dialogClose('authDialog'));
    $('authDialog').addEventListener('click',ev=>{if(ev.target===$('authDialog'))dialogClose('authDialog');});
    $('loginTab').addEventListener('click',()=>setAuthMode('login'));
    $('signupTab').addEventListener('click',()=>setAuthMode('signup'));
    $('authForm').addEventListener('submit',submitAuth);
    $('forgotPassword').addEventListener('click',async()=>{
      const email=$('authEmail').value.trim();if(!email){$('authError').textContent='Preencha o seu e-mail primeiro.';return;}
      $('authError').textContent='';
      try{const captcha=window.PULSO_SECURITY?.captchaToken?.();
        if(window.PULSO_SECURITY?.captchaRequired?.()&&!captcha)throw new Error('Conclua a verificação de segurança.');
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname,captchaToken:captcha||undefined});
        if(error)throw error;
        $('authError').textContent='Se esse e-mail estiver cadastrado, você receberá orientações para redefinir a senha.';
      }catch(err){$('authError').textContent=errorText(err);}finally{window.PULSO_SECURITY?.resetCaptcha?.();}
    });
    $('resendConfirmation').addEventListener('click',async()=>{
      const email=$('authEmail').value.trim();if(!email){$('authError').textContent='Preencha o seu e-mail primeiro.';return;}
      $('authError').textContent='';
      try{const captcha=window.PULSO_SECURITY?.captchaToken?.();
        if(window.PULSO_SECURITY?.captchaRequired?.()&&!captcha)throw new Error('Conclua a verificação de segurança.');
        const {error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:location.origin+location.pathname,captchaToken:captcha||undefined}});
        if(error)throw error;
        $('authError').textContent='Se houver confirmação pendente, um novo e-mail será enviado.';
      }catch(err){$('authError').textContent=errorText(err);}finally{window.PULSO_SECURITY?.resetCaptcha?.();}
    });
    $('logoutButton').addEventListener('click',async()=>{
      if(!connected)return;
      const {error}=await sb.auth.signOut();if(error){toast(errorText(error));return;}
      user=null;isAdmin=false;likes=new Set();dialogClose('authDialog');await syncAuthAndFeed();window.PULSO_SOCIAL?.refresh?.().catch(console.warn);setMode('all');toast('Você saiu da conta.');
    });
    for(const id of ['adminButton','mobileAdmin'])$(id).addEventListener('click',async()=>{if(!isAdmin)return;adminTab='pending';dialogOpen('adminDialog');await refreshAdmin();$('mobileNav').classList.remove('open');});
    $('closeAdmin').addEventListener('click',()=>dialogClose('adminDialog'));
    $('adminDialog').addEventListener('click',ev=>{if(ev.target===$('adminDialog'))dialogClose('adminDialog');});
    document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',async()=>{adminTab=b.dataset.adminTab;await refreshAdmin();}));
    $('adminList').addEventListener('click',onAdminAction);
    $('importBackup').addEventListener('change',importBackup);
    $('exportPosts').addEventListener('click',exportPosts);
    $('previewDismiss').addEventListener('click',()=>$('previewBanner').hidden=true);
    $('appRadioButton')?.addEventListener('click',()=>{if(!radioActive)radioStart();else $('radioDock').scrollIntoView({block:'nearest'});});
    $('appPublishButton')?.addEventListener('click',()=>openComposer());
    $('appAccountButton')?.addEventListener('click',authDialog);
    wireRadioEvents();
    $('year').textContent=new Date().getFullYear();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connected)refreshPosts(true);});
    if(connected)window.setInterval(()=>{if(!document.hidden)refreshPosts(true);},60000);
  }
  async function init() {
    registerAudioWorker().catch(()=>{});
    window.PULSO_NOTIFICATIONS?.init?.({sb});
    wireEvents();setAuthMode('login');render();refreshUserButtons();
    window.PULSO_SECURITY?.init?.({sb,onSuccess:syncAuthAndFeed,toast});
    if(!connected){
      $('previewBanner').hidden=false;
      if(cloud&&!window.supabase)toast('A biblioteca do Supabase não carregou. Confira sua conexão à internet.');
      else if(config.supabaseUrl||config.supabaseAnonKey)toast('Configuração do Supabase incompleta ou inválida. Confira config.js.');
      return;
    }
    sb.auth.onAuthStateChange((event)=>{
      if(event==='INITIAL_SESSION')return;
      if(event==='PASSWORD_RECOVERY')window.setTimeout(()=>window.PULSO_SECURITY?.showPasswordRecovery?.(),0);
      window.setTimeout(()=>{syncAuthAndFeed().catch(err=>console.warn(err));},0);
    });
    await syncAuthAndFeed();
    if(location.hash==='#radio')radioStart();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(window.PULSO_SOCIAL?.ready){
      window.PULSO_SOCIAL.init({sb,user:()=>user,admin:()=>isAdmin,posts:()=>posts,rerender:render,resync:syncAuthAndFeed,login:authDialog,toast});
      render();
      if(connected)window.PULSO_SOCIAL.refresh().catch(console.warn);
    }
  });
  window.PULSO_APP={client:()=>sb,user:()=>user,admin:()=>isAdmin,posts:()=>posts,playById:id=>{const p=posts.find(x=>x.id===id&&x.status==='approved');if(p)playPost(p);},likeById:id=>{const p=posts.find(x=>x.id===id&&x.status==='approved');return p?toggleLike(p):Promise.resolve();},isLiked:id=>likes.has(id),pauseForReels:()=>{if(radioActive)radioPause();const media=$('embedContainer')?.querySelector('audio,video');if(media)media.pause();},radio:()=>radioStart(),login:authDialog,toast,setSavedRemote:ids=>{try{if(!localStorage.getItem('pulso_saved_legacy_v1')){const previous=localStorage.getItem(savedKey);if(previous)localStorage.setItem('pulso_saved_legacy_v1',previous);}}catch{}saved=new Set(ids);store(savedKey,[...saved]);render();}};
  init().catch(err=>toast(`Falha ao iniciar o site: ${errorText(err)}`));
  $('cancelVideoUpload').addEventListener('click',()=>{if(activeVideoUpload){activeVideoUpload();$('cancelVideoUpload').disabled=true;}});
})();
