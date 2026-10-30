import * as E from './engine.js';
import {icon} from './icons.js';
import {renderMap} from './map.js';
import {dispatcherTop, dispatcherList, dispatcherDialog} from './dispatch-view.js';
import {weatherForDay} from './routing.js';
import {homeCard,homeDialog} from './buildings-view.js';
const $=s=>document.querySelector(s),rub=n=>Math.round(n).toLocaleString('ru-RU')+' ₽', serviceIcons=['water','bolt','tool'];
const status={new:'Ожидает назначения',travel:'В пути',diagnosis:'Диагностика',repair:'Ремонт',done:'Выполнено',contractor:'Подрядчик',idle:'Свободна'};
let state,saveError=false;try{state=E.decode(localStorage.getItem('upravdom.v1'));}catch{state=E.fresh();}
let tab='map',filter='active',paused=true,speed=1,selected=null,homeSelected=null;
const view={zoom:1,x:0,y:0,hits:[]};const canvas=$('#map');
function save(){try{localStorage.setItem('upravdom.v1',E.encode(state));}catch{if(!saveError){toast('Не удалось сохранить: проверьте доступное место');saveError=true;}}}
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3200);}
function time(){const t=480+state.minute;return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
function phaseText(){return {prep:'Подготовка к смене',active:paused?'Смена на паузе':'Смена идёт',report:'Смена завершена'}[state.phase];}
function active(){return state.calls.filter(c=>c.status!=='done');}
function pill(c){return `<span class="badge ${c.priority===3?'red':''}">${['','ОБЫЧНЫЙ','ВЫСОКИЙ','КРИТИЧЕСКИЙ'][c.priority]} ПРИОРИТЕТ</span>`;}
function button(action,text,extra='',cls=''){return `<button data-action="${action}" ${extra} class="${cls}">${text}</button>`;}
function render(){
 $('#header').innerHTML=`<div class="brand">${icon('home')}<div><h1>Управдом</h1><small>УК «УЮТ» · СМЕНА ${state.day}</small></div></div><div class="stats"><div class="stat weather"><strong>${weatherForDay(state.day).label}</strong><small>Северный район</small></div><div class="stat"><strong class="money">${rub(state.money)}</strong><small>Репутация ${state.reputation}/100</small></div></div>`;
 $('#nav').innerHTML=[['map','map','Карта'],['calls','calls','Заявки'],['services','crew','Службы'],['finance','money','Финансы']].map(([id,ico,name])=>button('tab',`${icon(ico)}<span>${name}${id==='calls'&&active().length?' · '+active().length:''}</span>`,`data-tab="${id}" aria-current="${tab===id?'page':'false'}"`,tab===id?'active':'')).join('');
 $('#mapView').hidden=tab!=='map';$('#page').hidden=tab==='map';
 if(tab==='map'){
 $('#mapTop').innerHTML=dispatcherTop(state,{icon,button,status,pill});
 $('#mapBottom').innerHTML=`<div class="shiftBar"><div class="row"><div><span class="eyebrow">${phaseText()}</span><h3>${time()} <small>/ 16:00 · ${active().length} заявок</small></h3></div><div class="controls">${state.phase==='prep'?button('start',icon('play')+'Начать смену','','primary'):state.phase==='report'?button('report','Итоги смены','','primary'):button('pause',icon(paused?'play':'pause'),'aria-label="'+(paused?'Продолжить':'Пауза')+'"')+button('speed',speed+'×')+button('help','?','aria-label="Помощь"')}</div></div><progress value="${state.minute}" max="480" aria-label="Прогресс смены"></progress></div>`;
 }else renderPage();
 if(selected!==null)renderCall();if(homeSelected!==null)renderHome();
 draw();
}
function renderPage(){
 const p=$('#page');
 if(tab==='calls'){
 p.innerHTML=dispatcherList(state,filter,{button,status,pill});
 }else if(tab==='services'){
 p.innerHTML=`<div class="pageHead"><div class="eyebrow">ЛЮДИ И ТЕХНИКА</div><h2>Службы компании</h2><p class="muted">${state.crews.filter(c=>c.status==='idle').length} из 3 свободны · 6 сотрудников</p></div>${state.crews.map(c=>`<div class="card"><div class="row"><h3>${c.name}</h3><span class="badge ${c.status==='idle'?'green':''}">${status[c.status]}</span></div><div class="crewArt" style="color:${E.COLORS[c.service]}">${icon('truck')}</div><div class="row"><span>${c.id===2?'Сервисный пикап':'Сервисный фургон'} · 2 специалиста</span><small>Уровень ${c.level}</small></div><div class="specs">${[['Топливо',c.fuel],['Состояние',c.condition],['Усталость',c.fatigue]].map(([name,n])=>`<div><small>${name}</small>${n}%<div class="condition"><i style="width:${n}%"></i></div></div>`).join('')}<div><small>Оснащение / опыт</small>${c.equipment}/3 · ${c.xp} XP</div></div><div class="actions">${button('maintain','ТО · 5 000 ₽',`data-id="${c.id}" data-kind="service" ${c.status!=='idle'?'disabled':''}`)}${button('maintain','Оснастить · '+rub(25000*c.equipment),`data-id="${c.id}" data-kind="equipment" ${c.status!=='idle'||c.equipment>=3?'disabled':''}`)}${button('maintain','Обучить · 15 000 ₽',`data-id="${c.id}" data-kind="train" ${c.status!=='idle'||c.xp<30?'disabled':''}`)}</div><small>Зарплата: 3 600 ₽ / смена · отдых между сменами −50 усталости</small></div>`).join('')}`;
 }else{
 const income=state.ledger.filter(e=>e.day===state.day&&e.amount>0).reduce((a,e)=>a+e.amount,0),expenses=-state.ledger.filter(e=>e.day===state.day&&e.amount<0).reduce((a,e)=>a+e.amount,0);
 p.innerHTML=`<div class="pageHead"><div class="eyebrow">ЭКОНОМИКА УК «УЮТ»</div><h2>Финансы и договоры</h2><p class="muted">Решения сегодня — устойчивый район завтра</p></div><div class="card"><small>Доступный бюджет</small><h2 class="green">${rub(state.money)}</h2><div class="grid"><div class="metric"><small>Доход за смену</small><b>${rub(income)}</b></div><div class="metric"><small>Расход за смену</small><b>${rub(expenses)}</b></div></div></div><h3 style="margin:22px 0 12px">Дома под управлением</h3>${state.homes.map(h=>homeCard(h,button)).join('')}<h3 style="margin:22px 0 12px">Операции</h3>${state.ledger.slice(0,20).map(e=>`<div class="row ledger"><span>${e.label}<br><small>Смена ${e.day}</small></span><b class="${e.amount>0?'green':''}">${e.amount>0?'+':''}${rub(e.amount)}</b></div>`).join('')||'<p class="muted">Операций пока нет.</p>'}<p class="footerNote">Тендеры, кредиты и лизинг — следующий этап развития проекта.</p>${button('help','Как играть')} ${button('reset','Новая компания','','danger')}`;
 }
}
function openDialog(html){$('#dialog').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function shell(title,body){return `<div class="row"><h2>${title}</h2>${button('close',icon('close'),'aria-label="Закрыть"','close')}</div><div class="dialogBody">${body}</div>`;}
function renderCall(){const c=state.calls.find(c=>c.id===selected);if(!c)return;openDialog(dispatcherDialog(state,c,{button,icon,pill,rub,shell,status}));}
function renderHome(){const h=state.homes[homeSelected];if(!h)return;openDialog(homeDialog(h,state.phase,state.money,{button,shell,rub}));}
function showReport(){const r=state.report;openDialog(shell('Смена завершена',`<p class="muted">Северный район · день ${state.day}</p><div class="grid" style="margin:20px 0"><div class="metric"><small>Выполнено</small><b>${r.done} / ${r.total}</b></div><div class="metric"><small>Результат</small><b class="${r.net>=0?'green':'danger'}">${rub(r.net)}</b></div></div><p>С просрочкой: ${r.late}. Переходят на завтра: ${r.pending}.</p><p class="muted" style="margin:12px 0">Бригады отдохнут. Незавершённые работы и назначения сохраняются.</p>${button('next','Следующий день', '', 'primary wide')}`));}
function draw(){if(tab==='map')renderMap(canvas,state,view);}
function close(){selected=null;homeSelected=null;$('#dialog').close();}
function action(el){const a=el.dataset.action,id=Number(el.dataset.id);try{
 if(a==='tab'){tab=el.dataset.tab;}
 else if(a==='filter')filter=el.dataset.filter;
 else if(a==='start'){E.start(state);paused=false;}
 else if(a==='pause')paused=!paused;
 else if(a==='speed')speed=speed===1?2:speed===2?4:1;
 else if(a==='call'){selected=id;homeSelected=null;}
 else if(a==='question')E.question(state,id);
 else if(a==='dispatch'){E.dispatch(state,id,Number(el.dataset.crew));toast('Бригада отправлена');}
 else if(a==='outsource'){E.outsource(state,id);toast('Подрядчик принял заявку');}
 else if(a==='maintain'){E.maintain(state,id,el.dataset.kind);toast('Готово');}
 else if(a==='home'){homeSelected=id;selected=null;}
 else if(a==='prevent'){E.prevent(state,id,el.dataset.system??null);toast('Профилактика выполнена');}
 else if(a==='zoomIn')view.zoom=Math.min(2.4,view.zoom*1.2);
 else if(a==='zoomOut')view.zoom=Math.max(.65,view.zoom/1.2);
 else if(a==='center'){view.x=view.y=0;view.zoom=1;}
 else if(a==='close')close();
 else if(a==='report'){showReport();return;}
 else if(a==='next'){E.nextDay(state);paused=true;close();}
 else if(a==='help'){openDialog(shell('Добро пожаловать в «Уют»',`<div class="stack"><p>Вы управляете тремя домами и тремя коммунальными бригадами.</p><p><b>1.</b> Перед сменой проверьте топливо и состояние машин в «Службах».</p><p><b>2.</b> Начните смену. Откройте заявку, уточните обстоятельства и отправьте подходящую бригаду.</p><p><b>3.</b> Следите за сроками. Если все заняты, можно привлечь подрядчика.</p><p><b>4.</b> В 16:00 появится отчёт. Договорные платежи поступают в конце смены.</p><p class="muted">Карта перемещается пальцем, масштабируется двумя пальцами или кнопками. При открытом окне, сворачивании приложения и выходе время не идёт. Прогресс сохраняется автоматически.</p></div>`));return;}
 else if(a==='reset'){openDialog(shell('Начать заново?',`<p>Текущая компания и её сохранение будут заменены. Это действие нельзя отменить.</p><div class="actions" style="margin-top:20px">${button('confirmReset','Начать новую игру','','danger')} ${button('close','Отмена')}</div>`));return;}
 else if(a==='confirmReset'){state=E.fresh();paused=true;close();tab='map';}
 save();render();
 }catch(e){toast(e.message);}}
 document.addEventListener('click',e=>{const el=e.target.closest('button[data-action]');if(el&&!el.disabled)action(el);});
 $('#dialog').addEventListener('cancel',()=>{selected=null;homeSelected=null;});
 window.addEventListener('upravdom-pause',()=>{paused=true;save();render();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){paused=true;save();}render();});window.addEventListener('pagehide',save);window.addEventListener('resize',draw);
 const pointers=new Map();let last=null,drag=0,pinch=0;
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);last=[e.clientX,e.clientY];drag=0;if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch>0)view.zoom=Math.max(.65,Math.min(2.4,view.zoom*d/pinch));pinch=d;drag=99;}else if(last){const dx=e.clientX-last[0],dy=e.clientY-last[1];view.x=Math.max(-450,Math.min(450,view.x+dx));view.y=Math.max(-450,Math.min(450,view.y+dy));drag+=Math.abs(dx)+Math.abs(dy);}last=[e.clientX,e.clientY];draw();});
 canvas.addEventListener('pointerup',e=>{if(drag<8&&pointers.size===1){const r=canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top],hit=view.hits.find(h=>Math.hypot(h.point[0]-p[0],h.point[1]-p[1])<30);if(hit){if(hit.call){selected=hit.call;renderCall();}else{homeSelected=hit.home;renderHome();}}}pointers.delete(e.pointerId);last=pointers.size?[...pointers.values()][0]:null;});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);last=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.65,Math.min(2.4,view.zoom*(e.deltaY<0?1.1:.9)));draw();},{passive:false});
 setInterval(()=>{if(!paused&&!document.hidden&&!$('#dialog').open&&state.phase==='active'){E.tick(state,speed);save();render();if(state.phase==='report')showReport();}},1000);
 render();
