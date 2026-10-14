/* PULSO — fotos reais dos DJs na barra de descoberta. Mantém os controles e filtros existentes. */
(()=>{'use strict';
const photos={
'david guetta':'https://djmag.com/sites/default/files/styles/djm_23_961x540/public/2026-09/Guetta.jpg.webp?itok=l6ckHhHJ',
'martin garrix':'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2026-02/485909256_1218259256325736_3254876605054938336_n.jpg.webp.jpg?itok=fhLqhVbJ',
'anyma':'https://djmag.com/sites/default/files/styles/djm_23_961x540/public/2025-12/anyma-matteo-milleri-performance-show-great-pyramids-giza-egypt-quantum-genesys.jpg.webp?itok=XMH_z6As',
'alok':'https://djmag.com/sites/default/files/styles/djm_23_991x533_jpg/public/2023-10/4.%20Alok-Hudson%20Renan.jpg?itok=tQP5DZo7',
'dimitri vegas like mike':'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2025-09/dimitri-vegas-like-mike.jpg?itok=omE6lLeh',
'charlotte de witte':'https://f4.bcbits.com/img/0042548759_10.jpg',
'armin van buuren':'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2024-08/8235C3C5-63E4-4E0F-8133-47F5EE1F93FB_1_201_a_0.jpeg.jpg?itok=M4N5SvPR',
'timmy trumpet':'https://iscale.iheart.com/v3/surl/aHR0cDovL2ltYWdlLmloZWFydC5jb20vaW1hZ2VzL3JvdmkvMTA4MC8wMDA2Lzk1OC9NSTAwMDY5NTg4MTkuanBn?sn=eGtleWJhc2UyMDIxMTExMDqh-Rw-Y3XI4DXnRsR-6axXA5dj9RCY4jaNEuyhy05wrA%3D%3D',
'fisher':'https://cloudfront-ap-southeast-2.images.arcpublishing.com/nzme/NTVXUCSQBBG5BMWLRT6QVSIOXU.jpg',
'vintage culture':'https://djmag.com/sites/default/files/styles/djm_23_961x540/public/2023-11/10.%20Vintage%20Culture%202023.jpeg.webp?itok=Z3dMBUi0',
'calvin harris':'https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2023-03/cavin-harris-ushuaia-ibiza-residency-2023.jpeg.jpg?itok=YrPDsXEi',
'don diablo':'https://djmag.com/sites/default/files/storyimages/DON-DIABLO-ULTRA-664x400.jpg',
'peggy gou':'https://i-d.co/wp-content/uploads/2024/05/1535553804361-peggy-gou.jpeg?quality=90&w=2000',
'black coffee':'https://cdn.platinumlist.net/upload/artist/black_coffee_1021-mobile1576439129.png',
'afrojack':'https://d3vhc53cl8e8km.cloudfront.net/artists/153/f8214edc-f3af-11ed-b991-0ee6b8365494.jpg',
'fred again':'https://press.atlanticrecords.com/sites/g/files/g2000014001/files/2023-10/Fred%20again..%20ten%20Press%20Photo_0.jpg',
'lost frequencies':'https://www.radiocontact.be/app/uploads/2023/08/frequ.jpg',
'steve aoki':'https://live-production.wcms.abc-cdn.net.au/5bd8972769447d764cf5dd04b86b0780?cropH=2500&cropW=2500&height=862&impolicy=wcms_crop_resize&width=862&xPos=883&yPos=0',
'fatsync':'https://eletrovibez.com/wp-content/uploads/2024/01/Conheca-Fatsync-DJ-curitibano-que-se-apresenta-na-Taraka-em-Sao-Paulo-a-convite-de-GORDO-1155x770.jpg',
'eli iwasa':'https://revistaaldeia.com.br/fotos/g_20180808_075322_55.jpg',
'ownboss':'https://assets.beatportal.com/images/transforms/content-item/_1200x630_crop_center-center_none/Ownboss-Beatportal.jpg',
'carl cox':'https://unvrs.b-cdn.net/images/update/2025_UNVRS_CARL-COX_RESIDENT-PAGE-HEADER_2400x1440px-1737636461.jpg',
'kiko franco':'https://s3.playbpm.com.br/images/Kiko_Fr.7e4a96c8.fill-800x450.format-jpeg.jpegquality-85.jpg',
'boris brejcha':'https://www.time-warp.de/imgdb/boris-brejcha.jpg',
'michael bibi':'https://i.scdn.co/image/ab6761610000e5eb5da9a30b4ebb31ba1212adb9',
'kshmr':'https://rollingstoneindia.com/wp-content/uploads/2023/04/KSHMR-2023-web-photo-e1681284870312.jpg',
'w w':'https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/wandw.jpg'
};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function update(){
 const track=document.getElementById('pulsoArtistRibbonTrack');
 if(!track)return;
 const active=document.querySelector('[data-par-category][aria-pressed="true"]');
 if(active&&active.dataset.parCategory!=='artists')return;
 [...track.children].forEach(card=>{
   const label=card.getAttribute('aria-label')||card.getAttribute('title')||card.textContent||'';
   const name=normalize(label);
   const key=Object.keys(photos).find(k=>name.includes(k));
   if(!key)return;
   let img=card.querySelector('img');
   if(!img){img=document.createElement('img');img.className='par-real-dj-photo';img.alt='Foto de '+key.replace(/\b\w/g,m=>m.toUpperCase());img.loading='lazy';img.decoding='async';card.prepend(img);}
   if(img.dataset.pulsoRealPhoto!=='1'){img.src=photos[key];img.dataset.pulsoRealPhoto='1';img.alt='Foto de '+key.replace(/\b\w/g,m=>m.toUpperCase());img.style.objectFit='cover';img.style.objectPosition='center';img.style.borderRadius='50%';img.style.display='block';img.style.width='64px';img.style.height='64px';img.style.flex='0 0 64px';img.style.background='#171a18';}
   img.onerror=()=>{img.style.opacity='.35';};
 });
}
const start=()=>{update();const track=document.getElementById('pulsoArtistRibbonTrack');if(track)new MutationObserver(update).observe(track,{childList:true,subtree:true,characterData:true});document.querySelectorAll('[data-par-category]').forEach(b=>b.addEventListener('click',()=>setTimeout(update,80)));};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();