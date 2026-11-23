/* PULSO AGENDA — calendário com datas oficiais e lista pessoal. */
(()=>{'use strict';
const KEY='pulso_agenda_saved_v1';
const events=[
{id:'core-melbourne-2026',name:'CORE Melbourne',edition:'2026',start:'2026-11-28',end:'2026-11-28',place:'Flemington Racecourse · Melbourne, Austrália',url:'https://www.tomorrowland.com/events/',kind:'Tomorrowland presents'},
{id:'tomorrowland-thailand-2026',name:'Tomorrowland Thailand',edition:'2026',start:'2026-12-11',end:'2026-12-13',place:'Wisdom Valley · Tailândia',url:'https://www.tomorrowland.com/events/',kind:'Tomorrowland'},
{id:'tomorrowland-winter-2027',name:'Tomorrowland Winter',edition:'2027',start:'2027-03-20',end:'2027-03-27',place:"Alpe d’Huez · França",url:'https://www.tomorrowland.com/events/',kind:'Tomorrowland'},
{id:'tomorrowland-brasil-2027',name:'Tomorrowland Brasil',edition:'2027',start:'2027-04-30',end:'2027-05-02',place:'Parque Maeda · Itu, São Paulo, Brasil',url:'https://brasil.tomorrowland.com/pt/welcome/',kind:'Brasil'},
{id:'tomorrowland-belgium-w1-2027',name:'Tomorrowland Belgium · Weekend 1',edition:'2027',start:'2027-07-16',end:'2027-07-18',place:'De Schorre · Boom, Bélgica',url:'https://www.tomorrowland.com/events/',kind:'Bélgica'},
{id:'tomorrowland-belgium-w2-2027',name:'Tomorrowland Belgium · Weekend 2',edition:'2027',start:'2027-07-23',end:'2027-07-25',place:'De Schorre · Boom, Bélgica',url:'https://www.tomorrowland.com/events/',kind:'Bélgica'},
{id:'core-los-angeles-2027',name:'CORE Los Angeles',edition:'2027',start:'2027-10-02',end:'2027-10-03',place:'LA State Historic Park · Los Angeles, EUA',url:'https://www.tomorrowland.com/events/',kind:'Tomorrowland presents'}
];
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
const range=e=>e.start===e.end?fmt(e.start):fmt(e.start)+' — '+fmt(e.end);
function load(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return new Set(Array.isArray(a)?a:[])}catch{return new Set()}}
let saved=load();
function googleUrl(e){
 const compact=d=>d.replaceAll('-',''),end=new Date(e.end+'T12:00:00');end.setDate(end.getDate()+1);
 const endDate=end.getFullYear()+String(end.getMonth()+1).padStart(2,'0')+String(end.getDate()).padStart(2,'0');
 const details='Evento listado pelo PULSO. Confirme informações, ingressos e alterações no calendário oficial: '+e.url;
 return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.name)+'&dates='+compact(e.start)+'/'+endDate+'&details='+encodeURIComponent(details)+'&location='+encodeURIComponent(e.place);
}
function render(){
 const host=$('#pulsoAgendaGrid');if(!host)return;
 const today=new Date();today.setHours(0,0,0,0);
 const upcoming=events.filter(e=>new Date(e.end+'T23:59:59')>=today);
 host.innerHTML=upcoming.map(e=>'<article class="pa-card"><div class="pa-card-top"><span>'+esc(e.kind)+'</span><small>'+esc(e.edition)+'</small></div><h3>'+esc(e.name)+'</h3><p class="pa-date">'+esc(range(e))+'</p><p class="pa-place">'+esc(e.place)+'</p><div class="pa-actions"><button type="button" data-pa-save="'+esc(e.id)+'" aria-pressed="'+saved.has(e.id)+'">'+(saved.has(e.id)?'✓ Na minha agenda':'+ Acompanhar')+'</button><a href="'+esc(googleUrl(e))+'" target="_blank" rel="noopener noreferrer">Google Agenda ↗</a></div><a class="pa-official" href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Calendário oficial ↗</a></article>').join('')||'<p class="pa-empty">Novas datas confirmadas aparecerão aqui.</p>';
 const count=$('#pulsoAgendaSavedCount');if(count)count.textContent=String(saved.size);
 const savedHost=$('#pulsoAgendaSaved');if(savedHost){const rows=events.filter(e=>saved.has(e.id));savedHost.innerHTML=rows.length?rows.map(e=>'<div class="pa-saved-row"><span><strong>'+esc(e.name)+'</strong><small>'+esc(range(e))+' · '+esc(e.place)+'</small></span><button type="button" data-pa-save="'+esc(e.id)+'">Remover</button></div>').join(''):'<p class="pa-empty">Você ainda não está acompanhando nenhum evento.</p>'}
}
function mount(){
 if($('#pulsoAgenda'))return;const anchor=$('#pulso5');if(!anchor)return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='pulso-agenda.css?v=1.0-confirmed-dates';document.head.appendChild(link);
 const section=document.createElement('section');section.id='pulsoAgenda';section.className='pulso-agenda container';
 section.innerHTML='<div class="pa-heading"><div><span class="pa-eyebrow">PULSO EXPERIENCE · FESTIVAL RADAR</span><h2>AGENDA <em>ELETRÔNICA.</em></h2><p>Datas anunciadas oficialmente para você planejar a próxima experiência.</p></div><div class="pa-count"><strong id="pulsoAgendaSavedCount">0</strong><span>NA MINHA AGENDA</span></div></div><div class="pa-note">Calendário inicial com eventos do ecossistema Tomorrowland. Datas e informações podem mudar; confira sempre a página oficial antes de comprar ou viajar.</div><div id="pulsoAgendaGrid" class="pa-grid"></div><div class="pa-saved-wrap"><h3>MEUS EVENTOS SALVOS</h3><div id="pulsoAgendaSaved"></div></div><div class="pa-footer"><span>Mais festivais serão incluídos quando as datas forem confirmadas pelos organizadores.</span><a href="https://www.tomorrowland.com/events/" target="_blank" rel="noopener noreferrer">Ver calendário oficial completo ↗</a></div>';
 anchor.insertAdjacentElement('afterend',section);render();
}
document.addEventListener('click',ev=>{const b=ev.target.closest('[data-pa-save]');if(!b)return;const id=b.dataset.paSave;if(saved.has(id))saved.delete(id);else saved.add(id);try{localStorage.setItem(KEY,JSON.stringify([...saved]))}catch{}render()});
document.addEventListener('DOMContentLoaded',mount);
window.PULSO_AGENDA={refresh:render,events:()=>events.slice(),saved:()=>[...saved]};
})();