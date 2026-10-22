import * as E from './engine.js';
import {icon} from './icons.js';
import {renderMap,loadArtwork} from './map.js';
import {MARKERS,travelTime} from './roads.js';
import {loadGame,saveGame,loadSettings,saveSettings,SAVE_KEY,BACKUP_KEY} from './storage.js';
import {notifySound} from './audio.js';
import {STAFF,vehicle} from './graphics.js';
import {managementPage,domainDialog} from './management.js';
import {DEPOT,DISTRICTS,VEHICLE_MODELS} from './content.js';
const $=s=>document.querySelector(s),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rub=n=>Math.round(n===0?0:n).toLocaleString('ru-RU')+' ₽';
const icons=['water','bolt','tool'],short=['Сантехники','Электрики','Ремонтная бригада'];
const statuses={new:'Ожидает назначения',travel:'В пути',diagnosis:'Диагностика',repair:'Ремонт',done:'Выполнено',blocked:'Ждёт предыдущего этапа',contractor:'Подрядчик',idle:'Свободна'};
let storage;try{storage=globalThis.localStorage;}catch{storage={getItem(){throw Error('Хранилище недоступно');},setItem(){throw Error('Хранилище недоступно');}};}
const loaded=loadGame(storage);let state=loaded.state,loadError=loaded.blocked,saveError=false,settings=loadSettings(storage);
let tab='map',filter='active',paused=true,speed=1,modal=null,imported=null,frame=0,lastDraw=0,lastTick=performance.now(),dirty=true;
const subpages={services:'crews',garage:'fleet',finance:'overview'};
const view={zoom:1,x:0,y:0,bearing:.65,tilt:1,district:0,focus:null,hits:[]},canvas=$('#map'),dialog=$('#dialog');
const button=(action,text,extra='',cls='')=>`<button data-action="${action}" ${extra} class="${cls}">${text}</button>`;
const active=()=>state.calls.filter(c=>c.status!=='done');
const clock=()=>{const t=480+state.minute;return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;};
const phaseText=()=>({prep:'Подготовка к смене',active:paused?'Смена на паузе':'Смена идёт',report:'Смена завершена'}[state.phase]);
const badge=c=>`<span class="badge priority-${c.priority}">${['','Обычный','Высокий','Критический'][c.priority]} приоритет</span>`;
function unavailable(cr){return cr.status!=='idle'?'Бригада занята':cr.fuel<8?'Нужна заправка':cr.condition<20?'Нужен ремонт машины':cr.fatigue>90?'Нужен отдых':'';}
function save(){if(loadError)return;try{saveGame(storage,state);saveError=false;}catch{if(!saveError)toast('Не удалось сохранить. Проверьте свободное место и доступ к хранилищу.');saveError=true;}}
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4200);const inline=$('#dialogError');if(dialog.open&&inline){inline.textContent=text;inline.hidden=false;}}
function open(kind,id=null){modal={kind,id};renderDialog();}
function close(){modal=null;dialog.close();lastTick=performance.now();dirty=true;draw();scheduleAnimation();}
function shell(title,body,eyebrow='УК «УЮТ»'){return `<div class="dialogHead"><div><div class="eyebrow">${eyebrow}</div><h2 id="dialogTitle">${title}</h2></div>${button('close',icon('close'),'aria-label="Закрыть"','iconButton')}</div><div id="dialogError" class="notice warning" role="alert" hidden></div><div class="dialogBody">${body}</div>`;}
function render(){
 const calls=active(),season=Math.floor((state.day-1)/7)%4,weather=[['snow','−2°','Снег'],['sun','+8°','Дождь'],['sun','+23°','Ясно'],['sun','+5°','Облачно']][season];
 $('#header').innerHTML=`<button class="brand" data-action="help" aria-label="Управдом: как играть"><span class="brandRoof">${icon('home')}</span><strong>Управдом</strong><span>порядок в каждом доме</span></button><div class="headerClock"><strong>${clock()}</strong><small>День ${state.day} · ${['Зима','Весна','Лето','Осень'][season]}</small></div><div class="headerWeather">${icon(weather[0])}<span><strong>${weather[1]}</strong><small>${weather[2]}</small></span></div><div class="headerBudget">${icon('money')}<span><strong>${rub(state.money)}</strong><small>Бюджет компании</small></span></div>${button('goCalls',`${icon('bell')}<strong>${calls.length}</strong><small>активные<br>заявки</small>`,'aria-label="Активные заявки"','headerAlerts')}`;
 $('#nav').innerHTML=[['map','map','Карта'],['calls','calls','Заявки'],['services','crew','Бригады'],['finance','money','Финансы'],['garage','garage','Гараж']].map(([id,ico,name])=>button('tab',`<span class="navIcon">${icon(ico)}${id==='calls'&&calls.length?`<i class="counter">${calls.length}</i>`:''}</span><span>${name}</span>`,`data-tab="${id}" aria-current="${tab===id?'page':'false'}"`,tab===id?'active':'')).join('');
 $('#mapView').hidden=tab!=='map';$('#page').hidden=tab==='map';
 if(tab==='map')renderMapUI();else renderPage();
 if(modal)renderDialog();dirty=true;draw();scheduleAnimation();
}
function renderMapUI(){
 const call=active().sort((a,b)=>b.priority-a.priority||(a.status==='new'?-1:0)-(b.status==='new'?-1:0)||a.due-b.due)[0];
 if(call){const cr=state.crews.find(c=>c.job===call.id),service=E.TYPES[call.type][1];
  $('#mapTop').innerHTML=button('call',`<span class="incidentIcon" style="--service:${E.COLORS[service]}">${icon(icons[service])}</span><span class="incidentInfo">${badge(call)}<strong>${esc(E.TYPES[call.type][0])}</strong><small>${icon('location')}${esc(state.homes[call.home].name)}</small></span><span class="incidentAssignment"><small>${cr?'Назначена:':'Статус:'}</small><span>${cr?short[cr.service]:statuses[call.status]}</span>${cr?`<strong>${icon('truck')}${cr.status==='travel'?'ETA: '+cr.remaining+' мин':statuses[cr.status]}</strong>`:''}</span>${icon('chevron')}`,`data-id="${call.id}"`,'incident');
 }else $('#mapTop').innerHTML=`<div class="incident welcome"><span class="incidentIcon ready">${icon('shield')}</span><div class="incidentInfo"><span class="eyebrow">СЕВЕРНЫЙ РАЙОН</span><strong>${state.phase==='prep'?'Доброе утро, управляющий':'В районе всё спокойно'}</strong><small>${state.phase==='prep'?'Три дома. Шесть специалистов. Ваша компания.':'Все обращения обработаны. Службы наготове.'}</small></div>${button('help',icon('info'),'aria-label="Как играть"','iconButton')}</div>`;
 $('#mapBottom').innerHTML=`<div class="mapTools">${button('districts',`${icon('map')}<span>Все<br>районы</span>${icon('chevron')}`,'','districtButton')}<span class="mapLegend"><i></i>${view.district===null?'Весь город':DISTRICTS[view.district].name+' район'} · ${E.ownedHomes(state).length} договоров</span>${button('settings',icon('gear'),'aria-label="Настройки"','settingsButton')}</div><div class="shiftBar"><div class="shiftInfo"><span class="liveDot ${paused||state.phase!=='active'?'paused':''}"></span><div><strong>${phaseText()}</strong><small>${clock()} — 16:00 · репутация ${state.reputation}/100</small></div></div><div class="shiftControls">${state.phase==='prep'?button('start',`${icon('play')}<span>Начать смену</span>`,'','primary'):state.phase==='report'?button('report',`${icon('calls')}Итоги`,'','primary'):button('pause',icon(paused?'play':'pause'),`aria-label="${paused?'Продолжить':'Пауза'}"`,'iconButton')+button('speed',speed+'×','aria-label="Скорость игры"','speedButton')}</div><progress value="${state.minute}" max="480" aria-label="Прогресс смены"></progress></div>`;
}
function pageHead(tag,title,description,action=''){return `<div class="pageHead"><div><div class="eyebrow">${tag}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
function metric(label,value,cls=''){return `<div class="metric"><small>${label}</small><strong class="${cls}">${value}</strong></div>`;}
function renderPage(){if(tab==='calls'){renderLegacyPage();return;}const p=$('#page'),scroll=p.scrollTop||0;p.innerHTML=managementPage(state,tab,subpages[tab],{button,icon,esc,rub,metric,vehicle,statuses});p.scrollTop=scroll;}
function renderLegacyPage(){
 const p=$('#page');
 if(tab==='calls'){
  const list=state.calls.filter(c=>filter==='all'||(filter==='done'?c.status==='done':c.status!=='done')).sort((a,b)=>b.priority-a.priority||a.id-b.id);
  p.innerHTML=pageHead('ДИСПЕТЧЕРСКАЯ','Обращения жителей',`${active().length} в работе · ${state.calls.filter(c=>c.status==='done').length} выполнено`)+`<div class="segmented">${[['active','Активные'],['done','Завершённые'],['all','Все']].map(([id,label])=>button('filter',label,`data-filter="${id}" aria-pressed="${filter===id}"`,filter===id?'active':'')).join('')}</div><div class="cards">${list.map(callCard).join('')||empty('calls',filter==='done'?'Пока нет завершённых заявок':'Все обращения под контролем',state.phase==='prep'?'Начните смену на карте, чтобы принять первые обращения.':'Новые заявки появятся во время смены.')}</div>`;
 }else if(tab==='services'){
  p.innerHTML=pageHead('ЛЮДИ КОМПАНИИ','Ваши бригады',`${state.crews.filter(c=>c.status==='idle').length} свободны · 6 специалистов`)+`<div class="summaryLine"><span>${icon('shield')} Все специальности укомплектованы</span><small>3 600 ₽ / бригада за смену</small></div><div class="cards">${state.crews.map(crewCard).join('')}</div>`;
 }else if(tab==='garage'){
  p.innerHTML=pageHead('АВТОПАРК И ОСНАЩЕНИЕ','Гараж компании','Надёжная техника — спокойная смена',button('settings',icon('gear'),'aria-label="Настройки"','iconButton'))+`<div class="metrics three">${metric('В автопарке','3 авто')}${metric('На выезде',state.crews.filter(c=>c.status!=='idle').length)}${metric('Готовы',state.crews.filter(c=>!unavailable(c)).length,'green')}</div><div class="cards">${state.crews.map(garageCard).join('')}</div>`;
 }else{
  const entries=state.ledger.filter(e=>e.day===state.day),income=entries.filter(e=>e.amount>0).reduce((a,e)=>a+e.amount,0),expenses=-entries.filter(e=>e.amount<0).reduce((a,e)=>a+e.amount,0);
  p.innerHTML=pageHead('ЭКОНОМИКА УК «УЮТ»','Финансы','Решения сегодня. Устойчивый район завтра.',button('settings',icon('gear'),'aria-label="Настройки"','iconButton'))+`<div class="balanceCard"><div class="eyebrow">ДОСТУПНЫЙ БЮДЖЕТ</div><h2>${rub(state.money)}</h2><div class="balanceFooter"><span>${icon('shield')} Репутация ${state.reputation}/100</span><span>День ${state.day}</span></div></div><div class="metrics">${metric('Доход за день','+'+rub(income),'green')}${metric('Расход за день','−'+rub(expenses))}</div><div class="forecast"><span>${icon('clock')} В конце смены</span><strong>+50 700 ₽</strong><small>Договоры − зарплаты − гараж. Материалы и ущерб отдельно.</small></div><div class="sectionHead"><h2>Дома под управлением</h2><span>3 договора</span></div>${state.homes.map(h=>`<button class="homeCard" data-action="home" data-id="${h.id}"><span class="homeIcon">${icon('home')}</span><span class="grow"><strong>${esc(h.name)}</strong><small>22 000 ₽ / смена · износ ${h.wear}%</small><span class="bar"><i style="width:${h.wear}%;background:var(--amber)"></i></span></span>${icon('chevron')}</button>`).join('')}<div class="sectionHead"><h2>История операций</h2><span>Последние 20</span></div><div class="ledger">${state.ledger.slice(0,20).map(e=>`<div class="ledgerRow"><span class="ledgerIcon ${e.amount>0?'green':''}">${icon(e.amount>0?'money':'arrow')}</span><span class="grow"><strong>${esc(e.label)}</strong><small>День ${e.day} · ${formatMinute(e.minute)}</small></span><b class="${e.amount>0?'green':''}">${e.amount>0?'+':'−'}${rub(Math.abs(e.amount))}</b></div>`).join('')||'<div class="emptySmall">Здесь появятся доходы и расходы компании.</div>'}</div>`;
 }
}
function formatMinute(minute){return `${String(Math.floor((minute+480)/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;}
function empty(ico,title,text){return `<div class="empty"><span>${icon(ico)}</span><h2>${title}</h2><p>${text}</p>${button('toMap','Перейти на карту','','subtle')}</div>`;}
function callCard(c){const service=E.TYPES[c.type][1],cr=state.crews.find(cr=>cr.job===c.id);return `<button class="callCard" data-action="call" data-id="${c.id}" style="--service:${E.COLORS[service]}"><span class="callCardIcon">${icon(c.status==='done'?'check':icons[service])}</span><span class="grow"><span class="row">${badge(c)}<small>№${String(c.id).padStart(3,'0')}</small></span><strong>${esc(E.TYPES[c.type][0])}</strong><span class="address">${icon('location')}${esc(state.homes[c.home].name)}</span><span class="callCardFooter"><span class="${c.late?'danger':''}">${c.status==='done'?'Работа принята':c.late?'Срок превышен':Math.max(0,c.due-state.minute)+' мин до срока'}</span><span>${cr?short[cr.service]:statuses[c.status]}</span></span></span>${icon('chevron')}</button>`;}
function staffRows(cr){return STAFF[cr.id].map(person=>`<div class="person"><span class="avatar" style="--service:${E.COLORS[cr.service]}">${person.initials}</span><span class="grow"><strong>${person.name}</strong><small>${person.role}</small></span><span class="experience">${person.years} лет<small>стаж</small></span></div>`).join('');}
function crewCard(cr){const c=state.calls.find(c=>c.id===cr.job),fatigue=cr.fatigue;return `<article class="crewCard" style="--service:${E.COLORS[cr.service]}"><div class="crewHeader"><span class="serviceSquare">${icon(icons[cr.service])}</span><span class="grow"><h2>${short[cr.service]}</h2><small>Бригада №${cr.id+1} · уровень ${cr.level}</small></span><span class="statusBadge ${cr.status==='idle'?'green':''}"><i></i>${statuses[cr.status]}</span></div><div class="staff">${staffRows(cr)}</div>${c?`<button data-action="call" data-id="${c.id}" class="assignmentStrip">${icon('location')}<span>${esc(state.homes[c.home].name)}<small>${esc(E.TYPES[c.type][0])}</small></span><strong>${cr.remaining} мин</strong>${icon('chevron')}</button>`:'<div class="assignmentStrip quiet">'+icon('check')+'Готовы принять следующую заявку</div>'}<div class="crewStats"><div><small>Усталость</small><strong>${fatigue}%</strong><span class="bar"><i style="width:${fatigue}%;background:${fatigue>80?'var(--red)':'var(--green)'}"></i></span></div><div><small>Опыт бригады</small><strong>${cr.xp} / 30 XP</strong><span class="bar"><i style="width:${Math.min(100,cr.xp/30*100)}%"></i></span></div></div><div class="cardFooter"><small>Обучение повышает скорость ремонта</small>${button('maintain',icon('star')+'Обучить · 15 000 ₽',`data-id="${cr.id}" data-kind="train" ${cr.status!=='idle'||cr.xp<30||state.money<15000?'disabled':''}`,'subtle')}</div></article>`;}
function garageCard(cr){return `<article class="garageCard" style="--service:${E.COLORS[cr.service]}"><div class="row"><div><div class="eyebrow">${['САНТЕХНИЧЕСКАЯ','ЭЛЕКТРОТЕХНИЧЕСКАЯ','РЕМОНТНАЯ'][cr.service]} СЛУЖБА</div><h2>${cr.id===2?'Сервисный пикап':'Сервисный фургон'}</h2></div><span class="statusBadge ${!unavailable(cr)?'green':''}">${cr.status==='idle'?(unavailable(cr)?'Нужно обслуживание':'Готов к выезду'):'На выезде'}</span></div><div class="vehicleStage">${vehicle(cr.service)}<span class="vehicleNumber">УЮТ · 00${cr.id+1}</span></div><div class="vehicleStats">${[['fuel','Топливо',cr.fuel],['gear','Состояние',cr.condition],['tool','Оснащение',cr.equipment/3*100]].map(([ico,name,n])=>`<div>${icon(ico)}<small>${name}</small><strong>${name==='Оснащение'?cr.equipment+'/3':n+'%'}</strong><span class="bar"><i style="width:${n}%;background:${n<20?'var(--red)':'var(--service)'}"></i></span></div>`).join('')}</div><div class="garageActions">${button('maintain',icon('fuel')+'Заправить и ТО <strong>5 000 ₽</strong>',`data-id="${cr.id}" data-kind="service" ${cr.status!=='idle'||state.money<5000?'disabled':''}`,'primary')}${button('maintain',icon('tool')+(cr.equipment>=3?'Полное оснащение':'Оснастить <strong>'+rub(25000*cr.equipment)+'</strong>'),`data-id="${cr.id}" data-kind="equipment" ${cr.status!=='idle'||cr.equipment>=3||state.money<25000*cr.equipment?'disabled':''}`,'subtle')}</div></article>`;}
function renderDialog(){
 if(!modal)return;const {kind,id}=modal;const domain=domainDialog(state,kind,id,{button,icon,esc,rub,metric});if(domain){dialog.innerHTML=shell(esc(domain.title),domain.body);if(!dialog.open)dialog.showModal();return;}let title='',body='',eyebrow='УК «УЮТ»';
 if(kind==='call'){
  const c=state.calls.find(c=>c.id===id);if(!c){close();return;}const t=E.TYPES[c.type],cr=state.crews.find(cr=>cr.job===c.id);
  title=t[0];eyebrow='ОБРАЩЕНИЕ №'+String(c.id).padStart(3,'0');
  body=`${badge(c)}<p class="dialogAddress">${icon('location')}${esc(state.homes[c.home].name)}</p><div class="quote">${icon('phone')}<p>«${esc(t[5])}»<small>Житель дома · ${formatMinute(Math.max(0,c.created))}</small></p></div>${c.asked?`<div class="notice">${icon('check')}<span>${esc(t[6])}<small>Обстоятельства уточнены. Диагностика займёт 4 минуты.</small></span></div>`:c.status!=='done'?button('question',icon('phone')+'Уточнить обстоятельства',`data-id="${id}"`,'subtle wide'):''}<div class="metrics">${metric(c.status==='contractor'?'Стоимость подрядчика':'Со склада',c.status==='contractor'?rub(t[4]*3):E.materials(state,c).quantity+' компл. '+E.PARTS[t[1]].short)}${metric(c.status==='done'?'Завершено':c.late?'Просрочено':'До срока',c.status==='done'?formatMinute(c.completed):Math.max(0,c.due-state.minute)+' мин',c.late?'danger':'')}</div><div class="jobStatus"><i class="liveDot ${c.status==='done'?'':'paused'}"></i><strong>${statuses[c.status]}</strong>${cr?`<span>${cr.remaining} мин на этапе</span>`:c.status==='contractor'?`<span>${c.remaining} мин осталось</span>`:''}</div>${c.status==='done'?'<p class="notice">'+icon('check')+'Работа принята. Износ дома снижен на 2 пункта.</p>':''}${c.status==='blocked'?`<div class="notice warning">Сначала завершите этап №${c.dependsOn}. После него откроется эта работа.</div>`:''}${c.status==='new'&&!c.contained?button('contain',icon('shield')+'Передать инструкции безопасности · +15 мин',`data-id="${id}"`,'subtle wide'):''}${c.status==='new'?`<div class="sectionHead"><h3>Назначить бригаду</h3><small>Комплекты резервируются на складе</small></div>${state.crews.map(cr=>{const reason=E.dispatchReason(state,c,cr);return button('dispatch',`<span class="serviceSquare" style="--service:${E.COLORS[cr.service]}">${icon(icons[cr.service])}</span><span class="grow"><strong>${short[cr.service]}</strong><small>${reason||'Готова · дорога '+travelTime(cr.home,c.home,VEHICLE_MODELS.find(m=>m.id===E.crewVehicle(state,cr).model).speed)+' мин'}</small></span>${icon('chevron')}`,`data-id="${id}" data-crew="${cr.id}" ${reason?'disabled':''}`,'assignButton');}).join('')}<div class="contractor">${button('outsource','Привлечь подрядчика <strong>'+rub(t[4]*3)+'</strong>',`data-id="${id}" ${state.phase!=='active'||state.money<t[4]*3?'disabled':''}`,'subtle wide')}<small>Выполнение за 45 минут. Ваши бригады остаются свободны.</small></div>`:''}`;
 }else if(kind==='home'){
  const h=state.homes[id];title=h.name;eyebrow='ДОМ ПОД УПРАВЛЕНИЕМ';body=`<div class="homeHero">${icon('home')}<span>Договор обслуживания<strong>УК «Уют»</strong></span></div><div class="metrics">${metric('Износ сетей',h.wear+'%',h.wear>70?'danger':'')}${metric('Доход за смену','22 000 ₽','green')}</div><div class="sectionHead"><h3>Заявки по дому</h3></div>${active().filter(c=>c.home===id).map(callCard).join('')||'<p class="notice">'+icon('shield')+'Нет активных обращений</p>'}<div class="preventCard"><h3>Профилактика инженерных сетей</h3><p>Снижает износ на 15 пунктов и вероятность аварий. Доступна перед началом смены.</p>${button('prevent','Провести профилактику <strong>12 000 ₽</strong>',`data-id="${id}" ${state.phase!=='prep'||state.money<12000||h.wear===0?'disabled':''}`,'primary wide')}</div>`;
 }else if(kind==='districts'){
  title='Районы города';eyebrow='ЗОНА ОТВЕТСТВЕННОСТИ';body=`<div class="districtPreview"><span class="badge green">Под вашим управлением</span><h3>Северный район</h3><p>Тихие дворы. Знакомые адреса. Большая ответственность.</p></div><div class="metrics">${metric('Дома','3 договора')}${metric('Доход за смену','66 000 ₽','green')}</div><p class="muted">Выберите дом, чтобы посмотреть состояние или найти его на карте.</p>${state.homes.map(h=>button('focusHome',`<span class="homeIcon">${icon('home')}</span><span class="grow"><strong>${esc(h.name)}</strong><small>Износ ${h.wear}% · ${active().filter(c=>c.home===h.id).length} активных заявок</small></span>${icon('chevron')}`,`data-id="${h.id}"`,'assignButton')).join('')}`;
 }else if(kind==='report'){
  const r=state.report;if(!r){close();return;}title='Хорошая работа, управляющий';eyebrow=`ИТОГИ СМЕНЫ · ДЕНЬ ${state.day}`;body=`<div class="reportHero">${icon(r.late?'calls':'shield')}<h3>${r.pending?'Завтра продолжим':'Район может спать спокойно'}</h3><p>${r.pending?'Незавершённые заявки сохранят этап и прогресс.':'Все обращения жителей обработаны.'}</p></div><div class="metrics">${metric('Завершено',r.done+' / '+r.total)}${metric('Результат за день',(r.net>=0?'+':'−')+rub(Math.abs(r.net)),r.net>=0?'green':'danger')}${metric('С просрочкой',r.late,r.late?'danger':'')}${metric('На следующий день',r.pending)}</div><div class="notice">${icon('crew')}<span>Отдых между сменами<small>Усталость бригад снизится на 50 пунктов. Активные работы продолжатся завтра.</small></span></div>${button('next','К следующему дню '+icon('arrow'),'','primary wide')}`;
 }else if(kind==='settings'){
  title='Настройки';eyebrow='УПРАВДОМ · 0.3.0-ALPHA';body=`<div class="settingsList">${[['sound','volume','Звуки диспетчерской','Сигналы новых обращений'],['motion','map','Анимация карты','Движение машин и подсветка маршрутов'],['labels','location','Адреса на карте','Подписи домов района']].map(([key,ico,name,description])=>button('setting',`${icon(ico)}<span class="grow"><strong>${name}</strong><small>${description}</small></span><span class="switch ${settings[key]?'on':''}"><i></i></span>`,`data-key="${key}" aria-pressed="${settings[key]}"`,'settingRow')).join('')}</div><div class="sectionHead"><h3>Ваша компания</h3><span class="green">${loadError?'Нужно восстановление':saveError?'Ошибка записи':'Автосохранение включено'}</span></div><p class="muted">Прогресс хранится на устройстве. При повреждении основного сохранения игра использует резервную копию.</p><div class="saveActions">${button('export',icon('download')+'Экспорт',loadError?'disabled':'','subtle')}${button('import',icon('upload')+'Импорт','','subtle')}</div>${button('help',icon('info')+'Как играть','','settingRow')}${button('reset','Начать новую компанию','','danger subtle wide')}<p class="versionNote">Управдом · УК «Уют»<br>Полностью офлайн. Без рекламы и покупок.<br>Версия 0.3.0-alpha</p>`;
 }else if(kind==='help'){
  title='Порядок в каждом доме';eyebrow='ДОБРО ПОЖАЛОВАТЬ В «УЮТ»';body=`<div class="tutorialHero">${icon('home')}<h3>Вы — управляющий компанией</h3><p>3 млн ₽, три дома и три бригады.<br>За каждым обращением — чей-то дом.</p></div><ol class="tutorial"><li><strong>Подготовьте службы</strong><p>В гараже заправьте машины и проверьте оснащение. В карточках домов доступна профилактика.</p></li><li><strong>Начните смену на карте</strong><p>Откройте заявку, уточните обстоятельства и отправьте бригаду нужной специальности.</p></li><li><strong>Следите за сроками</strong><p>Критический — 65 минут, высокий — 110, обычный — 180. Подрядчик поможет, если ваши люди заняты.</p></li><li><strong>Подведите итоги в 16:00</strong><p>Получите доход по договорам. Незавершённые работы перейдут на следующий день.</p></li></ol><div class="notice">${icon('pause')}<span>В вашем темпе<small>Пауза всегда доступна. Время не идёт в открытых карточках и в фоне. После загрузки игра на паузе.</small></span></div>${button('close','Всё понятно, за работу','','primary wide')}`;
 }else if(kind==='loadError'){
  title='Сохраним ваши данные';body=`<div class="notice warning">${icon('shield')}<span>Не удалось загрузить компанию<small>Основное сохранение и резервная копия недоступны или повреждены.</small></span></div><p>Автосохранение отключено: прежние данные не будут перезаписаны. Попробуйте перезапустить приложение или импортировать сохранённую копию.</p><div class="saveActions">${button('import',icon('upload')+'Импорт','','primary')}${button('reset','Новая компания','','subtle')}</div><p class="muted">Если закрыть это окно и играть дальше, новый прогресс не сохранится до восстановления или подтверждения новой компании.</p>`;
 }else if(kind==='reset'){
  title='Начать заново?';body=`<p>Текущая компания и её резервная копия будут заменены. Перед сбросом можно экспортировать прогресс в настройках.</p><div class="saveActions">${button('close','Отмена','','subtle')}${button('confirmReset','Начать новую игру','','dangerButton')}</div>`;
 }else if(kind==='importConfirm'){
  title='Загрузить компанию?';body=`<p>Будет восстановлена компания из файла. Текущий прогресс заменится после подтверждения.</p><div class="metrics">${metric('День',imported.day)}${metric('Бюджет',rub(imported.money))}</div><div class="saveActions">${button('close','Отмена','','subtle')}${button('confirmImport','Восстановить','','primary')}</div>`;
 }
 dialog.innerHTML=shell(esc(title),body,eyebrow);if(!dialog.open)dialog.showModal();
}
function focusHome(id){tab='map';view.zoom=1.4;view.x=view.y=0;view.focus=MARKERS[id];view.district=state.homes[id].district;close();render();}
function downloadSave(){if(navigator.userAgent.includes('UpravdomAndroid/')){window.location.href='upravdom://export?data='+encodeURIComponent(E.encode(state));return;}const blob=new Blob([E.encode(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`upravdom-day-${state.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Копия компании подготовлена');}
function action(el){
 const a=el.dataset.action,id=Number(el.dataset.id);let changed=false,message='';
 try{
  if(a==='tab'){tab=el.dataset.tab;$('#page').scrollTop=0;}
  else if(a==='toMap')tab='map';
  else if(a==='goCalls')tab='calls';
  else if(a==='filter')filter=el.dataset.filter;
  else if(a==='subpage')subpages[tab]=el.dataset.sub;
  else if(a==='contracts'){tab='finance';subpages.finance='contracts';close();}
  else if(a==='focusDistrict'){view.district=id;view.focus=null;view.zoom=1;view.x=view.y=0;tab='map';close();}
  else if(a==='showCity'){view.district=null;view.focus=null;view.zoom=1;view.x=view.y=0;tab='map';close();}
  else if(a==='rotate'){view.bearing+=Math.PI/4;dirty=true;draw();return;}
  else if(a==='tilt'){view.tilt=view.tilt===1?.55:1;dirty=true;draw();return;}
  else if(a==='start'){E.start(state);paused=false;lastTick=performance.now();changed=true;if(settings.sound)notifySound(true);}
  else if(a==='pause'){paused=!paused;lastTick=performance.now();}
  else if(a==='speed'){speed=speed===1?2:speed===2?4:1;lastTick=performance.now();}
  else if(a==='call'){open('call',id);return;}
  else if(a==='home'){open('home',id);return;}
  else if(a==='question'){E.question(state,id);changed=true;}
  else if(a==='contain'){E.contain(state,id);changed=true;message='Инструкция передана. Срок увеличен, работа станет безопаснее.';}
  else if(a==='hire'){E.hire(state,id);changed=true;message='Сотрудник принят в штат';}
  else if(a==='fire'){E.fire(state,id);changed=true;message='Расчёт выполнен';}
  else if(a==='trainEmployee'){E.trainEmployee(state,id);changed=true;message='Квалификация повышена';}
  else if(a==='buyVehicle'){E.buyVehicle(state,el.dataset.model);changed=true;message='Автомобиль доставлен в гараж';}
  else if(a==='sellVehicle'){E.sellVehicle(state,id);changed=true;message='Автомобиль продан';}
  else if(a==='newCrew'){open('newCrew');return;}
  else if(a==='formCrew'){E.formCrew(state,[Number($('#crew-person-1').value),Number($('#crew-person-2').value)],Number($('#crew-vehicle').value));changed=true;close();subpages.services='crews';message='Бригада сформирована';}
  else if(a==='disband'){E.disbandCrew(state,id);changed=true;message='Сотрудники и автомобиль свободны';}
  else if(a==='acceptContract'){E.acceptContract(state,id);changed=true;message='Договор заключён. Обязательства начнутся со следующей смены.';}
  else if(a==='renovate'){E.renovate(state,id);changed=true;message='Капитальный ремонт выполнен';}
  else if(a==='orderParts'){const part=Number(el.dataset.part);E.orderParts(state,part,Number($('#stock-qty-'+part).value),el.dataset.express==='true');changed=true;message='Поставка оформлена';}
  else if(a==='expandWarehouse'){E.expandWarehouse(state);changed=true;message='Склад расширен';}
  else if(a==='dispatch'){E.dispatch(state,id,Number(el.dataset.crew));changed=true;message='Бригада отправлена. Маршрут построен.';}
  else if(a==='outsource'){E.outsource(state,id);changed=true;message='Подрядчик принял заявку';}
  else if(a==='maintain'){E.maintain(state,id,el.dataset.kind);changed=true;message='Готово. Служба подготовлена к работе.';}
  else if(a==='prevent'){E.prevent(state,id);changed=true;message='Профилактика завершена. Износ снижен.';}
  else if(a==='next'){E.nextDay(state);changed=true;paused=true;close();}
  else if(a==='zoomIn'){view.zoom=Math.min(2.7,view.zoom*1.2);dirty=true;draw();return;}
  else if(a==='zoomOut'){view.zoom=Math.max(.65,view.zoom/1.2);dirty=true;draw();return;}
  else if(a==='center'){view.x=view.y=0;view.zoom=1;view.focus=null;dirty=true;draw();return;}
  else if(a==='focusHome'){focusHome(id);return;}
  else if(a==='close'){close();return;}
  else if(['report','settings','districts','help','reset'].includes(a)){open(a);return;}
  else if(a==='confirmReset'){state=E.fresh();loadError=false;saveError=false;paused=true;speed=1;view.x=view.y=0;view.zoom=1;view.district=0;view.focus=null;changed=true;close();tab='map';}
  else if(a==='setting'){const key=el.dataset.key;if(!Object.hasOwn(settings,key))return;settings[key]=!settings[key];try{saveSettings(storage,settings);}catch{toast('Настройки действуют до закрытия приложения');}if(key==='sound'&&settings.sound)notifySound();}
  else if(a==='export'){downloadSave();return;}
  else if(a==='import'){$('#importFile').click();return;}
  else if(a==='confirmImport'){if(!imported)return;state=E.decode(E.encode(imported));imported=null;loadError=false;paused=true;changed=true;close();tab='map';message='Компания восстановлена';}
  if(changed)save();render();if(message)toast(message);
 }catch(e){toast(e.message);}
}
function draw(now=performance.now()){
 if(tab!=='map'||document.hidden)return;
 const running=!paused&&!dialog.open&&state.phase==='active';
 renderMap(canvas,state,view,{...settings,progress:running&&settings.motion?Math.min(speed,(now-lastTick)/1000*speed):0,now});dirty=false;
}
function shouldAnimate(){return tab==='map'&&!paused&&!document.hidden&&!dialog.open&&settings.motion&&state.phase==='active';}
function scheduleAnimation(){if(!frame&&shouldAnimate())frame=requestAnimationFrame(animate);}
function animate(now){frame=0;if(!shouldAnimate())return;if(now-lastDraw>50){draw(now);lastDraw=now;}frame=requestAnimationFrame(animate);}
const pointers=new Map();let drag=0,pinch=0,last=null,gesture=false;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);last=[e.clientX,e.clientY];if(pointers.size===1){drag=0;gesture=false;}if(pointers.size>=2){gesture=true;const [a,b]=[...pointers.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}});
canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size>=2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch>0)view.zoom=Math.max(.65,Math.min(2.7,view.zoom*d/pinch));pinch=d;}else{const dx=e.clientX-old[0],dy=e.clientY-old[1];view.x=Math.max(-900,Math.min(900,view.x+dx));view.y=Math.max(-1400,Math.min(1400,view.y+dy));drag+=Math.abs(dx)+Math.abs(dy);}last=[e.clientX,e.clientY];dirty=true;draw();});
canvas.addEventListener('pointerup',e=>{if(!pointers.has(e.pointerId))return;if(drag<8&&!gesture&&pointers.size===1){const r=canvas.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top],hit=view.hits.find(h=>Math.hypot(h.point[0]-p[0],h.point[1]-p[1])<(h.radius||30))||view.pick?.(p);if(hit)open(hit.call!==undefined?'call':'home',hit.call??hit.home);}pointers.delete(e.pointerId);last=pointers.size?[...pointers.values()][0]:null;});
function releasePointer(e){pointers.delete(e.pointerId);if(!pointers.size){last=null;gesture=false;}}
canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoom=Math.max(.65,Math.min(2.7,view.zoom*(e.deltaY<0?1.1:.9)));dirty=true;draw();},{passive:false});
document.addEventListener('click',e=>{const el=e.target.closest('button[data-action]');if(el&&!el.disabled)action(el);});
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
$('#importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2000000)throw Error('Файл слишком большой. Максимум 2 МБ.');imported=E.decode(await file.text());open('importConfirm');}catch(err){toast('Не удалось импортировать: '+err.message);}});
function background(){paused=true;lastTick=performance.now();pointers.clear();last=null;save();render();}
window.addEventListener('upravdom-pause',background);
window.addEventListener('upravdom-export-result',event=>toast(event.detail?'Копия компании сохранена':'Не удалось записать файл. Выберите другую папку.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)background();else{lastTick=performance.now();dirty=true;render();}});
window.addEventListener('pagehide',()=>{paused=true;save();});window.addEventListener('resize',()=>{dirty=true;draw();});
setInterval(()=>{lastTick=performance.now();if(!paused&&!document.hidden&&!dialog.open&&state.phase==='active'){const before=state.sequence;E.tick(state,speed);save();render();if(state.sequence>before&&settings.sound)notifySound(state.calls.filter(c=>c.id>before).some(c=>c.priority===3));if(state.phase==='report')open('report');}},1000);
loadArtwork(()=>{dirty=true;draw();});render();scheduleAnimation();
if(loadError)open('loadError');else if(loaded.recovered)toast('Основное сохранение повреждено. Компания восстановлена из резервной копии.');
