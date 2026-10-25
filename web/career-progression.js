import {SCENARIOS} from './operations-content.js';
import {district,roadStop} from './campaign-city.js';
import {expenses,PART_PRICES} from './campaign-balance.js';

export const DISTRICT_CAPACITY=99;
export const ASSISTANT_POINTS=60;
export const expansionPrice=s=>100+s.region*30;
export const currentArea=s=>s.operations.career?.areas.find(a=>a.region===s.region);
export const points=s=>s.operations.career?s.operations.career.earned-s.operations.career.spent:0;
export const assistantUnlocked=s=>!!s.operations.career&&s.operations.career.earned>=ASSISTANT_POINTS;
export const contractLimit=s=>Math.min(DISTRICT_CAPACITY,Math.max(s.operations.houses.filter(h=>h.region===s.region).length,2+2*Math.floor((currentArea(s)?.points??0)/20)));
const localHouses=s=>s.operations.houses.filter(h=>h.region===s.region);
const reserve=s=>Math.max(25000,expenses(s));
const routine=['lights','door','entrance','sewer','roof'];

export function initialize(s,legacy=false){
 const o=s.operations;
 const spent=Array.from({length:s.region},(_,i)=>100+i*30).reduce((a,b)=>a+b,0);
 const earned=legacy?Math.max(spent,o.completed*8+o.districtShifts*8):0;
 o.career={earned,spent,assistant:{enabled:false,reservedCrews:[],assigned:0,completed:0},
  areas:Array.from({length:s.region+1},(_,region)=>({region,openedDay:region===s.region?o.districtStartDay:1,
   points:legacy?(region===s.region?Math.max(0,earned-spent):100):0,handled:0,shift:null,lastReport:null}))};
 s.version=8;o.schema=2;
 if(o.shift){
  o.shift.schedule=[];o.shift.admitted=0;o.shift.nextAdmission=s.minute+35;
  o.shift.peak=s.calls.length;o.shift.points=0;o.shift.carried=s.calls.length;o.shift.assistantUsed=false;
  o.planIndex=0;
 }
 for(const c of s.calls){c.channel='phone';c.manual=true;c.assistant=false;}
 if(s.report)s.report.career={gained:0,balance:earned-spent,earned,price:expansionPrice(s)};
 return s;
}

// A licence reveals 99 real addresses near the established service area. Existing
// contracts are retained on upgrade, including addresses outside the new pool.
export function addressPool(s,region=s.region){
 const city=district(s.seed,region),anchor=city.homes[151];
 const existing=s.operations.houses.filter(h=>h.region===region).map(h=>h.id);
 const sorted=[...city.homes].sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)||a.id-b.id).map(h=>h.id);
 return [...new Set([...existing,144,151,156,147,152,159,162,164,...sorted])].slice(0,DISTRICT_CAPACITY);
}

export function shiftRules(s){
 const count=localHouses(s).length,first=s.day===1&&s.region===0;
 const tutorial=s.region===0&&s.operations.districtShifts<2;
 const quota=first?3:Math.min(10,(tutorial?5:6)+Math.floor(Math.max(0,count-4)/16)+Math.min(2,s.region));
 const concurrent=first?1:Math.min(3,2+Math.floor(Math.max(0,s.crews.length-3)/3));
 return {quota,concurrent,gap:first?70:35,cutoff:370,reserve:reserve(s)};
}

const rows=entries=>entries.map(([minute,kind,home],i)=>({minute,kind,home,
 channel:i===0||['leak','flood','pump','outage'].includes(kind)?'phone':'report'}));
export function schedule(s){
 if(s.day===1&&s.region===0)return rows([[0,'lights',0],[120,'leak',1],[270,'door',0]]);
 const variants=[
  ['door','sewer','outage','entrance','leak','lights','roof','door','lights','leak'],
  ['lights','leak','flood','door','roof','sewer','outage','entrance','lights','door'],
  ['leak','entrance','pump','lights','door','roof','sewer','outage','entrance','lights']
 ];
 const early=s.region===0&&s.operations.districtShifts<2;
 const kinds=variants[early?0:(s.day-2+s.region)%variants.length],rules=shiftRules(s);
 return rows(kinds.slice(0,rules.quota).map((kind,i)=>[Math.round(i*335/Math.max(1,rules.quota-1)),kind,i%localHouses(s).length]));
}

export function budget(s){
 const rules=shiftRules(s),plan=s.phase!=='prep'&&s.operations.shift?.schedule?s.operations.shift.schedule:schedule(s);
 const contracts=s.operations.houses.reduce((n,h)=>n+h.rate,0);
 const regionalService=Math.round(s.operations.houses.filter(h=>h.region!==s.region).reduce((n,h)=>n+h.rate,0)*.92);
 const routineCost=Math.round(localHouses(s).slice(2).reduce((n,h)=>n+h.rate,0)*.65);
 const staffing=expenses(s),wages=staffing+regionalService+routineCost;
 const rewards=plan.reduce((n,p)=>n+SCENARIOS[p.kind].reward,0);
 const supplies=plan.reduce((n,p)=>n+SCENARIOS[p.kind].work.reduce((k,w)=>k+w.quantity*PART_PRICES[w.service],0),0);
 const upkeep=plan.reduce((n,p)=>n+new Set(SCENARIOS[p.kind].work.map(w=>w.service)).size*2200,0);
 const dispatcher=assistantUnlocked(s)&&(s.operations.career.assistant.enabled||s.phase!=='prep'&&s.operations.shift?.assistantUsed)?2500:0;
 return {...rules,quota:plan.length,contracts,staffing,regionalService,routineCost,dispatcher,
  estimatedCosts:wages+supplies+upkeep+dispatcher,estimatedRewards:rewards,
  estimatedNet:contracts+rewards-wages-supplies-upkeep-dispatcher,
  minimumClosing:s.money+contracts-wages-dispatcher};
}

export function beginShift(s){
 const o=s.operations,rules=shiftRules(s);
 o.shift.schedule=schedule(s);o.shift.admitted=0;o.shift.nextAdmission=0;
 o.shift.peak=s.calls.length;o.shift.points=0;o.shift.carried=s.calls.length;o.shift.assistantUsed=o.career.assistant.enabled;
 for(const area of o.career.areas){
  if(area.region===s.region)continue;
  const homes=o.houses.filter(h=>h.region===area.region),quota=Math.min(6,2+Math.floor(homes.length/18));
  area.shift={day:s.day,completed:0,jobs:Array.from({length:quota},(_,i)=>{
   const kind=routine[(s.day+area.region+i)%routine.length];
   return {home:homes[i%homes.length].id,kind,minute:30+i*60,duration:30+SCENARIOS[kind].work.reduce((n,w)=>n+w.duration,0),remaining:0,status:'scheduled'};
  })};
 }
 return rules;
}

export function canAdmit(s,kind){
 const rules=shiftRules(s),live=s.calls.filter(c=>!c.deferred);
 if(s.minute>rules.cutoff||s.minute<s.operations.shift.nextAdmission||live.length>=rules.concurrent)return false;
 if(s.operations.shift.admitted>=s.operations.shift.schedule.length)return false;
 // Leave room for a linked emergency and do not queue another task behind an
// already occupied specialist. The planned call receives its clock on admission.
 const required=[...new Set(SCENARIOS[kind].work.map(w=>w.service))];
 if(required.length>1&&live.length)return false;
 return required.every(service=>!live.some(c=>SCENARIOS[c.kind].work.some(w=>w.service===service)&&!c.work.filter(w=>SCENARIOS[c.kind].work.find(d=>d.id===w.id)?.service===service).every(w=>w.status==='done'))
  &&s.crews.some(cr=>cr.service===service&&cr.status==='idle'));
}

export function admitted(s){
 const shift=s.operations.shift;shift.admitted++;
 shift.nextAdmission=s.minute+shiftRules(s).gap;
 shift.peak=Math.max(shift.peak,s.calls.filter(c=>!c.deferred).length);
}

export function award(s,c,success){
 const career=s.operations.career,area=currentArea(s);
 const gained=success?(c.late?3:4+SCENARIOS[c.kind].priority*2):0;
 career.earned+=gained;area.points+=gained;s.operations.shift.points+=gained;
 if(c.assistant&&success)career.assistant.completed++;
 return gained;
}

export function finishShift(s){
 const o=s.operations,failed=o.shift.results.some(r=>!r.success),pending=s.calls.some(c=>!c.deferred);
 const bonus=!failed&&!pending&&o.shift.results.length?8:0;
 o.career.earned+=bonus;currentArea(s).points+=bonus;o.shift.points+=bonus;
 for(const area of o.career.areas){
  if(area.region===s.region||!area.shift)continue;
  const homes=o.houses.filter(h=>h.region===area.region);
  area.lastReport={day:s.day,completed:area.shift.completed,total:area.shift.jobs.length,
   income:homes.reduce((n,h)=>n+h.rate,0),cost:Math.round(homes.reduce((n,h)=>n+h.rate,0)*.92)};
 }
 return {gained:o.shift.points,balance:points(s),earned:o.career.earned,price:expansionPrice(s)};
}

export function tickRegionalDesks(s){
 for(const area of s.operations.career.areas){
  if(area.region===s.region||!area.shift)continue;
  for(const job of area.shift.jobs){
   if(job.status==='scheduled'&&s.minute>=job.minute){job.status='working';job.remaining=job.duration;}
   if(job.status!=='working'||--job.remaining>0)continue;
   job.status='done';area.shift.completed++;area.handled++;
   const h=s.operations.houses.find(h=>h.region===area.region&&h.id===job.home),system=SCENARIOS[job.kind].system;
   h[system]=Math.min(100,h[system]+2);h.trust=Math.min(100,h.trust+.5);
   h.history.unshift({day:s.day,text:'Районный диспетчер: '+SCENARIOS[job.kind].title+' — устранено.'});h.history.length=Math.min(12,h.history.length);
  }
 }
}

const replies={lights:['scope','priority'],door:['access','today'],entrance:['bypass','barrier'],sewer:['scope','notice'],roof:['history','cover']};
export function runAssistant(s,actions,log){
 const helper=s.operations.career.assistant;
 if(!assistantUnlocked(s)||!helper.enabled)return;
 const candidates=s.calls.filter(c=>c.channel==='report'&&!c.manual&&!c.deferred&&!c.external&&SCENARIOS[c.kind].priority<=2&&new Set(SCENARIOS[c.kind].work.map(w=>w.service)).size===1)
  .sort((a,b)=>a.due-b.due||a.mission-b.mission);
 for(const c of candidates){
  if(s.clock-c.created<6||c.assignments.length)continue;
  const destination=roadStop(district(s.seed,s.region).homes[c.home]);
  const available=s.crews.filter(cr=>!helper.reservedCrews.includes(cr.id)&&!actions.reason(s,c,cr))
   .sort((a,b)=>actions.travelEstimate(s,a,destination).minutes-actions.travelEstimate(s,b,destination).minutes||a.id-b.id);
  if(!available.length)continue;
  // Standard report handling never purchases, calls a paid contractor, or makes
  // the player's decisions on a phone call / linked emergency.
  if(c.dialogue!=='done'){
   for(const choice of replies[c.kind]??[]){
    if(SCENARIOS[c.kind].dialogue[c.dialogue]?.options.some(v=>v.id===choice))actions.answer(s,c.mission,choice,log);
   }
  }
  if(c.dialogue!=='done')continue;
  actions.dispatch(s,c.mission,available[0].id);c.assistant=true;helper.assigned++;
  actions.radio(s,'Помощник: Б'+(available[0].id+1)+' направлена по сообщению дома.','assistant',c.mission,available[0].id);
 }
}

export function setAssistant(s,enabled){
 if(!assistantUnlocked(s))throw Error('Помощник откроется после 60 карьерных баллов');
 if(typeof enabled!=='boolean')throw Error('Неизвестный режим помощника');
 s.operations.career.assistant.enabled=enabled;
 if(enabled&&s.phase==='active')s.operations.shift.assistantUsed=true;
}

export function reserveCrew(s,id){
 if(!assistantUnlocked(s)||!s.crews.some(cr=>cr.id===id))throw Error('Настройка помощника пока недоступна');
 const helper=s.operations.career.assistant;
 helper.reservedCrews=helper.reservedCrews.includes(id)?helper.reservedCrews.filter(n=>n!==id):[...helper.reservedCrews,id];
}

export function openArea(s){
 const price=expansionPrice(s);s.operations.career.spent+=price;
 s.operations.career.areas.push({region:s.region+1,openedDay:s.day+(s.phase==='report'?1:0),points:0,handled:0,shift:null,lastReport:null});
}

export function licenceProgress(s){
 const trust=Math.round(localHouses(s).reduce((n,h)=>n+h.trust,0)/localHouses(s).length);
 return {points:points(s),price:expansionPrice(s),trust,shifts:s.operations.districtShifts,
  ready:points(s)>=expansionPrice(s)&&trust>=60&&s.operations.districtShifts>=2&&s.calls.length===0};
}

export function forecastWarning(s){
 const b=budget(s);
 return b.minimumClosing<b.reserve?'После обязательных расходов останется меньше резерва '+b.reserve.toLocaleString('ru-RU')+' ₽. Сократите расходы перед сменой.':'';
}
