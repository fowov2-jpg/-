import {SCENARIOS, EQUIPMENT, WEATHER, shiftPlan} from './operations-content.js';
import {district, roadStop, streetRoute, pathLength, pathPose, parkingBay, hash} from './campaign-city.js';
import {VEHICLE_MODELS} from './content.js';
import {fuelFor, repairTime, expenses} from './campaign-balance.js';
import * as Career from './career-progression.js';
import * as Territory from './territory-progression.js';
export {Territory};
export {Career};

const SHIFT = 480;
const check = (value, message) => {if (!value) throw Error(message);};
const clamp = n => Math.max(0, Math.min(100, n));
const own = (s, id) => s.operations.houses.find(h => h.id === id && h.region === s.region);
const currentHouses = s => Territory.enabled(s)?Territory.homes(s):s.operations.houses.filter(h => h.region === s.region);
export const planFor = s => s.operations.career?(s.phase!=='prep'&&s.operations.shift?.schedule?s.operations.shift.schedule:Career.schedule(s)):shiftPlan(s.day,s.region,currentHouses(s).length);
export function parkingPosition(s,id){if(Territory.enabled(s))return Territory.parking(s,id);const p=parkingBay(s.seed,s.region,id);return [p[0]+1416,p[1]+874];}
const kitFor = (s, crew) => EQUIPMENT.find(k => k.id === s.operations.kits[crew.id]) ?? EQUIPMENT.find(k => k.service === crew.service);
const assignmentFor = (s, crewId) => s.calls.flatMap(c => c.assignments.map(a => ({call:c, assignment:a}))).find(v => v.assignment.crew === crewId);
export {currentHouses, kitFor, assignmentFor};

function newHouse(s, id, index = 0) {
  const home = district(s.seed, s.region).homes[id];
  return {id, region:s.region, trust:70, water:[69,54,77][index%3], electric:[78,64,73][index%3],
    structure:[74,67,58][index%3], rate:18000+home.floors*500, since:s.day,
    outages:{water:false, electric:false}, waterMinutes:0, electricMinutes:0,
    prevention:{water:0, electric:0, structure:0}, history:[]};
}

export function enable(s,gradual=true) {
  check(s.phase === 'prep' && s.calls.length === 0 && s.crews.every(c=>c.status==='idle'), 'Обновление компании доступно перед сменой без незавершённых выездов');
  s.version = 7;
  s.operations = {schema:1, houses:[], kits:{}, equipment:[], completed:0, failed:0, districtShifts:0,
    districtMajor:0, districtStartDay:s.day, planIndex:0, nextEvent:1, radio:[], history:[], decisions:[], weather:0, shift:null};
  s.done = []; s.cursor = 0; s.report = null;
  for (const [i,id] of (gradual?[144,151]:[144,151,156]).entries()) s.operations.houses.push(newHouse(s,id,i));
  for (const cr of s.crews) {s.operations.kits[cr.id] = EQUIPMENT.find(k => k.service === cr.service).id;cr.point=parkingPosition(s,cr.id);}
  s.operations.weather=(s.day-1)%WEATHER.length;
  if(gradual)Career.initialize(s);
  return s;
}

export function upgrade(s){
 if(s.version!==7)return s;
 validate(s);return validate(Career.initialize(s,true));
}
export function enableTerritories(s){
  check(s.version===8,'Для областей нужна карьерная компания');
  Territory.upgrade(s);
  if(s.day===1&&s.phase==='prep'&&s.operations.houses.length===2)s.operations.houses.push(newHouse(s,156,2));
  return validate(s);
}
export function upgradeTerritories(s){
  if(!s||s.version!==8)return s;
  validate(s);return validate(Territory.upgrade(s));
}
export const openDistrict=(s,id,log)=>Territory.openDistrict(s,id,log,newHouse);
export const switchDistrict=(s,id)=>Territory.switchDistrict(s,id);
export const switchArea=(s,id)=>Territory.switchArea(s,id);

export function radio(s, text, kind = 'radio', call = null, crew = null) {
  const o = s.operations;
  o.radio.push({id:o.nextEvent++, day:s.day, minute:s.minute, text, kind, call, crew});
  if (o.radio.length > 50) o.radio.shift();
}

export function definitions(call) {
  let list = SCENARIOS[call.kind].work.map(w => ({...w, requires:[...w.requires]}));
  if (call.flags.cover) {
    list.unshift({id:'cover', label:'Установить временное укрытие', service:2, duration:8, quantity:1, requires:[], type:14});
    list.find(w => w.id === 'roof').requires.push('cover');
  }
  if (call.flags.escalated) {
    list.push({id:'cleanup', label:'Убрать наносы после затопления', service:2, duration:20, quantity:2, requires:['drain'], type:16});
    list.find(w => w.id === 'pipe').requires.push('cleanup');
  }
  return list;
}
const isDone = (c, id) => c.work.some(w => w.id === id && w.status === 'done');
const unfinished = (c, service) => definitions(c).filter(d => d.service === service && !isDone(c,d.id));
export function waitingFor(c, service) {
  const pending = unfinished(c,service), definitionsById = new Map(definitions(c).map(d => [d.id,d]));
  return [...new Set(pending.flatMap(d => d.requires.filter(id => !isDone(c,id))))].map(id => definitionsById.get(id).label);
}
function syncWork(c) {
  for (const d of definitions(c)) if (!c.work.some(w => w.id === d.id)) c.work.push({id:d.id,status:'pending',remaining:0,total:0});
}

export function spec(s,c) {
  const d = SCENARIOS[c.kind], home = district(s.seed,s.region).homes[c.home];
  return {id:c.mission, home:c.home, homeName:home.name, title:d.title, brief:d.brief, answer:d.opening,
    service:d.service, priority:d.priority, reward:d.reward, quantity:definitions(c).reduce((a,w)=>a+w.quantity,0),
    duration:definitions(c).reduce((a,w)=>a+w.duration,0), type:d.work[0].type};
}
export function context(s,c){
 const d=SCENARIOS[c.kind];if(!Territory.enabled(s))return {caller:d.caller,location:'',condition:null,protected:false};
 const h=own(s,c.home),home=district(s.seed,s.region).homes[c.home],n=hash(s.seed+c.created,c.home+c.mission),entrance=1+n%4;
 const female=['lights','flood','roof','sewer','door','heating'].includes(c.kind),names=female?['Нина Павловна','Елена','Марина','Татьяна','Вера','Светлана']:['Олег','Александр','Павел','Григорий','Виктор','Аркадий'];
 const location=({lights:'Лестница · подъезд '+entrance,leak:'Стояк · подъезд '+entrance,flood:'Подвал · секция '+(1+n%3),roof:'Кровля над '+home.floors+' этажом',entrance:'Вход со двора',outage:'Вводной щит дома',sewer:'Выпуск канализации',door:'Входная дверь · подъезд '+entrance,pump:'Насосная дома',heating:'Стояк отопления · подъезд '+entrance,gutters:'Водосток над входом',delivery:'Ступени главного входа',cable:'Дворовая линия освещения'})[c.kind];
 return {caller:names[n%names.length]+' · '+d.caller.split(' · ')[1],location,condition:Math.round(h[d.system]),protected:h.prevention[d.system]>=s.day};
}

function chooseHome(s, plan) {
  const houses = currentHouses(s), active = new Set(s.calls.map(c=>c.home));
  const system=SCENARIOS[plan.kind].system;
  const ranked=s.day===1?houses:[...houses].sort((a,b)=>{
    const risk=h=>(100-h[system])+(h.prevention[system]>=s.day?-20:0)+hash(s.seed+s.day,h.id+plan.minute)%24;
    return risk(b)-risk(a);
  });
  const selected = s.day===1?houses[plan.home % houses.length]:ranked.find(h=>!active.has(h.id));
  if(!selected)return null;
  if (!active.has(selected.id)) return selected.id;
  return houses.find(h=>!active.has(h.id))?.id ?? null;
}

export function issue(s, kind = null, homeId = null) {
  check(s.phase === 'active', 'Сначала начните смену');
  const plan = planFor(s)[s.operations.planIndex];
  if (!kind && !plan || s.calls.length >= 8) return null;
  const type = kind ?? plan.kind;
  check(SCENARIOS[type], 'Неизвестный сценарий');
  if(!kind&&s.operations.career&&!Career.canAdmit(s,type))return null;
  const home = homeId ?? chooseHome(s,plan);
  if (home === null) return null;
  check(own(s,home), 'Нет договора с этим домом');
  const d = SCENARIOS[type];
  const c = {mission:s.cursor, home, kind:type, created:s.clock, due:s.minute+d.deadline,
    status:'new', late:false, asked:false, contained:false, dialogue:'start', answers:[], flags:{},
    damage:0, escalations:0, assignments:[], work:[], informed:false, deferred:false};
  if(s.operations.career){c.channel=kind?(['flood','pump','leak','outage'].includes(type)?'phone':'report'):plan.channel;c.manual=false;c.assistant=false;}
  syncWork(c);
  if(!kind&&s.operations.career&&![...new Set(definitions(c).map(w=>w.service))].every(service=>s.crews.some(cr=>cr.service===service&&!reason(s,c,cr))))return null;
  s.cursor++;s.calls.push(c);
  if(s.operations.career)s.operations.shift.peak=Math.max(s.operations.shift.peak,s.calls.filter(c=>!c.deferred).length);
  if (!kind) {s.operations.planIndex++;if(s.operations.career)Career.admitted(s);}
  radio(s,d.title+' · '+district(s.seed,s.region).homes[home].name,'incoming',c.mission);
  recomputeNetwork(s);
  return c;
}

export function weather(s) {return WEATHER[s.operations.weather];}
export function travelEstimate(s, crew, destination) {
  const v = s.vehicles.find(v=>v.id===crew.vehicle), model = VEHICLE_MODELS.find(m=>m.id===v.model);
  const path = streetRoute(crew.point,destination);
  // Congestion affects actual dispatch time, not just decorative cars. Rush hour
  // and the central junction add delay; weather applies to every route.
  const rush = s.minute < 90 || s.minute > 390;
  const junction=district(s.seed,s.region).origin[0]+1416+708;
  const crosses = path.some((p,i)=>i && Math.min(p[0],path[i-1][0]) < junction && Math.max(p[0],path[i-1][0]) >= junction);
  const traffic = rush && crosses ? 4 : rush ? 2 : 0;
  const base = Math.max(3,Math.ceil(pathLength(path)/(180*model.speed)*weather(s).travel));
  return {path, minutes:base+traffic, traffic, weather:weather(s).label};
}
function reserved(s, service) {return s.calls.reduce((sum,c)=>sum+c.assignments.filter(a=>a.service===service).reduce((n,a)=>n+a.reserved,0),0);}
export function availableStock(s, service) {return s.stock[service]-reserved(s,service);}

export function reason(s,c,cr) {
  if (s.phase !== 'active') return 'Сначала начните смену';
  if (!c || !cr) return 'Бригада или авария не найдена';
  if (c.deferred) return 'Плановый обход согласован на завтра';
  if (c.external) return 'Работы поручены сетевому подрядчику';
  if (cr.status !== 'idle') return 'Бригада занята';
  const pending = unfinished(c,cr.service);
  if (!pending.length) return 'Для этой службы работ нет';
  if (c.assignments.some(a=>a.service===cr.service)) return 'Служба уже на объекте';
  const v=s.vehicles.find(v=>v.id===cr.vehicle), model=VEHICLE_MODELS.find(m=>m.id===v?.model);
  if (!model) return 'Нет техники';
  if (model.supportedTypes && pending.some(w=>!model.supportedTypes.includes(w.type))) return 'Эта спецтехника не выполняет все работы службы';
  const quantity=pending.reduce((sum,w)=>sum+w.quantity,0);
  if (quantity>model.capacity) return 'Недостаточно грузового места';
  if (availableStock(s,cr.service)<quantity) return 'Нужны свободные комплекты со склада';
  const destination=roadStop(district(s.seed,s.region).homes[c.home]);
  const trip=travelEstimate(s,cr,destination);
  if (v.fuel<fuelFor(trip.path)+fuelFor(streetRoute(destination,parkingPosition(s,cr.id)))) return 'Недостаточно топлива на выезд и возвращение';
  if (v.condition<20) return 'Нужно обслуживание машины';
  if (cr.members.some(id=>s.employees.find(p=>p.id===id).fatigue>90)) return 'Бригаде нужен отдых';
  return '';
}

export function dispatch(s,id,crewId) {
  const c=s.calls.find(c=>c.mission===id),cr=s.crews.find(cr=>cr.id===crewId);
  check(!reason(s,c,cr),reason(s,c,cr));
  const destination=roadStop(district(s.seed,s.region).homes[c.home]), trip=travelEstimate(s,cr,destination);
  const a={crew:cr.id, service:cr.service, status:'travel', path:trip.path, total:trip.minutes,
    remaining:trip.minutes, task:null, reserved:unfinished(c,cr.service).reduce((sum,w)=>sum+w.quantity,0)};
  c.assignments.push(a); cr.status='travel';cr.job=c.mission;
  s.vehicles.find(v=>v.id===cr.vehicle).fuel-=fuelFor(a.path)+fuelFor(streetRoute(destination,parkingPosition(s,cr.id)));
  c.status='travel';
  radio(s,'Б'+(cr.id+1)+': приняли. Прибытие через '+trip.minutes+' мин'+(trip.traffic?' · затор +'+trip.traffic+' мин':''),'dispatch',id,crewId);
}

export function workTime(s,c,cr,d) {
  const kit=kitFor(s,cr);
  let multiplier=1;
  if (kit.id==='water-heavy') multiplier=d.id==='pipe'?.75:1.15;
  if (kit.id==='electric-switch') multiplier=d.id==='isolate'?.65:1.15;
  if (kit.id==='repair-pump') multiplier=d.id==='drain'?.6:1.15;
  if (kit.id==='repair-height') multiplier=['roof','cover'].includes(d.id)?.7:1.15;
  if (weather(s).id==='wind' && ['roof','cover'].includes(d.id)) multiplier*=1.2;
  const diagnosis=c.asked?0:4;
  return Math.max(1,Math.ceil(repairTime(s,{...d},cr)*multiplier)+diagnosis);
}

function beginReadyWork(s,c,a) {
  const cr=s.crews.find(cr=>cr.id===a.crew);
  const d=unfinished(c,a.service).find(d=>d.requires.every(id=>isDone(c,id)));
  if (!d) {a.status=cr.status='waiting';a.task=null;a.remaining=0;return;}
  // Escalation can add material demand after a crew left the depot. Reserve the
  // extra stock once it becomes available, without consuming another crew's load.
  if (a.reserved<d.quantity) {
    const extra=d.quantity-a.reserved;
    if (availableStock(s,a.service)<extra) {a.status=cr.status='waiting';a.task=null;a.remaining=0;return;}
    a.reserved+=extra;
  }
  const w=c.work.find(w=>w.id===d.id);
  if (w.status==='pending' && !w.total) {
    w.remaining=w.total=workTime(s,c,cr,d);
    s.stock[a.service]-=d.quantity;a.reserved-=d.quantity;
  }
  w.status='working';a.status=cr.status='repair';a.task=d.id;
  a.total=w.total;a.remaining=w.remaining;
  radio(s,'Б'+(cr.id+1)+': '+d.label.toLocaleLowerCase('ru')+'.','work',c.mission,cr.id);
}

function release(s,c,a) {
  const cr=s.crews.find(cr=>cr.id===a.crew),v=s.vehicles.find(v=>v.id===cr.vehicle);
  const trip=travelEstimate(s,cr,parkingPosition(s,cr.id));
  cr.status='returning';cr.job=null;
  cr.returnTrip={path:trip.path,total:trip.minutes,remaining:trip.minutes};
  v.condition=clamp(v.condition-2);
  for (const id of cr.members) s.employees.find(p=>p.id===id).fatigue=clamp(s.employees.find(p=>p.id===id).fatigue+10);
  c.assignments=c.assignments.filter(item=>item!==a);
}

export function withdraw(s,id,crewId) {
  check(s.phase==='active','Смена не активна');
  const c=s.calls.find(c=>c.mission===id),a=c?.assignments.find(a=>a.crew===crewId);
  check(a && a.status==='waiting','Отозвать можно бригаду, ожидающую другие службы');
  release(s,c,a);
  radio(s,'Б'+(crewId+1)+': освобождаемся с ожидания, возвращаемся на базу.','dispatch',id,crewId);
}

function recordHouse(s,h,text) {
  h.history.unshift({day:s.day,text});h.history.length=Math.min(12,h.history.length);
}
function networkHomes(s,c) {
  // A branch serves up to three contracted houses. This is persistent house
  // state; overlapping incidents are combined rather than resetting each other.
  const houses=currentHouses(s),start=Math.floor(Math.max(0,houses.findIndex(h=>h.id===c.home))/3)*3;
  return houses.slice(start,start+3);
}
function networkFlags(s) {
  const flags=new Map(currentHouses(s).map(h=>[h.id,{water:false,electric:false}]));
  for (const c of s.calls) {
    const h=flags.get(c.home);
    if (c.deferred) continue;
    if (c.flags.branchWater && !isDone(c,'pipe')) for (const n of networkHomes(s,c)) flags.get(n.id).water=true;
    if (c.flags.localWater && !isDone(c,'pipe')) h.water=true;
    if (c.kind==='pump' && !isDone(c,'pressure')) for (const n of networkHomes(s,c)) flags.get(n.id).water=true;
    if (c.kind==='outage' && !isDone(c,'power') || c.kind==='flood' && isDone(c,'isolate') && !isDone(c,'restore')) h.electric=true;
  }
  return flags;
}
export function recomputeNetwork(s) {
  const flags=networkFlags(s);
  for(const h of currentHouses(s))h.outages=flags.get(h.id);
}

export function answer(s,id,choiceId,log) {
  check(s.phase==='active','Диалог доступен во время смены');
  const c=s.calls.find(c=>c.mission===id),d=c&&SCENARIOS[c.kind];
  check(c && !c.deferred,'Обращение уже закрыто или перенесено');
  const node=d.dialogue[c.dialogue],choice=node?.options.find(o=>o.id===choiceId);
  check(choice,'Эта реплика уже недоступна');
  const effect=choice.effect,h=own(s,c.home);
  if (effect==='cover') check(c.assignments.length===0 && c.work.every(w=>w.status==='pending'),'Работы уже начались. Выберите постоянный ремонт');
  if (effect==='planned') check(c.assignments.length===0,'Бригада уже выехала');
  if (effect==='external') check(s.money>=18000 && c.assignments.length===0 && !c.external,'Подрядчик недоступен: проверьте деньги и назначения');
  c.asked=true;
  if (effect==='survey' || effect==='risk' || effect==='network' || effect==='access') c.flags[effect]=true;
  if (effect==='branch-water') {c.flags.branchWater=true;c.contained=true;}
  if (effect==='local-water') {c.flags.localWater=true;c.contained=true;}
  if (effect==='guard' || effect==='barrier') {c.flags.guarded=true;c.contained=true;}
  if (effect==='watch') c.flags.watch=true;
  if (effect==='cover') {c.flags.cover=true;syncWork(c);}
  if (effect==='restrict') {c.flags.restrict=true;c.contained=true;h.trust=clamp(h.trust-1);}
  if (['inform','residents','branch-water','local-water','planned'].includes(effect)) c.informed=true;
  if (effect==='planned') {c.deferred=true;c.deferDay=s.day+1;c.due=SHIFT+d.deadline;h.trust=clamp(h.trust-1);}
  if (effect==='external') {log(s,-18000,'Сетевой подрядчик: '+d.title);c.external={remaining:12+22,total:34};}
  c.answers.push({node:c.dialogue,choice:choice.id,day:s.day,minute:s.minute});
  c.dialogue=choice.next??'done';
  const note={day:s.day,minute:s.minute,call:c.mission,title:d.title,text:choice.text,result:choice.reply};
  s.operations.decisions.unshift(note);s.operations.decisions.length=Math.min(40,s.operations.decisions.length);
  radio(s,choice.reply,'decision',c.mission);
  recordHouse(s,h,choice.text);
  recomputeNetwork(s);
  return choice.reply;
}

function damageRate(s,c) {
  const d=SCENARIOS[c.kind],h=own(s,c.home);
  let rate=d.rate*(1+(70-h[d.system])/100);
  if (c.kind==='roof') rate*=weather(s).roof;
  if (h.prevention[d.system]>=s.day) rate*=.65;
  if (c.flags.branchWater || c.flags.localWater || isDone(c,'stop')) rate=0;
  if (c.flags.restrict || c.flags.guarded && ['entrance','gutters','delivery','cable'].includes(c.kind) || c.flags.watch && s.clock-c.created<45) rate*=.35;
  if (isDone(c,'cover')) rate*=.15;
  if (c.informed && ['light','power','pump','door'].includes(d.impact)) rate*=.7;
  return rate;
}

function finish(s,c,success,log) {
  const o=s.operations,d=SCENARIOS[c.kind],h=own(s,c.home),cost=Math.round(c.damage*380);
  if (success) {o.completed++;s.shift.completed++;if(c.late)s.shift.late++;log(s,d.reward,'Работы: '+d.title);}
  else o.failed++;
  if (cost) log(s,-cost,'Ущерб: '+d.title);
  h[d.system]=clamp(h[d.system]+(success?9:-12)-Math.round(c.damage/6));
  const trustDelta=success?(c.late?-2:2)+(c.informed?1:0)-Math.floor(c.damage/12):-9;
  h.trust=clamp(h.trust+trustDelta);
  if (c.kind==='flood' && success) o.districtMajor++;
  const outcome={id:c.mission,kind:c.kind,home:c.home,region:s.region,day:s.day,title:d.title,
    success,late:c.late,damage:cost,trust:trustDelta,external:!!c.external,decisions:c.answers.length};
  if(o.career){outcome.points=Career.award(s,c,success);outcome.assistant=!!c.assistant;}
  o.history.unshift(outcome);o.history.length=Math.min(80,o.history.length);
  if (o.shift) o.shift.results.push(outcome);
  recordHouse(s,h,(success?'Устранено: ':'Авария не устранена: ')+d.title+(cost?' · ущерб '+cost.toLocaleString('ru-RU')+' ₽':''));
  for (const a of [...c.assignments]) release(s,c,a);
  s.done.push(c.mission);
  s.calls=s.calls.filter(call=>call!==c);
  radio(s,d.title+': '+(success?'работы завершены, системы проверены.':'срок восстановления сорван, начислен ущерб.'),success?'complete':'critical',c.mission);
  recomputeNetwork(s);
}

export function start(s,log) {
  check(s.phase==='prep' && s.crews.length>0,'Подготовьте хотя бы одну бригаду');
  if(s.operations.career){
   check([0,1,2].every(service=>s.crews.some(cr=>cr.service===service)),'Для смены нужны сантехники, электрики и ремонтники. Подготовьте три службы.');
   check(Career.budget(s).minimumClosing>=0,'Поступлений не хватит на обязательные расходы. Сократите содержание перед сменой.');
  }
  s.phase='active';s.minute=0;s.report=null;
  s.shift={day:s.day,openingMoney:s.money,income:0,costs:0,completed:0,late:0};
  const o=s.operations;
  o.weather=(s.day-1)%WEATHER.length;o.planIndex=0;
  o.shift={results:[],waterMinutes:0,electricMinutes:0,openingTrust:reputation(s),houses:currentHouses(s).map(h=>({id:h.id,trust:h.trust,water:h.water,electric:h.electric,structure:h.structure}))};
  if(o.career)Career.beginShift(s);
  log(s,o.houses.reduce((sum,h)=>sum+h.rate,0),'Поступления по договорам домов');
  radio(s,'Диспетчерская «Уют». Смена '+s.day+'. '+weather(s).label+', '+weather(s).temperature+' °C. Бригады на связи.','briefing');
  if (!s.calls.length) issue(s);
}

export function tick(s,minutes,log) {
  check(Number.isInteger(minutes)&&minutes>=0&&minutes<=SHIFT,'Неверный шаг времени');
  for(let n=0;n<minutes&&s.phase==='active';n++) {
    s.minute++;s.clock++;
    for(const cr of s.crews) if(cr.status==='returning' && --cr.returnTrip.remaining<=0) {
      cr.point=[...cr.returnTrip.path.at(-1)];cr.angle=-Math.PI/2;cr.status='idle';delete cr.returnTrip;
      radio(s,'Б'+(cr.id+1)+': на базе, готовы к выезду.','ready',null,cr.id);
    }
    for(const c of [...s.calls]) {
      if(c.deferred)continue;
      if(!c.late&&s.minute>c.due) {c.late=true;radio(s,SCENARIOS[c.kind].title+': истёк норматив восстановления.','critical',c.mission);}
      c.damage+=damageRate(s,c);
      if(c.kind==='flood'&&!c.flags.escalated&&c.damage>=25) {
        c.flags.escalated=true;c.escalations++;syncWork(c);
        radio(s,'Подвал: вода вынесла наносы. После откачки потребуется дополнительная очистка.','critical',c.mission);
      }
      if(c.external && --c.external.remaining<=0) {
        for(const w of c.work){w.status='done';w.remaining=0;w.total=Math.max(1,w.total);}
      }
      for(const a of [...c.assignments]) {
        const cr=s.crews.find(cr=>cr.id===a.crew);
        if(a.status==='travel') {
          if(--a.remaining>0)continue;
          cr.point=[...a.path.at(-1)];cr.angle=pathPose(a.path,1).angle;
          if(!c.asked){c.asked=true;radio(s,'Б'+(cr.id+1)+': на месте. Обстоятельства подтвердили.','arrival',c.mission,cr.id);}
          else radio(s,'Б'+(cr.id+1)+': на объекте.','arrival',c.mission,cr.id);
          beginReadyWork(s,c,a);
        } else if(a.status==='waiting') beginReadyWork(s,c,a);
        else {
          const w=c.work.find(w=>w.id===a.task);
          a.remaining=--w.remaining;
          if(w.remaining>0)continue;
          w.status='done';
          radio(s,'Б'+(cr.id+1)+': '+definitions(c).find(d=>d.id===w.id).label.toLocaleLowerCase('ru')+' — выполнено.','stage',c.mission,cr.id);
          if(unfinished(c,a.service).length) beginReadyWork(s,c,a);
          else release(s,c,a);
        }
      }
      if(c.work.every(w=>w.status==='done')) finish(s,c,true,log);
      else if(s.minute>c.due+150 || c.damage>=100) finish(s,c,false,log);
      else c.status=c.assignments.some(a=>a.status==='repair')?'repair':c.assignments.some(a=>a.status==='travel')?'travel':c.assignments.length?'waiting':'new';
    }
    recomputeNetwork(s);
    for(const h of currentHouses(s)) {
      if(h.outages.water){h.waterMinutes++;s.operations.shift.waterMinutes++;h.trust=clamp(h.trust-.018);}
      if(h.outages.electric){h.electricMinutes++;s.operations.shift.electricMinutes++;h.trust=clamp(h.trust-.012);}
    }
    if(s.operations.career){
      Career.tickRegionalDesks(s);
      Career.runAssistant(s,{reason,answer,dispatch,radio,travelEstimate},log);
    }
    const next=planFor(s)[s.operations.planIndex];
    if(next&&s.minute>=next.minute)issue(s);
    if(s.minute>=SHIFT)endShift(s,log);
  }
}

export function reputation(s) {
  const houses=currentHouses(s);
  return Math.round(houses.reduce((sum,h)=>sum+h.trust,0)/houses.length);
}
export function canExpand(s) {
  if(s.operations.career)return Career.licenceProgress(s).ready;
  return s.operations.districtShifts>=3 && currentHouses(s).length>=4 && reputation(s)>=68 && s.operations.districtMajor>=1 && s.calls.length===0;
}
function endShift(s,log) {
  log(s,-expenses(s),'Содержание компании за смену');
  const o=s.operations;
  const local=new Set(currentHouses(s));
  const districtService=Math.round(o.houses.filter(h=>!local.has(h)).reduce((n,h)=>n+h.rate,0)*.92);
  if(districtService)log(s,-districtService,'Обслуживание домов в прежних районах');
  if(o.career){
    const b=Career.budget(s);
    if(b.routineCost)log(s,-b.routineCost,'Плановое обслуживание договоров района');
    if(b.dispatcher)log(s,-b.dispatcher,'Работа помощника диспетчера');
  }
  const compensation=o.shift.waterMinutes*12+o.shift.electricMinutes*18;
  if(compensation)log(s,-compensation,'Перерасчёт за перерывы снабжения');
  o.districtShifts++;
  const results=o.shift.results,failures=results.filter(r=>!r.success).length;
  const trust=reputation(s),damage=results.reduce((sum,r)=>sum+r.damage,0);
  s.report={day:s.day,results:[...results],pending:s.calls.length,damage,compensation,trust,trustDelta:trust-o.shift.openingTrust,
    waterMinutes:o.shift.waterMinutes,electricMinutes:o.shift.electricMinutes,
    grade:failures?'Сложная смена':trust>=70&&damage<18000?'Надёжная работа':'Есть над чем работать',
    decisions:o.decisions.filter(d=>d.day===s.day).slice(0,24)};
  if(o.career)s.report.career=Career.finishShift(s,log);
  s.phase=s.money<0||trust<25?'lost':!Territory.enabled(s)&&s.region===19&&canExpand(s)?'won':'report';
  radio(s,'Смена завершена. '+s.report.grade+'.','briefing');
}

export function nextDay(s) {
  check(s.phase==='report','Смена ещё не завершена');
  s.day++;s.minute=0;s.phase='prep';s.report=null;
  if(Territory.enabled(s))s.operations.territory.transition=false;
  for(const p of s.employees)p.fatigue=clamp(p.fatigue-60);
  for(const c of s.calls){c.due-=SHIFT;if(c.deferred&&c.deferDay<=s.day){c.deferred=false;c.dialogue='done';}}
  for(const h of currentHouses(s))for(const system of ['water','electric','structure'])h[system]=clamp(h[system]-(h.prevention[system]>=s.day?0:1));
  s.operations.weather=(s.day-1)%WEATHER.length;
}
export function nextDistrict(s,log) {
  check(['report','prep'].includes(s.phase)&&canExpand(s)&&s.region<19,Territory.enabled(s)?'Для новой области нужны три района, шесть смен в области, доверие от 65, карьерные баллы и закрытая очередь.':s.operations.career?'Для нового района нужны карьерные баллы, две смены, доверие от 60 и закрытая очередь.':'Для расширения нужны 3 смены, 4 договора, доверие 68 и устранённая крупная авария; закройте остаток заявок');
  if(s.operations.career)Career.openArea(s);
  if(s.phase==='report')s.day++;
  s.region++;s.minute=0;s.phase='prep';s.calls=[];if(!Territory.enabled(s)){s.done=[];s.cursor=0;}s.report=null;
  s.operations.districtShifts=0;s.operations.districtMajor=0;s.operations.districtStartDay=s.day;
  for(const [i,id] of (Territory.enabled(s)?[144,151,156]:s.operations.career?[144,151]:[144,151,156]).entries())s.operations.houses.push(newHouse(s,id,i));
  for(const cr of s.crews){cr.point=parkingPosition(s,cr.id);cr.angle=-Math.PI/2;cr.status='idle';cr.job=null;delete cr.returnTrip;}
  for(const p of s.employees)p.fatigue=0;
  log(s,150000,Territory.enabled(s)?'Развитие компании: новая область':'Развитие компании: новый район');
  s.operations.weather=(s.day-1)%WEATHER.length;
}

export function candidates(s) {
  const owned=new Set(currentHouses(s).map(h=>h.id));
  if(s.operations.career)return Career.addressPool(s).filter(id=>!owned.has(id)).map((id,i)=>({id,fee:65000+Math.min(4,i)*12000,home:district(s.seed,s.region).homes[id]}));
  return [147,152,159,162,164].filter(id=>!owned.has(id)).map((id,i)=>({id,fee:65000+i*12000,home:district(s.seed,s.region).homes[id]}));
}
export function sign(s,id,log) {
  check(s.phase==='prep','Договоры заключаются перед сменой');
  const offer=candidates(s).find(c=>c.id===id);
  check(offer&&s.money>=offer.fee,'Недостаточно средств или договор уже заключён');
  check(s.operations.districtShifts>=1&&reputation(s)>=65,'Для нового договора завершите смену и сохраните доверие не ниже 65');
  if(s.operations.career)check(currentHouses(s).length<Career.contractLimit(s),'Лимит договоров вырастет после следующих 20 баллов района');
  log(s,-offer.fee,'Приём дома: '+offer.home.name);
  s.operations.houses.push(newHouse(s,id,currentHouses(s).length));
}
export function prevent(s,id,system,log) {
  check(s.phase==='prep','Профилактика проводится перед сменой');
  const h=own(s,id);
  check(h&&['water','electric','structure'].includes(system),'Дом или система не найдены');
  check(h[system]<95&&h.prevention[system]<s.day,'Система уже обслужена');
  check(s.money>=12000,'Недостаточно средств');
  log(s,-12000,'Профилактика: '+district(s.seed,s.region).homes[id].name);
  h[system]=clamp(h[system]+20);h.prevention[system]=s.day+2;h.trust=clamp(h.trust+1);
  recordHouse(s,h,'Профилактика: '+({water:'водоснабжение',electric:'электросеть',structure:'кровля и входы'})[system]+'. Риск ущерба снижен на три смены.');
}
export function equip(s,crewId,kitId,log) {
  check(s.phase==='prep','Оснащение меняется перед сменой');
  const cr=s.crews.find(cr=>cr.id===crewId),kit=EQUIPMENT.find(k=>k.id===kitId);
  check(cr&&cr.status==='idle'&&kit&&kit.service===cr.service,'Оснащение не подходит или бригада на выезде');
  check(s.operations.kits[cr.id]!==kit.id,'Комплект уже установлен');
  if(equipmentPrice(s,kit)){
    check(s.money>=kit.price,'Недостаточно средств');log(s,-kit.price,'Оснащение: '+kit.name);s.operations.equipment.push(kit.id);
  }
  s.operations.kits[cr.id]=kit.id;
}
export function equipmentPrice(s,kit){
  const owned=s.operations.equipment.filter(id=>id===kit.id).length;
  const used=s.crews.filter(cr=>kitFor(s,cr).id===kit.id).length;
  return !kit.price||owned>used?0:kit.price;
}

// v7 is validated independently of the old one-job/one-crew invariant. The
// company management and storage transaction remain shared with v6.
export function validate(s) {
  const valid=v=>check(v,'Сохранение диспетчерской повреждено');
  const int=(n,a=0,b=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
  const pct=n=>Number.isFinite(n)&&n>=0&&n<=100;
  const str=(v,max=2000)=>typeof v==='string'&&v.length<=max;
  const point=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=60000);
  const path=p=>Array.isArray(p)&&p.length>=1&&p.length<=4&&p.every(point);
  valid(s&&[7,8,9].includes(s.version)&&int(s.seed,0,0xffffffff)&&int(s.clock)&&int(s.region,0,19)&&int(s.day,1)&&int(s.minute,0,SHIFT)&&Number.isSafeInteger(s.money));
  valid(['prep','active','report','lost','won'].includes(s.phase)&& (s.phase!=='active'||s.minute<SHIFT) && (!['report','lost','won'].includes(s.phase)||s.minute===SHIFT));
  valid(Array.isArray(s.vehicles)&&s.vehicles.length<=12&&Array.isArray(s.employees)&&s.employees.length<=24&&Array.isArray(s.crews)&&s.crews.length<=8);
  valid(int(s.nextVehicle)&&int(s.nextEmployee)&&int(s.nextCrew)&&int(s.nextCall));
  const people=new Map(),vehicles=new Map(),crews=new Map(),usedPeople=new Set(),usedVehicles=new Set();
  for(const p of s.employees){valid(p&&int(p.id,0,s.nextEmployee-1)&&!people.has(p.id)&&str(p.name,100)&&int(p.service,0,2)&&int(p.level,1,5)&&pct(p.fatigue));people.set(p.id,p);}
  for(const v of s.vehicles){valid(v&&int(v.id,0,s.nextVehicle-1)&&!vehicles.has(v.id)&&VEHICLE_MODELS.some(m=>m.id===v.model)&&pct(v.fuel)&&pct(v.condition));vehicles.set(v.id,v);}
  for(const cr of s.crews){
    valid(cr&&int(cr.id,0,s.nextCrew-1)&&!crews.has(cr.id)&&int(cr.service,0,2)&&Array.isArray(cr.members)&&cr.members.length===2&&cr.members[0]!==cr.members[1]&&vehicles.has(cr.vehicle)&&!usedVehicles.has(cr.vehicle)&&point(cr.point)&&Number.isFinite(cr.angle)&&['idle','travel','repair','waiting','returning'].includes(cr.status));
    for(const id of cr.members){valid(people.has(id)&&people.get(id).service===cr.service&&!usedPeople.has(id));usedPeople.add(id);}
    if(cr.status==='returning'){const t=cr.returnTrip;valid(cr.job===null&&t&&path(t.path)&&int(t.total,1,10000)&&int(t.remaining,1,t.total));valid(Math.hypot(...t.path.at(-1).map((n,i)=>n-parkingPosition(s,cr.id)[i]))<.01);}
    else valid(cr.returnTrip===undefined);
    usedVehicles.add(cr.vehicle);crews.set(cr.id,cr);
  }
  valid(Array.isArray(s.stock)&&s.stock.length===3&&s.stock.every(n=>int(n,0,200)));
  valid(Array.isArray(s.ledger)&&s.ledger.length<=60&&s.ledger.every(e=>e&&int(e.day,1,s.day)&&Number.isSafeInteger(e.amount)&&str(e.label,300)));
  const o=s.operations;
  const gradual=s.version>=8,territories=s.version===9;
  valid(o&&o.schema===(territories?3:gradual?2:1)&&Array.isArray(o.houses)&&o.houses.length>=(gradual?2:3)&&o.houses.length<=(territories?19980:gradual?1980:160)&&int(o.completed)&&int(o.failed)&&int(o.districtShifts)&&int(o.districtMajor)&&int(o.districtStartDay,1,s.day)&&int(o.planIndex,0,16)&&int(o.nextEvent,1)&&int(o.weather,0,WEATHER.length-1));
  if(territories)validateTerritories(s,valid,int);
  const homes=new Set();
  for(const h of o.houses){
    const key=h.region+':'+h.id;
    valid(h&&int(h.id,0,998)&&int(h.region,0,territories?Territory.unlocked(s):s.region)&&!homes.has(key)&&pct(h.trust)&&pct(h.water)&&pct(h.electric)&&pct(h.structure)&&int(h.rate,1,100000)&&int(h.since,1,s.day)&&h.outages&&typeof h.outages.water==='boolean'&&typeof h.outages.electric==='boolean'&&int(h.waterMinutes)&&int(h.electricMinutes));homes.add(key);
    valid(h.prevention&&['water','electric','structure'].every(k=>int(h.prevention[k],0,s.day+2))&&Array.isArray(h.history)&&h.history.length<=12&&h.history.every(e=>e&&int(e.day,1,s.day)&&str(e.text)));
  }
  valid(currentHouses(s).length>=(gradual?2:3)&&o.kits&&typeof o.kits==='object'&&Array.isArray(o.equipment)&&o.equipment.length<=64&&o.equipment.every(id=>EQUIPMENT.some(k=>k.id===id)));
  for(const [id,kitId] of Object.entries(o.kits)){const cr=crews.get(Number(id));valid(int(Number(id))&&EQUIPMENT.some(k=>k.id===kitId&&(!cr||k.service===cr.service)));}
  for(const kit of EQUIPMENT)if(kit.price)valid(s.crews.filter(cr=>kitFor(s,cr).id===kit.id).length<=o.equipment.filter(id=>id===kit.id).length);
  valid(Array.isArray(o.radio)&&o.radio.length<=50&&o.radio.every(e=>e&&int(e.id,1,o.nextEvent-1)&&int(e.day,1,s.day)&&int(e.minute,0,SHIFT)&&str(e.text)&&str(e.kind,40)&&(e.call===null||int(e.call))&&(e.crew===null||int(e.crew))));
  valid(new Set(o.radio.map(e=>e.id)).size===o.radio.length);
  const outcome=r=>r&&int(r.id)&&SCENARIOS[r.kind]&&int(r.home,0,998)&&int(r.region,0,territories?Territory.unlocked(s):s.region)&&int(r.day,1,s.day)&&str(r.title,200)&&typeof r.success==='boolean'&&typeof r.late==='boolean'&&int(r.damage)&&Number.isInteger(r.trust)&&typeof r.external==='boolean'&&int(r.decisions,0,2);
  const decision=d=>d&&int(d.day,1,s.day)&&int(d.minute,0,SHIFT)&&int(d.call)&&str(d.title,200)&&str(d.text)&&str(d.result);
  valid(Array.isArray(o.history)&&o.history.length<=80&&o.history.every(outcome)&&Array.isArray(o.decisions)&&o.decisions.length<=40&&o.decisions.every(decision));
  if(s.shift!==undefined){const r=s.shift;valid(r&&int(r.day,1,s.day)&&Number.isSafeInteger(r.openingMoney)&&int(r.income)&&int(r.costs)&&int(r.completed)&&int(r.late,0,r.completed));}
  if(o.shift!==null){const r=o.shift;valid(r&&Array.isArray(r.results)&&r.results.length<=24&&r.results.every(outcome)&&int(r.waterMinutes)&&int(r.electricMinutes)&&pct(r.openingTrust)&&Array.isArray(r.houses)&&r.houses.every(h=>h&&int(h.id,0,998)&&['trust','water','electric','structure'].every(k=>pct(h[k]))));}
  valid(Array.isArray(s.done)&&new Set(s.done).size===s.done.length&&s.done.every(n=>int(n))&&int(s.cursor)&&Array.isArray(s.calls)&&s.calls.length<=8);
  const seen=new Set(s.done),assigned=new Set();
  for(const c of s.calls){
    valid(c&&int(c.mission,0,s.cursor-1)&&!seen.has(c.mission)&&own(s,c.home)&&SCENARIOS[c.kind]&&int(c.created,0,s.clock)&&Number.isSafeInteger(c.due)&&['new','travel','waiting','repair'].includes(c.status)&&typeof c.late==='boolean'&&typeof c.asked==='boolean'&&typeof c.contained==='boolean'&&typeof c.informed==='boolean'&&typeof c.deferred==='boolean'&&Number.isFinite(c.damage)&&c.damage>=0&&c.damage<101&&int(c.escalations,0,1));seen.add(c.mission);
    valid(c.flags&&Object.keys(c.flags).every(k=>['survey','risk','network','access','branchWater','localWater','guarded','watch','cover','restrict','escalated'].includes(k)&&typeof c.flags[k]==='boolean'));
    valid((c.dialogue==='done'||SCENARIOS[c.kind].dialogue[c.dialogue])&&Array.isArray(c.answers)&&c.answers.length<=2&&c.answers.every(a=>a&&SCENARIOS[c.kind].dialogue[a.node]?.options.some(v=>v.id===a.choice)&&int(a.day,1,s.day)&&int(a.minute,0,SHIFT)));
    if(c.deferred)valid(c.kind==='door'&&int(c.deferDay,s.day,s.day+1));
    if(c.external)valid(c.kind==='outage'&&int(c.external.total,34,34)&&int(c.external.remaining,1,c.external.total));
    valid(Array.isArray(c.work)&&c.work.length===definitions(c).length&&new Set(c.work.map(w=>w.id)).size===c.work.length);
    for(const w of c.work){const d=definitions(c).find(d=>d.id===w.id);valid(d&&['pending','working','done'].includes(w.status)&&int(w.total,0,10000)&&int(w.remaining,0,w.total));if(w.status==='pending')valid(w.total===0&&w.remaining===0);if(w.status==='working')valid(w.remaining>0&&d.requires.every(id=>isDone(c,id)));if(w.status==='done')valid(w.total>0&&w.remaining===0&&d.requires.every(id=>isDone(c,id)));}
    valid(Array.isArray(c.assignments)&&c.assignments.length<=3&&new Set(c.assignments.map(a=>a.service)).size===c.assignments.length);
    for(const a of c.assignments){const cr=crews.get(a.crew);valid(cr&&!assigned.has(cr.id)&&cr.job===c.mission&&a.service===cr.service&&a.status===cr.status&&['travel','repair','waiting'].includes(a.status)&&int(a.reserved,0,50)&&path(a.path)&&int(a.total,1,10000)&&int(a.remaining,0,a.total));assigned.add(cr.id);
      if(a.status==='repair'){const w=c.work.find(w=>w.id===a.task);valid(w&&w.status==='working'&&definitions(c).find(d=>d.id===w.id).service===cr.service&&a.remaining===w.remaining&&a.total===w.total);}
      else valid(a.task===null&&(a.status!=='travel'||a.remaining>0));
    }
    for(const w of c.work)if(w.status==='working')valid(c.assignments.some(a=>a.task===w.id&&a.status==='repair'));
  }
  valid(seen.size===s.cursor&&[...seen].every(n=>int(n,0,s.cursor-1)));
  for(const cr of s.crews)valid(['idle','returning'].includes(cr.status)?cr.job===null:assigned.has(cr.id));
  for(let service=0;service<3;service++)valid(reserved(s,service)<=s.stock[service]);
  const network=networkFlags(s);for(const h of currentHouses(s))valid(h.outages.water===network.get(h.id).water&&h.outages.electric===network.get(h.id).electric);
  if(gradual)validateCareer(s,valid,int,pct);
  else valid(o.career===undefined);
  valid(s.phase!=='prep'||s.minute===0);
  valid(s.phase==='prep'||s.shift?.day===s.day&&o.shift!==null);
  if(['report','lost','won'].includes(s.phase)){const r=s.report;valid(r&&int(r.day,1,s.day)&&Array.isArray(r.results)&&r.results.every(outcome)&&int(r.pending,0,8)&&int(r.damage)&&int(r.compensation)&&pct(r.trust)&&Number.isInteger(r.trustDelta)&&int(r.waterMinutes)&&int(r.electricMinutes)&&str(r.grade,100)&&Array.isArray(r.decisions)&&r.decisions.every(decision));}
  return s;
}

function validateCareer(s,valid,int,pct){
 const o=s.operations,c=o.career;
 valid(c&&int(c.earned)&&int(c.spent,0,c.earned)&&Array.isArray(c.areas)&&(Territory.enabled(s)?c.areas.length>=s.region+1&&c.areas.length<=20:c.areas.length===s.region+1));
 if(!Territory.enabled(s))valid(c.spent===Array.from({length:s.region},(_,i)=>100+i*30).reduce((n,v)=>n+v,0));
 const helper=c.assistant;
 valid(helper&&typeof helper.enabled==='boolean'&&(!helper.enabled||Career.assistantUnlocked(s))&&int(helper.assigned)&&int(helper.completed,0,helper.assigned)&&Array.isArray(helper.reservedCrews)&&new Set(helper.reservedCrews).size===helper.reservedCrews.length&&helper.reservedCrews.every(id=>int(id,0,s.nextCrew-1)));
 let localPoints=0;
 for(const [region,area] of c.areas.entries()){
  valid(area&&area.region===region&&int(area.openedDay,1,s.day)&&int(area.points)&&int(area.handled));localPoints+=area.points;
  const homes=o.houses.filter(h=>h.region===region),ids=new Set(homes.map(h=>h.id));
  valid(homes.length>=2&&homes.length<=(Territory.enabled(s)?999:Career.DISTRICT_CAPACITY));
  if(area.shift!==null){
   const shift=area.shift;
   valid(region!==s.region&&shift&&int(shift.day,1,s.day)&&int(shift.completed,0,6)&&Array.isArray(shift.jobs)&&shift.jobs.length>=2&&shift.jobs.length<=6);
   valid(shift.jobs.every(j=>j&&ids.has(j.home)&&['lights','door','entrance','sewer','roof'].includes(j.kind)&&int(j.minute,0,370)&&int(j.duration,1,300)&&int(j.remaining,0,j.duration)&&['scheduled','working','done'].includes(j.status)&&(j.status==='working'?j.remaining>0:j.remaining===0)));
   valid(shift.completed===shift.jobs.filter(j=>j.status==='done').length);
  }
  if(area.lastReport!==null){const r=area.lastReport;valid(r&&int(r.day,1,s.day)&&int(r.total,2,6)&&int(r.completed,0,r.total)&&int(r.income)&&int(r.cost,0,r.income));}
 }
 valid(localPoints<=c.earned);
 for(const call of s.calls)valid(['phone','report'].includes(call.channel)&&typeof call.manual==='boolean'&&typeof call.assistant==='boolean'&&(!call.assistant||call.channel==='report'));
 for(const r of [...o.history,...(o.shift?.results??[])])valid((r.points===undefined||int(r.points,0,10))&&(r.assistant===undefined||typeof r.assistant==='boolean'));
 if(o.shift!==null){
  const shift=o.shift;
  valid(Array.isArray(shift.schedule)&&shift.schedule.length<=10&&int(shift.admitted,0,shift.schedule.length)&&o.planIndex===shift.admitted&&int(shift.nextAdmission,0,SHIFT+70)&&int(shift.peak,0,8)&&int(shift.points,0,c.earned)&&int(shift.carried,0,8)&&typeof shift.assistantUsed==='boolean');
  valid(shift.schedule.every((p,i)=>p&&int(p.minute,0,370)&&SCENARIOS[p.kind]&&int(p.home,0,Territory.enabled(s)?998:98)&&['phone','report'].includes(p.channel)&&(!i||p.minute>=shift.schedule[i-1].minute)));
 }
 if(s.report){const r=s.report.career;valid(r&&int(r.gained,0,c.earned)&&r.balance===Career.points(s)&&r.earned===c.earned&&r.price===Career.expansionPrice(s));}
}

function validateTerritories(s,valid,int){
 const o=s.operations,t=o.territory,c=o.career;
 valid(t&&t.schema===1&&int(t.current,0,16)&&int(t.legacySpent)&&typeof t.transition==='boolean'&&int(t.streak)&&Array.isArray(t.achievements)&&t.achievements.length<=Territory.OBJECTIVES.length);
 valid(new Set(t.achievements.map(a=>a.id)).size===t.achievements.length&&t.achievements.every(a=>a&&Territory.OBJECTIVES.some(g=>g.id===a.id)&&int(a.day,1,s.day)));
 valid(c&&Array.isArray(c.areas)&&c.areas.length>=s.region+1&&c.areas.length<=20);
 let spent=t.legacySpent;
 for(const a of c.areas){
  valid(a&&int(a.region,0,c.areas.length-1)&&int(a.price)&&Array.isArray(a.districts)&&a.districts.length>=1&&a.districts.length<=17&&new Set(a.districts.map(d=>d.id)).size===a.districts.length);
  if(a.selected!==undefined)valid(a.districts.some(d=>d.id===a.selected));
  spent+=a.price;let points=0;
  for(const d of a.districts){
   valid(d&&int(d.id,0,16)&&int(d.openedDay,1,s.day)&&int(d.price)&&int(d.points)&&int(d.shifts)&&int(d.handled));
   spent+=d.price;points+=d.points;
   const ids=new Set(Territory.districts(s.seed,a.region)[d.id].ids),homes=o.houses.filter(h=>h.region===a.region&&ids.has(h.id));
   valid(homes.length>=1&&homes.length<=ids.size);
   if(d.shift!==null){const r=d.shift;
    valid(r&&!(a.region===s.region&&d.id===t.current)&&int(r.day,1,s.day)&&Array.isArray(r.jobs)&&r.jobs.length>=1&&r.jobs.length<=6&&int(r.completed,0,r.jobs.length));
    valid(r.jobs.every(j=>j&&homes.some(h=>h.id===j.home)&&['lights','door','entrance','sewer','roof'].includes(j.kind)&&int(j.minute,0,370)&&int(j.duration,1,300)&&int(j.remaining,0,j.duration)&&['scheduled','working','done'].includes(j.status)&&(j.status==='working'?j.remaining>0:j.remaining===0)));
    valid(r.completed===r.jobs.filter(j=>j.status==='done').length);
   }
   if(d.lastReport!==null){const r=d.lastReport;valid(r&&int(r.day,1,s.day)&&int(r.total,1,6)&&int(r.completed,0,r.total)&&int(r.income)&&int(r.cost,0,r.income));}
  }
  valid(points<=a.points);
  valid(o.houses.filter(h=>h.region===a.region).every(h=>a.districts.some(d=>Territory.districts(s.seed,a.region)[d.id].ids.includes(h.id))));
 }
 valid(spent===c.spent&&c.areas[s.region].districts.some(d=>d.id===t.current));
 valid(Territory.record(s).shifts===o.districtShifts);
}
