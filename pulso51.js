/* PULSO 5.1 — install options, streaming discovery and in-app assistant. No third-party credentials in client. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
window.PULSO51_AVATAR_PREVIEW=(file,preview,placeholder)=>{
 if(!file)return;const prev=preview.dataset.objectUrl;if(prev)URL.revokeObjectURL(prev);
 const u=URL.createObjectURL(file);preview.src=u;preview.hidden=false;preview.dataset.objectUrl=u;placeholder.hidden=true;
};
const kb=[
 {match:['publicar','enviar','upload','set','mp3','dj set'],response:'Para publicar, entre na sua conta e toque em + Publicar. Escolha DJ Set ou Faixa, informe o gênero, selecione um MP3, M4A ou outro formato aceito, adicione uma capa e envie. A publicação poderá precisar de aprovação do administrador LØSI. Arquivos MP3 grandes vão para o Cloudflare R2.'},
 {match:['ios','iphone','tela inicial','instalar iphone','safari'],response:'No iPhone, abra o PULSO no Safari, toque em Compartilhar (quadrado com seta para cima), deslize até “Adicionar à Tela de Início” e confirme. O guia ilustrado está no link Como instalar no iPhone, na faixa inferior.'},
 {match:['android','apk','instalar android','celular android'],response:'No Android, use o botão Android na faixa Instale o aplicativo. No Chrome, escolha Instalar aplicativo ou Adicionar à Tela Inicial. O pacote APK nativo exige compilação e assinatura separadas; o modo web instalável funciona gratuitamente.'},
 {match:['identificar','shazam','identify','reconhecer'],response:'No player MP3 ou na Rádio PULSO, use “Identificar faixa”. O reconhecimento analisa alguns segundos do set sem pausar o áudio. É necessário login, e a função pode não reconhecer remixes inéditos.'},
 {match:['playlist','biblioteca','favoritos','salvar'],response:'Entre na sua conta, abra Minha biblioteca e salve músicas nos favoritos. Use o botão + de uma faixa para adicionar a uma playlist. Suas playlists são privadas por padrão e podem ser públicas se você escolher.'},
 {match:['perfil','foto','galeria','dj','seguir'],response:'Abra Perfis de DJs → Editar meu perfil. Agora você pode escolher a foto diretamente da galeria, além de alterar nome, @usuário e biografia. Os ouvintes podem seguir os perfis e descobrir os sets que publicam.'},
 {match:['minuto','minutagem','avançar','voltar','progresso','tempo'],response:'No player de MP3 há uma barra de minutagem que pode ser arrastada para avançar no set. No celular, a barra foi ampliada. No iPhone, preencha os campos MIN e SEG separadamente (por exemplo, 32 e 15) e toque em IR.'},
 {match:['bloqueada','segundo plano','tela bloqueada'],response:'Os MP3 hospedados diretamente no PULSO podem continuar tocando em segundo plano nos aparelhos compatíveis. Vídeos do YouTube seguem as regras do player do YouTube; para segundo plano use o aplicativo oficial e os recursos da sua assinatura.'},
 {match:['streaming','spotify','soundcloud','youtube music','catalogo','catálogo'],response:'A seção Streaming sem fronteiras encontra músicas nas plataformas oficiais Spotify, SoundCloud e YouTube Music. É possível incorporar links compatíveis no player oficial. O PULSO não copia faixas desses catálogos nem contorna assinaturas ou licenças.'},
 {match:['senha','conta','cadastro','email','e-mail','login'],response:'Para se cadastrar, use um e-mail válido e uma senha forte. A confirmação por e-mail depende das configurações do Supabase. Em Conta, há recursos para recuperação de senha e proteção com aplicativo autenticador.'},
 {match:['mov','video','vídeo','arquivo'],response:'O PULSO recebe vídeos MP4, WebM e MOV nas modalidades configuradas. Para maior compatibilidade com Android e navegadores, MP4/H.264 é recomendado. Para arquivos grandes, o servidor pode exigir uma conta administradora.'}
];
const stop=new Set(['como','com','para','pelo','pela','quero','esse','essa','meu','minha','sobre','qual','posso','tem','isso','que','do','da','de','um','uma','a','o','no','na','ao','em','e','se','app','aplicativo','pulso']);
function offline(question){const tokens=String(question).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];const input=tokens.filter(x=>!stop.has(x)&&x.length>2);let best=null,score=0;
 for(const item of kb){let s=0;for(const term of item.match){const norm=term.normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(input.some(x=>norm.split(' ').includes(x)))s+=2;if(question.toLowerCase().includes(term))s+=1;}if(s>score){score=s;best=item;}}
 return score>=1?best.response:'Posso ajudar com upload de músicas, configurações de conta, perfis de DJs, rádio, instalação, playlists, streaming e reconhecimento de faixas. Experimente perguntar sobre uma dessas funções.';
}
function addMessage(text,me){const root=$('p51HelpMessages'),item=document.createElement('div');item.className='p51-bubble '+(me?'user':'bot');item.textContent=text;root.appendChild(item);root.scrollTop=root.scrollHeight;return item;}
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
window.addEventListener('appinstalled',()=>{$('p51InstallBar').hidden=true;deferredInstall=null});
async function ai(question){
 const user=window.PULSO_APP?.user?.();if(!user)return null;
 try{
   const client=window.PULSO_APP?.client?.();const {data}=await client.auth.getSession();const token=data?.session?.access_token;if(!token)return null;
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),11000);
   try{const {data:out,error}=await client.functions.invoke('pulso-ajuda',{body:{question},signal:controller.signal});if(error)return null;return typeof out?.answer==='string'?out.answer.slice(0,1300):null;}
   finally{clearTimeout(timeout)}
 }catch{return null}
}
async function ask(question){addMessage(question,true);const loading=addMessage('Consultando a ajuda do PULSO…',false);const response=await ai(question);loading.textContent=response||offline(question);}
function init(){
 const install=$('p51AndroidInstall');if(!install)return;
 const installBar=$('p51InstallBar');
 const isIphone=/iPhone|iPod|iPad/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const isAndroid=/Android/i.test(navigator.userAgent);
 if(isIphone){install.hidden=true;const apk=$('p51ApkLink');if(apk)apk.hidden=true;}
 if(isAndroid){const iosGuide=installBar.querySelector('a[href="ios.html"]');if(iosGuide)iosGuide.hidden=true;}

 fetch('downloads/PULSO-Android.apk',{method:'HEAD',cache:'no-store'}).then(r=>{if(isAndroid||(!isAndroid&&!isIphone)){const ct=(r.headers.get('content-type')||'').toLowerCase();const size=Number(r.headers.get('content-length')||0);if(r.ok&&!ct.includes('text/html')&&!ct.includes('text/plain')&&(size===0||size>100000))$('p51ApkLink').hidden=false;}}).catch(()=>{});
 install.addEventListener('click',async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;}else window.location.assign('instalar.html#android');});
 $('p51DismissInstall').addEventListener('click',()=>{$('p51InstallBar').hidden=true;(()=>{try{sessionStorage.setItem('p51_hide_install','1')}catch{}})()});if((()=>{try{return sessionStorage.getItem('p51_hide_install')==='1'}catch{return false}})()||window.matchMedia('(display-mode: standalone)').matches)$('p51InstallBar').hidden=true;
 const open=flag=>{$('p51HelpDialog').hidden=!flag;$('p51HelpToggle').setAttribute('aria-expanded',String(flag));if(flag)$('p51HelpInput').focus();};
 $('p51HelpToggle').addEventListener('click',()=>open($('p51HelpDialog').hidden));$('p51HelpClose').addEventListener('click',()=>open(false));
 $('p51HelpForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('p51HelpInput'),q=input.value.trim();if(!q)return;input.value='';await ask(q)});
 document.querySelectorAll('[data-p51-question]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.p51Question)));
 $('p51StreamingSearch').addEventListener('submit',e=>{e.preventDefault();const q=$('p51Search').value.trim();if(!q)return;const encoded=encodeURIComponent(q);$('p51SpotifySearch').href=`https://open.spotify.com/search/${encoded}`;$('p51SoundcloudSearch').href=`https://soundcloud.com/search?q=${encoded}`;$('p51YoutubeSearch').href=`https://music.youtube.com/search?q=${encoded}`;$('p51StreamingLinks').hidden=false;});
 $('p51PreviewOfficial').addEventListener('click',()=>{const value=$('p51OfficialLink').value.trim(),status=$('p51StreamingStatus'),box=$('p51OfficialEmbed');box.replaceChildren();let u;try{u=new URL(value)}catch{status.textContent='Cole um link HTTPS válido do Spotify ou SoundCloud.';return}if(u.protocol!=='https:')return status.textContent='Use um link HTTPS.';
 let frame='';const host=u.hostname.toLowerCase();if(host==='open.spotify.com'){
 const paths=u.pathname.split('/').filter(Boolean);const types=['track','playlist','album','episode','show'];const idx=paths.findIndex(p=>types.includes(p));if(idx>=0&&/^[a-zA-Z0-9]{15,30}$/.test(paths[idx+1]||''))frame=`https://open.spotify.com/embed/${paths[idx]}/${paths[idx+1]}`;
 }else if(host==='soundcloud.com'||host==='www.soundcloud.com'){if(u.pathname.length>2&&!u.pathname.includes('/search'))frame=`https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&color=%23d2fb63&auto_play=false&show_artwork=true`;}
 if(!frame)return status.textContent='Este link não pode ser incorporado. Use uma faixa ou playlist pública do Spotify ou SoundCloud.';
 const iframe=document.createElement('iframe');iframe.src=frame;iframe.title='Player oficial do serviço de streaming';iframe.loading='lazy';iframe.allow='autoplay; encrypted-media; clipboard-write; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.style.height=frame.includes('spotify.com')?'352px':'180px';box.appendChild(iframe);status.textContent='Player oficial aberto. Algumas músicas exigem login ou assinatura na plataforma.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
