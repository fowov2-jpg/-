import {SCENARIOS, EQUIPMENT} from './operations-content.js';
import * as O from './shift-operations.js';
import {district, DISTRICT_NAMES, roadStop} from './campaign-city.js';
import {VEHICLE_MODELS} from './content.js';
import {icon} from './icons.js';
import {vehicle} from './graphics.js';
import {shiftSummary} from './company-reports.js';

export const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rub = n => Math.round(n).toLocaleString('ru-RU')+' ₽';
const b = (cmd,label,attrs='',cls='') => `<button data-cmd="${cmd}" ${attrs} class="${cls}">${label}</button>`;
const services = ['Сантехника','Электрика','Ремонт'];
const symbols = ['water','bolt','tool'];
const states = {idle:'Готова',travel:'В пути',repair:'Работает',waiting:'Ожидание служб',returning:'На базу'};
const address = (s,id) => district(s.seed,s.region).homes[id].name;
const tag = service => `<span class="opService opService${service}">${icon(symbols[service])}</span>`;
const time = minute => `${String(8+Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;

export function goals(s) {
  const o=s.operations, count=O.currentHouses(s).length, trust=O.reputation(s);
  return `<div class="opGoals" aria-label="Условия расширения компании"><span class="${o.districtShifts>=3?'met':''}">${icon('clock')} ${Math.min(3,o.districtShifts)}/3 смены</span><span class="${count>=4?'met':''}">${icon('home')} ${count}/4 дома</span><span class="${trust>=68?'met':''}">Доверие ${trust}/68</span><span class="${o.districtMajor?'met':''}">Крупная авария ${Math.min(1,o.districtMajor)}/1</span></div>`;
}

export function brief(s) {
  const weather=O.weather(s), houses=O.currentHouses(s);
  return `<section class="opBriefPage"><header class="opPageHeader">${b('menu',icon('chevron'),'aria-label="Главное меню"','iconButton')}<div><small>УК «УЮТ» · ДИСПЕТЧЕРСКАЯ</small><h2>${esc(DISTRICT_NAMES[s.region])}</h2></div>${b('settings',icon('gear'),'aria-label="Настройки"','iconButton')}</header>
    <div class="opBriefScroll"><div class="opBriefHero"><span class="eyebrow">ПЕРЕДАЧА СМЕНЫ · ДЕНЬ ${s.day}</span><h1>${s.day===1?'Три дома. Ваша ответственность.':'Город снова на связи.'}</h1><p>${s.day===1?'Вы приняли управляющую компанию «Уют». На линии жители, во дворе три бригады. Разберитесь в обращениях, распределите службы и сохраните дома в рабочем состоянии.':'Проверьте состояние домов, незавершённые работы и готовность служб. Сегодняшние решения останутся в истории компании.'}</p></div>
    <div class="opBriefMetrics"><div><small>Средства компании</small><strong data-budget>${rub(s.money)}</strong></div><div><small>Под управлением</small><strong>${houses.length} дома</strong></div><div><small>Доверие жителей</small><strong>${O.reputation(s)}%</strong></div></div>
    <div class="opWeatherBrief"><span>${icon('map')}</span><div><strong>${weather.label} · ${weather.temperature} °C</strong><small>${weather.description}</small></div></div>
    <article class="opBriefNote"><span class="eyebrow">${s.day===1?'ПЕРВАЯ СМЕНА':'ОПЕРАТИВНАЯ ЗАДАЧА'}</span><h3>${s.day===1?'Начните с разговора':'Снабжение важнее количества выездов'}</h3><p>${s.day===1?'Уточняйте обстоятельства и доступ. Для затопления подвала понадобится совместная работа сантехников, электриков и ремонтников. Время можно остановить в любой момент.':'Восстанавливайте сети, предупреждайте жителей об отключениях и учитывайте зависимость работ. Ожидающую бригаду можно отозвать на другую аварию.'}</p></article>
    <div class="opSectionHead"><h3>Рост компании</h3><span>Район ${s.region+1}/20</span></div>${goals(s)}
    <p class="opMuted">Новые районы открываются по результатам работы и доверию домов. Договоры и профилактика доступны в разделе «Дома».</p></div>
    <footer class="opPageFooter">${b('regionProceed',s.phase==='active'?'В диспетчерскую':'Проверить службы '+icon('arrow'),'','primary wide')}</footer></section>`;
}

export function compactCrew(s,cr) {
  const v=s.vehicles.find(v=>v.id===cr.vehicle), model=VEHICLE_MODELS.find(m=>m.id===v.model);
  const names=cr.members.map(id=>s.employees.find(p=>p.id===id));
  const kit=O.kitFor(s,cr);
  return `<article class="opCrewRow opServiceBorder${cr.service}"><button class="opCrewVehicle" data-cmd="vehicle" data-id="${v.id}" aria-label="${esc(model.name)}">${vehicle(cr.service,v.model)}</button><div class="opCrewInfo"><div><strong>Б${cr.id+1} · ${services[cr.service]}</strong><span class="opState ${cr.status==='idle'?'ready':''}">${states[cr.status]}</span></div><small>${esc(model.name)}</small><p>${names.map(p=>`<span title="Уровень ${p.level} · усталость ${p.fatigue}%">${esc(p.name.split(' ')[0])} <i>${'•'.repeat(p.level)}</i></span>`).join('')}</p><div class="opCrewResource"><span>Топливо <b>${v.fuel}%</b></span><span>Состояние <b>${v.condition}%</b></span></div></div><div class="opCrewTools">${b('op-equipment',icon(symbols[cr.service])+'<span>'+esc(kit.name)+'</span>',`data-id="${cr.id}" ${s.phase!=='prep'||cr.status!=='idle'?'disabled':''}`)}${b('disband','Состав',`data-id="${cr.id}" ${s.phase!=='prep'||cr.status!=='idle'?'disabled':''}`,'opTextButton')}</div></article>`;
}

export function crewRack(s,selectedCrew) {
  return `<div class="opRackHeading"><span>СЛУЖБЫ НА ЛИНИИ</span><span>${s.crews.filter(c=>c.status==='idle').length} свободны</span></div><div class="opCrewRack">${s.crews.map(cr=>{
    const pair=O.assignmentFor(s,cr.id),a=pair?.assignment;
    const operation=a?.task?O.definitions(pair.call).find(w=>w.id===a.task)?.label:null;
    return b('op-crew',`${tag(cr.service)}<span><strong>Б${cr.id+1}</strong><small>${cr.status==='repair'?esc(operation):states[cr.status]}${cr.status==='travel'?' · '+a.remaining+' мин':cr.status==='returning'?' · '+cr.returnTrip.remaining+' мин':''}</small></span><i class="opCrewDot ${cr.status}"></i>`,`data-id="${cr.id}" aria-label="Бригада ${cr.id+1}, ${services[cr.service]}, ${states[cr.status]}" aria-pressed="${cr.id===selectedCrew}"`,'opRackUnit '+(cr.id===selectedCrew?'picked':''));
  }).join('')}</div>`;
}

export function queue(s,open,selected) {
  const sorted=[...s.calls].sort((a,b)=>Number(b.late)-Number(a.late)||SCENARIOS[b.kind].priority-SCENARIOS[a.kind].priority||a.due-b.due);
  const newCount=sorted.filter(c=>c.status==='new'&&!c.deferred).length;
  const important=sorted.find(c=>c.mission!==selected&&!c.deferred);
  return `<section class="opQueue"><button data-cmd="queue" class="opQueueToggle" aria-expanded="${open}"><span class="opLiveDot"></span><strong>На линии ${s.calls.length}</strong><span>${newCount?'Без бригады '+newCount:'Все обращения приняты'}</span>${icon('chevron')}</button>${open?`<div class="opQueueList">${sorted.map(c=>b('select',`${tag(SCENARIOS[c.kind].service)}<span><strong>${esc(SCENARIOS[c.kind].title)}</strong><small>${esc(address(s,c.home))}</small></span><em class="${c.late?'late':''}">${c.deferred?'Завтра':c.late?'Срок истёк':Math.max(0,c.due-s.minute)+' мин'}</em>`,`data-id="${c.mission}"`,'opQueueCall')).join('')||'<p class="opMuted">На линии спокойно. Продолжайте время, чтобы принять следующие обращения.</p>'}</div>`:important?b('select',`<span class="opQueuePriority p${SCENARIOS[important.kind].priority}">${SCENARIOS[important.kind].priority===3?'!':icon('phone')}</span><span><strong>${esc(SCENARIOS[important.kind].title)}</strong><small>${important.deferred?'Согласовано на завтра':important.late?'Требует внимания':Math.max(0,important.due-s.minute)+' мин до норматива'}</small></span>${icon('arrow')}`,`data-id="${important.mission}"`,'opNextCall'):''}</section>`;
}

export function radioLine(s) {
  const e=s.operations.radio.at(-1);
  return `<button class="opRadioLine" data-cmd="op-radio" aria-label="Открыть журнал связи">${icon('phone')}<span><b>${e?time(e.minute):'На связи'}</b> ${e?esc(e.text):'Бригады ожидают вызов.'}</span></button>`;
}

function conversation(s,c) {
  const d=SCENARIOS[c.kind],node=d.dialogue[c.dialogue];
  const previous=c.answers.at(-1),reply=previous?d.dialogue[previous.node].options.find(o=>o.id===previous.choice).reply:null;
  return `<div class="opCaller"><span>${esc(d.caller.split(' ')[0][0])}</span><div><strong>${esc(d.caller)}</strong><small>${c.dialogue==='done'?'Разговор завершён':'Обращение жителя'}</small></div><div class="opVoice" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>
    <div class="opSpeech">${esc(reply??d.opening)}</div>
    ${node?`<p class="opDialoguePrompt">${esc(node.text)}</p><div class="opReplies">${node.options.map(o=>b('op-answer',esc(o.text),`data-choice="${o.id}" data-call="${c.mission}"`,'opReply')).join('')}</div>`:`<div class="opDecisionDone">${icon('check')} ${c.deferred?'Плановый обход согласован на завтра.':c.contained?'Локализация организована. Переходите к работам.':'Обстоятельства уточнены. Переходите к работам.'}</div>${b('op-tab','Координация служб '+icon('arrow'),'data-tab="work"','primary wide')}`}`;
}

function serviceAssignment(s,c,service) {
  const a=c.assignments.find(a=>a.service===service),pending=O.definitions(c).filter(w=>w.service===service&&!c.work.some(p=>p.id===w.id&&p.status==='done'));
  if(!pending.length) return `<div class="opServiceRow complete">${tag(service)}<span><strong>${services[service]}</strong><small>Работы выполнены</small></span>${icon('check')}</div>`;
  if(a){
    const cr=s.crews.find(cr=>cr.id===a.crew);
    const label=a.status==='travel'?'Прибытие через '+a.remaining+' мин':a.status==='waiting'?(O.waitingFor(c,service).length?'Ждёт: '+O.waitingFor(c,service).join(', '):'Ждёт материалы со склада'):O.definitions(c).find(w=>w.id===a.task).label;
    return `<div class="opServiceRow">${tag(service)}<span><strong>Б${cr.id+1} · ${services[service]}</strong><small>${esc(label)}</small>${a.status==='repair'?`<div class="opProgress"><i style="width:${100*(1-a.remaining/a.total)}%"></i></div><small>Осталось ${a.remaining} мин</small>`:''}</span>${a.status==='waiting'?b('op-withdraw','Отозвать',`data-id="${cr.id}" data-call="${c.mission}"`,'opSmall'):a.status==='repair'?'<b class="opWorkingDot"></b>':icon('arrow')}</div>`;
  }
  const possible=s.crews.filter(cr=>cr.service===service).map(cr=>({cr,reason:O.reason(s,c,cr)}));
  const eligible=possible.filter(p=>!p.reason).map(p=>({...p,trip:O.travelEstimate(s,p.cr,roadStop(district(s.seed,s.region).homes[c.home]))})).sort((a,b)=>a.trip.minutes-b.trip.minutes);
  return `<div class="opServiceRow">${tag(service)}<span><strong>${services[service]}</strong><small>${pending.length} ${pending.length===1?'этап':'этапа'} · ${pending.reduce((n,d)=>n+d.quantity,0)} компл.</small>${!eligible.length?`<small class="opWarning">${esc(possible[0]?.reason??'Нет сформированной бригады')}</small>`:''}</span>${eligible.length?b('op-options',`Выбрать <span>от ${eligible[0].trip.minutes} мин ${icon('arrow')}</span>`,`data-service="${service}" data-call="${c.mission}"`,'opAssign'):b('prep','Службы','','opSmall')}</div>`;
}

export function assignmentChoices(s,c,service){
  const pending=O.definitions(c).filter(d=>d.service===service&&!c.work.some(w=>w.id===d.id&&w.status==='done'));
  const rows=s.crews.filter(cr=>cr.service===service).map(cr=>{
    const reason=O.reason(s,c,cr),v=s.vehicles.find(v=>v.id===cr.vehicle),model=VEHICLE_MODELS.find(m=>m.id===v.model);
    const trip=O.travelEstimate(s,cr,roadStop(district(s.seed,s.region).homes[c.home]));
    const work=pending.reduce((n,d)=>n+O.workTime(s,c,cr,d),0);
    return {cr,v,model,reason,trip,work};
  }).sort((a,b)=>Number(!!a.reason)-Number(!!b.reason)||(a.trip.minutes+a.work)-(b.trip.minutes+b.work));
  return `<p class="opMuted">${esc(SCENARIOS[c.kind].title)} · ${services[service]}. Сравните дорогу и время работ с учётом оснащения. Ожидание связанных служб в эти минуты не входит.</p><div class="opAssignChoices">${rows.map(({cr,v,model,reason,trip,work})=>b('op-assign',`<span class="opChoiceVehicle">${vehicle(cr.service,v.model)}</span><span class="opChoiceBody"><strong>Б${cr.id+1} · ${esc(model.name)}</strong><small>${esc(O.kitFor(s,cr).name)}</small>${reason?'<em>'+esc(reason)+'</em>':`<em>Дорога ${trip.minutes} мин · работы ${work} мин</em><small>${trip.weather}${trip.traffic?' · затор +'+trip.traffic+' мин':''} · топливо ${v.fuel}%</small>`}</span>${icon('arrow')}`,`data-id="${cr.id}" data-call="${c.mission}" ${reason?'disabled':''}`,'opAssignChoice')).join('')}</div>`;
}

function works(s,c) {
  const defs=O.definitions(c),done=c.work.filter(w=>w.status==='done').length;
  const last=c.answers.at(-1),reply=last?SCENARIOS[c.kind].dialogue[last.node].options.find(o=>o.id===last.choice).reply:null;
  return `${reply?'<p class="opDecisionOutcome">'+esc(reply)+'</p>':''}${c.flags.escalated?'<p class="opWarning opRisk">Авария развилась: после откачки нужна дополнительная очистка.</p>':''}${c.external?`<div class="opExternal">Сетевой подрядчик · восстановление через ${c.external.remaining} мин</div>`:''}
    <div class="opAssignments">${c.external?'':[...new Set(defs.map(w=>w.service))].map(service=>serviceAssignment(s,c,service)).join('')}</div>
    <details class="opSteps" ${c.kind==='flood'||c.kind==='pump'?'open':''}><summary>План восстановления <b>${done}/${defs.length}</b></summary><ol>${defs.map(d=>{const w=c.work.find(w=>w.id===d.id);return `<li class="${w.status}"><span>${w.status==='done'?icon('check'):w.status==='working'?'<i></i>':icon('clock')}</span><div>${esc(d.label)}${w.status==='pending'&&d.requires.some(id=>!c.work.some(p=>p.id===id&&p.status==='done'))?'<small>После предыдущих этапов</small>':''}</div></li>`;}).join('')}</ol></details>`;
}

export function drawer(s,selected,tab,paused) {
  const c=s.calls.find(c=>c.mission===selected);
  if(!c) return `<div class="opMapHint mapHint"><span>${s.phase==='prep'?'Начните смену, когда службы готовы':s.calls.length?'Нажмите на обращение на карте':'На линии спокойно. Продолжайте время.'}</span>${b(s.phase==='prep'?'start':'op-focus',s.phase==='prep'?'Начать':icon('location'),s.phase==='prep'?'':'aria-label="Показать зону обслуживания"','opSmall')}</div>`;
  const d=SCENARIOS[c.kind],h=O.currentHouses(s).find(h=>h.id===c.home);
  const alerts=[h.outages.water?'Нет воды':'',h.outages.electric?'Нет питания':''].filter(Boolean);
  return `<aside class="opIncident callDrawer" aria-label="Авария: ${esc(d.title)}"><header class="opIncidentHeader">${tag(d.service)}<div><span class="eyebrow">${d.priority===3?'АВАРИЙНЫЙ ВЫЗОВ':'ОБРАЩЕНИЕ'} · №${String(c.mission+1).padStart(3,'0')}</span><h3>${esc(d.title)}</h3><small>${esc(address(s,c.home))}</small></div>${b('deselect',icon('close'),'aria-label="Закрыть обращение"','iconButton')}</header>
    <div class="opIncidentMeta"><span class="${c.late?'late':''}">${c.deferred?'Обход завтра':c.late?'Норматив истёк':Math.max(0,c.due-s.minute)+' мин до норматива'}</span><span>${alerts.length?alerts.join(' · '):'Снабжение дома работает'}</span></div>
    <div class="opIncidentTabs" role="tablist" aria-label="Раздел обращения">${b('op-tab','Разговор'+(c.dialogue!=='done'?' <i></i>':''),`data-tab="call" role="tab" aria-selected="${tab==='call'}"`,tab==='call'?'active':'')}${b('op-tab','Работы <b>'+c.work.filter(w=>w.status==='done').length+'/'+c.work.length+'</b>',`data-tab="work" role="tab" aria-selected="${tab==='work'}"`,tab==='work'?'active':'')}</div>
    <div class="opIncidentBody" role="tabpanel">${c.deferred?'<p class="opMuted">Вызов перенесён по согласованию с домом. Бригада понадобится завтра, просрочка за сегодня не начисляется.</p>':tab==='call'?conversation(s,c):works(s,c)}</div>
    <footer class="opIncidentFooter"><span class="opPausedLabel">${paused?'Время остановлено':'Смена идёт'}</span>${b('op-run',paused?'Продолжить '+icon('play'):'Пауза '+icon('pause'),'','primary')}</footer></aside>`;
}

export function mapPage(s,{paused,speed,selected,selectedCrew,queueOpen,tab}) {
  const w=O.weather(s);
  return `<section class="campaignMapArea opDispatch"><canvas id="campaignMap" aria-label="Оперативная карта района. Двигайте одним пальцем, меняйте масштаб двумя. Обращения и службы доступны кнопками."></canvas>
    <header class="opToolbar dispatchToolbar">${b('menu',icon('home'),'aria-label="Главное меню"','opToolbarButton')}${b(s.phase==='prep'?'start':'pause',icon(paused?'play':'pause'),`aria-label="${paused?'Продолжить время':'Пауза'}"`,'opToolbarButton')}${b('speed',speed+'×','aria-label="Изменить скорость времени"','opToolbarButton')}<div class="opClock"><strong>${time(s.minute)}</strong><small>СМЕНА ${String(s.day).padStart(2,'0')}</small></div><div class="opMapBudget"><small>УК «УЮТ»</small><b data-budget>${rub(s.money)}</b></div></header>
    <div class="opMapConditions"><span>${w.label} · ${w.temperature}°</span>${b('op-focus',icon('location'),'aria-label="Вся зона обслуживания"','opFocus')}</div>
    <div id="campaignIncoming" class="opIncoming">${queue(s,queueOpen,selected)}</div>
    <div id="campaignDrawer" class="opOverlay">${drawer(s,selected,tab,paused)}</div>
    <div class="opDispatchBase"><div id="opRadio">${radioLine(s)}</div><div id="quickSelect">${crewRack(s,selectedCrew)}</div></div>
  </section><nav class="campaignBottom opNav" aria-label="Игровое меню">${b('map',icon('map')+'<span>Карта</span>','aria-current="page"')}${b('prep',icon('crew')+'<span>Службы</span>')}${b('addresses',icon('home')+'<span>Дома</span>')}${b('finance',icon('money')+'<span>Компания</span>')}</nav>`;
}

export function equipment(s,crewId) {
  const cr=s.crews.find(cr=>cr.id===crewId),current=O.kitFor(s,cr);
  return `<p class="opMuted">Б${cr.id+1} · ${services[cr.service]}. Комплект меняет скорость конкретных работ. Купленное оснащение можно передавать между свободными бригадами перед сменой.</p><div class="opEquipmentList">${EQUIPMENT.filter(k=>k.service===cr.service).map(k=>b('op-equip',`<span>${icon(symbols[cr.service])}</span><div><strong>${esc(k.name)}</strong><small>${esc(k.detail)}</small><b>${k.id===current.id?'Установлен':!O.equipmentPrice(s,k)?'Установить':rub(k.price)}</b></div>`,`data-id="${cr.id}" data-kit="${k.id}" ${k.id===current.id?'disabled':''}`,'opEquipment')).join('')}</div>`;
}

export function houses(s) {
  return `<section class="opHouseIntro"><span class="eyebrow">ДОМА ПОД УПРАВЛЕНИЕМ</span><h2>Состояние имеет историю</h2><p>Аварии меняют состояние сетей и доверие. Профилактика перед сменой уменьшает будущий ущерб.</p></section>${O.currentHouses(s).map(h=>`<button class="opHouse" data-cmd="op-house" data-id="${h.id}"><div class="opHouseHeading">${icon('home')}<span><strong>${esc(address(s,h.id))}</strong><small>${h.rate.toLocaleString('ru-RU')} ₽ / смена · доверие ${Math.round(h.trust)}%</small></span>${icon('chevron')}</div><div class="opHouseSystems">${[['water','Вода'],['electric','Электрика'],['structure','Здание']].map(([k,n])=>`<span><small>${n}</small><b class="${h[k]<60?'opWarning':''}">${Math.round(h[k])}%</b><i style="--condition:${h[k]}%"></i></span>`).join('')}</div>${h.outages.water||h.outages.electric?`<p class="opWarning">${h.outages.water?'Подача воды ограничена. ':''}${h.outages.electric?'Питание отключено.':''}</p>`:''}<p>${esc(h.history[0]?.text??'Дом принят в управление. История обращений появится после начала работы.')}</p></button>`).join('')}
    <div class="opSectionHead"><h3>Новые договоры</h3><span>${O.currentHouses(s).length}/8 домов района</span></div><p class="opMuted">Приём нового дома доступен после первой смены при доверии от 65.</p>${O.candidates(s).slice(0,2).map(c=>`<article class="opOffer"><div><strong>${esc(c.home.name)}</strong><small>Новый договор · приём и обследование</small></div>${b('op-sign',rub(c.fee),`data-id="${c.id}" ${s.phase!=='prep'||s.operations.districtShifts<1||O.reputation(s)<65||s.money<c.fee?'disabled':''}`,'subtle')}</article>`).join('')}`;
}

export function houseDetail(s,id) {
  const h=O.currentHouses(s).find(h=>h.id===id);
  return `<div class="opHouseDetail"><div class="opBriefMetrics"><div><small>Доверие</small><strong>${Math.round(h.trust)}%</strong></div><div><small>Без воды за всё время</small><strong>${h.waterMinutes} мин</strong></div><div><small>Без питания</small><strong>${h.electricMinutes} мин</strong></div></div><h3>Профилактика</h3><p class="opMuted">+20 к состоянию системы и снижение роста ущерба на 35% в течение трёх смен.</p>${[['water','Водоснабжение'],['electric','Электросеть'],['structure','Кровля и входы']].map(([k,n])=>`<div class="opPrevent"><span><strong>${n} · ${Math.round(h[k])}%</strong><small>${h.prevention[k]>=s.day?'Обслужено · защита до дня '+h.prevention[k]:'Плановый осмотр и обслуживание'}</small></span>${b('op-prevent','12 000 ₽',`data-id="${id}" data-system="${k}" ${s.phase!=='prep'||s.money<12000||h.prevention[k]>=s.day||h[k]>=95?'disabled':''}`,'subtle')}</div>`).join('')}<h3>История дома</h3><ol class="opHouseHistory">${h.history.map(e=>`<li><small>День ${e.day}</small><span>${esc(e.text)}</span></li>`).join('')||'<li>Пока нет записей.</li>'}</ol></div>`;
}

export function report(s) {
  const r=s.report,f=shiftSummary(s);
  const priorities=[SCENARIOS.flood.title,SCENARIOS.pump.title,SCENARIOS.leak.title,SCENARIOS.roof.title,SCENARIOS.outage.title];
  const choices=[...new Map([...r.decisions].reverse().map(d=>[d.call,d])).values()].sort((a,b)=>(priorities.includes(a.title)?priorities.indexOf(a.title):10)-(priorities.includes(b.title)?priorities.indexOf(b.title):10));
  return `<section class="opReport"><div class="opReportGrade"><span class="eyebrow">СМЕНА ${s.day} · ${esc(DISTRICT_NAMES[s.region])}</span><h2>${esc(r.grade??'Кампания завершена')}</h2></div><div class="opReportStats"><div><strong>${r.results.filter(v=>v.success).length}</strong><small>Устранено</small></div><div><strong>${r.pending}</strong><small>Переносится</small></div><div><strong>${r.trust}%</strong><small>Доверие ${r.trustDelta>=0?'+':''}${r.trustDelta}</small></div></div>
    <div class="opReportMoney"><span>Итог компании</span><b class="${f.net<0?'opWarning':''}">${f.net>0?'+':''}${rub(f.net)}</b></div><p class="opMuted">Ущерб ${rub(r.damage)} · перерасчёт за отключения ${rub(r.compensation)}.<br>Суммарные отключения по домам: вода ${r.waterMinutes} мин, питание ${r.electricMinutes} мин.</p>
    <h3>Что изменили ваши решения</h3><div class="opReportDecisions">${r.decisions.length?choices.slice(0,3).map(d=>`<article><strong>${esc(d.title)}</strong><p>${esc(d.text)}</p><small>${esc(d.result)}</small></article>`).join(''):'<p class="opMuted">Вы передавали обращения без разговора. Бригады выясняли обстоятельства на месте. В следующую смену уточняйте доступ и выбирайте способ локализации.</p>'}</div>
    <details class="opReportResults"><summary>Результаты обращений (${r.results.length})</summary>${r.results.map(v=>`<p>${v.success?icon('check'):icon('close')}<span>${esc(v.title)}<small>${v.late?'Норматив превышен · ':''}Ущерб ${rub(v.damage)} · доверие ${v.trust>0?'+':''}${v.trust}</small></span></p>`).join('')}</details>
    <h3>Следующий шаг компании</h3>${goals(s)}<p class="opMuted">${O.canExpand(s)?'Компания выполнила условия расширения. Можно открыть следующий район.':r.pending?'Незавершённые обращения и бригады сохраняются. Проверьте остаток перед новой сменой.':O.currentHouses(s).length<4?'Дома готовы к новому договору. Примите четвёртый дом в разделе «Дома».':'Продолжайте надёжно обслуживать дома, чтобы расширить зону ответственности.'}</p></section>`;
}

export function company(s) {
  const f=shiftSummary(s);
  return `<div class="financeHeading"><span class="eyebrow">УК «УЮТ» · ДЕНЬ ${s.day}</span><h2 data-budget>${rub(s.money)}</h2><p class="opMuted">${s.operations.houses.length} договоров · ${s.operations.completed} обращений устранено</p></div><div class="opBriefMetrics"><div><small>Поступления</small><strong>${rub(f.income)}</strong></div><div><small>Расходы</small><strong>${rub(f.costs)}</strong></div><div><small>Доверие района</small><strong>${O.reputation(s)}%</strong></div></div><h3>Условия расширения</h3>${goals(s)}${O.canExpand(s)&&s.region<19?b('nextDistrict','Открыть следующий район','','primary wide'):''}<h3>Операции компании</h3><div class="transactionList">${s.ledger.map(e=>`<article class="transaction"><div><strong>${esc(e.label)}</strong><small>День ${e.day}</small></div><span class="${e.amount<0?'':'green'}">${e.amount>0?'+':''}${rub(e.amount)}</span></article>`).join('')||'<p class="opMuted">Операции появятся после начала работы.</p>'}</div>`;
}

export function guide() {
  return `<ol class="guideSteps"><li><strong>Примите обращение</strong><p>Нажмите на звонок или маркер. Вкладка «Разговор» помогает уточнить риск, доступ и согласовать действия с домом.</p></li><li><strong>Выберите последствия</strong><p>Общее перекрытие воды остановит ущерб, но затронет соседей. Локализация на месте сохранит подачу, но требует свободной бригады. Норматив и погода видны на экране.</p></li><li><strong>Координируйте службы</strong><p>Во вкладке «Работы» отправьте подходящие экипажи. У сложной аварии несколько этапов: бригады ждут безопасного доступа и завершения связанных работ. Ожидающую бригаду можно отозвать.</p></li><li><strong>Управляйте временем</strong><p>Пауза и скорость 1×, 2×, 4× находятся сверху. Разговор открывается на паузе. После решения нажмите «Продолжить». В меню и при сворачивании игра сохраняется и останавливается.</p></li><li><strong>Развивайте компанию</strong><p>Оснащение ускоряет определённые работы, профилактика защищает сети. История домов хранит аварии и отключения. Для нового района нужны три смены, четыре договора, доверие от 68 и устранённая крупная авария.</p></li></ol>`;
}
