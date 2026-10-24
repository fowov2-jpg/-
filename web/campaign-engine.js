import {VEHICLE_MODELS,PEOPLE} from './content.js';
import {ADDRESS_COUNT,DISTRICT_COUNT,DW,DH,missions,missionOrder,depot,district,roadStop,streetRoute,pathLength,hash} from './campaign-city.js';
export {VEHICLE_MODELS};
export const SAVE='upravdom.campaign.v4',BACKUP=SAVE+'.backup',SHIFT=480;
const requireThat=(v,m)=>{if(!v)throw Error(m);},clamp=n=>Math.max(0,Math.min(100,n));
const catalogs=new Map();
export function catalog(s){const key=s.seed+':'+s.region;if(!catalogs.has(key))catalogs.set(key,missions(s.seed,s.region));return catalogs.get(key);}
export function fresh(seed=112){const s={version:4,seed:seed>>>0,region:0,day:1,minute:0,phase:'prep',money:3000000,done:[],cursor:0,calls:[],nextCall:0,
 employees:PEOPLE.slice(0,6).map((p,id)=>({id,name:p[0],service:p[1],level:p[2],fatigue:0})),
 vehicles:[{id:0,model:'uaz39094-utility',fuel:100,condition:100},{id:1,model:'gazelle-next-van',fuel:100,condition:100},{id:2,model:'gazelle-business-flatbed',fuel:100,condition:100}],
 crews:[0,1,2].map(id=>({id,service:id,members:[id*2,id*2+1],vehicle:id,point:depot(seed,0),status:'idle',job:null})),
 stock:[40,40,40],nextVehicle:3,nextEmployee:6,nextCrew:3,ledger:[],report:null};catalog(s);return s;}
export function task(s,call){return catalog(s)[call.mission];}
export function log(s,amount,label){s.money+=amount;s.ledger.unshift({day:s.day,amount,label});s.ledger.length=Math.min(s.ledger.length,60);}
function pay(s,amount,label){requireThat(s.money>=amount,'Недостаточно средств');log(s,-amount,label);}
function prep(s){requireThat(s.phase==='prep','Изменение состава доступно перед сменой');}
export function issue(s){
 requireThat(s.phase==='active','Сначала начните смену');
 if(s.calls.length>=Math.max(4,s.crews.length*2))return null;
 if(s.cursor>=ADDRESS_COUNT)return null;
 const mission=missionOrder(s.seed,s.region)[s.cursor++],m=catalog(s)[mission];
 const call={mission,status:'new',crew:null,due:s.minute+m.deadline,late:false,asked:false,contained:false,remaining:0,total:0};s.calls.push(call);return call;
}
export function start(s){prep(s);requireThat(s.crews.length>0,'Сформируйте хотя бы одну бригаду');s.phase='active';s.minute=0;s.report=null;s.nextCall=20;
 for(let i=s.calls.length;i<Math.min(3,ADDRESS_COUNT-s.done.length);i++)issue(s);
}
export function reason(s,call,crew){
 if(s.phase!=='active')return 'Сначала начните смену';if(!call||!crew)return 'Бригада или заявка не найдена';if(call.status!=='new')return 'Заявка уже назначена';if(crew.status!=='idle')return 'Бригада занята';
 const m=task(s,call),v=s.vehicles.find(v=>v.id===crew.vehicle),model=VEHICLE_MODELS.find(x=>x.id===v?.model);
 if(crew.service!==m.service)return 'Другая специальность';if(model.supportedTypes&&!model.supportedTypes.includes(m.type))return 'Техника не подходит для этой работы';
 if(model.capacity<m.quantity)return 'Недостаточно грузового места';if(s.stock[m.service]<m.quantity)return 'Нужны комплекты со склада';
 if(v.fuel<8)return 'Нужна заправка';if(v.condition<20)return 'Нужно обслуживание';if(crew.members.some(id=>s.employees.find(p=>p.id===id).fatigue>90))return 'Бригаде нужен отдых';return '';
}
export function dispatch(s,id,crewId){const c=s.calls.find(c=>c.mission===id),cr=s.crews.find(c=>c.id===crewId);requireThat(!reason(s,c,cr),reason(s,c,cr));const m=task(s,c),v=s.vehicles.find(v=>v.id===cr.vehicle),model=VEHICLE_MODELS.find(x=>x.id===v.model);
 s.stock[m.service]-=m.quantity;v.fuel-=8;c.crew=cr.id;c.status=cr.status='travel';cr.job=c.mission;
 c.path=streetRoute(cr.point,roadStop(district(s.seed,s.region).homes[m.home]));c.remaining=c.total=Math.max(3,Math.ceil(pathLength(c.path)/(300*model.speed)));
}
export function question(s,id){const c=s.calls.find(c=>c.mission===id);requireThat(c,'Заявка не найдена');c.asked=true;return task(s,c).answer;}
export function contain(s,id){const c=s.calls.find(c=>c.mission===id);requireThat(c&&c.status==='new'&&!c.contained,'Инструкция уже передана');c.contained=true;c.asked=true;c.due+=20;}
function complete(s,c){
 requireThat(!s.done.includes(c.mission),'Задание уже выполнено');const m=task(s,c),cr=s.crews.find(cr=>cr.id===c.crew);
 s.done.push(c.mission);log(s,Math.round(m.reward*(c.late?.8:1)),'Выполнено: '+m.title);
 if(cr){cr.status='idle';cr.job=null;cr.point=roadStop(district(s.seed,s.region).homes[m.home]);const v=s.vehicles.find(v=>v.id===cr.vehicle);v.condition=clamp(v.condition-3);for(const id of cr.members)s.employees.find(p=>p.id===id).fatigue=clamp(s.employees.find(p=>p.id===id).fatigue+10);}
 s.calls=s.calls.filter(x=>x!==c);
 if(s.done.length===ADDRESS_COUNT){s.phase=s.region===DISTRICT_COUNT-1?'won':'cleared';s.report={region:s.region,done:s.done.length};}
}
export function tick(s,minutes=1){
 requireThat(Number.isInteger(minutes)&&minutes>=0&&minutes<=SHIFT,'Неверный шаг времени');if(s.phase!=='active')return;
 for(let n=0;n<minutes&&s.phase==='active';n++){
  s.minute++;
  for(const c of [...s.calls]){
   if(!c.late&&s.minute>c.due)c.late=true;
   if(c.status==='new')continue;
   if(--c.remaining>0)continue;const cr=s.crews.find(cr=>cr.id===c.crew),m=task(s,c);
   if(c.status==='travel'){cr.point=c.path.at(-1);c.status=cr.status='diagnosis';c.remaining=c.total=c.asked?3:7;}
   else if(c.status==='diagnosis'){c.status=cr.status='repair';c.remaining=c.total=Math.ceil(m.duration*(c.contained?.9:1));}
   else complete(s,c);
  }
  if(s.phase!=='active')break;
  if(s.minute>=s.nextCall&&s.cursor<ADDRESS_COUNT&&s.calls.length<Math.max(4,s.crews.length*2))issue(s);
  if(s.minute>=s.nextCall)s.nextCall=s.minute+20+hash(s.seed+s.day,s.minute)%10;
  if(s.minute>=SHIFT){s.phase='report';s.report={done:s.done.length,pending:s.calls.length};log(s,-(4500+s.employees.length*1200+s.vehicles.reduce((sum,v)=>sum+VEHICLE_MODELS.find(m=>m.id===v.model).upkeep,0)),'Содержание компании за смену');}
 }
}
export function nextDay(s){requireThat(s.phase==='report','Смена ещё не завершена');s.day++;s.minute=0;s.phase='prep';s.report=null;for(const p of s.employees)p.fatigue=clamp(p.fatigue-60);for(const c of s.calls)c.due-=SHIFT;}
export function nextDistrict(s){requireThat(s.phase==='cleared'&&s.done.length===ADDRESS_COUNT&&s.calls.length===0,'Сначала выполните все 999 заданий');requireThat(s.region<19,'Все районы пройдены');s.region++;s.done=[];s.cursor=0;s.calls=[];s.minute=0;s.day++;s.phase='prep';s.report=null;for(const cr of s.crews){cr.point=depot(s.seed,s.region);cr.status='idle';cr.job=null;}for(const p of s.employees)p.fatigue=0;log(s,250000,'Открыт район: '+district(s.seed,s.region).name);catalog(s);}
export function buy(s,modelId){prep(s);const model=VEHICLE_MODELS.find(m=>m.id===modelId);requireThat(model&&s.vehicles.length<12,'В гараже максимум 12 машин');pay(s,model.price,'Покупка: '+model.name);s.vehicles.push({id:s.nextVehicle++,model:modelId,fuel:100,condition:100});}
export function maintain(s,id){requireThat(s.phase==='prep'||s.phase==='active','Сначала перейдите к подготовке');const v=s.vehicles.find(v=>v.id===id);requireThat(v,'Машина не найдена');requireThat(!s.crews.some(c=>c.vehicle===id&&c.status!=='idle'),'Машина на выезде');requireThat(v.fuel<100||v.condition<100,'Машина уже обслужена');pay(s,5000,'Топливо и обслуживание');v.fuel=v.condition=100;}
export function procure(s,service){requireThat(s.phase==='prep'||s.phase==='active','Закупка недоступна');requireThat(Number.isInteger(service)&&service>=0&&service<3,'Неизвестный комплект');requireThat(s.stock[service]<=180,'Запас максимум 200 комплектов каждого профиля');pay(s,30000,'Поставка 20 комплектов');s.stock[service]+=20;}
export function hire(s,service){prep(s);requireThat(Number.isInteger(service)&&service>=0&&service<3&&s.employees.length<24,'Найм недоступен');pay(s,22000,'Найм специалиста');const p=PEOPLE.filter(p=>p[1]===service)[s.nextEmployee%6];s.employees.push({id:s.nextEmployee++,name:p[0],service,level:1,fatigue:0});}
export function disband(s,id){prep(s);const cr=s.crews.find(c=>c.id===id);requireThat(cr&&cr.status==='idle','Бригада на выезде');s.crews=s.crews.filter(c=>c!==cr);}
export function form(s,members,vehicle){prep(s);requireThat(s.crews.length<8&&members.length===2&&members[0]!==members[1],'Нужны два разных сотрудника; максимум 8 бригад');const ps=members.map(id=>s.employees.find(p=>p.id===id));requireThat(ps.every(Boolean)&&ps[0].service===ps[1].service&&!s.crews.some(c=>c.members.some(id=>members.includes(id))),'Нужны свободные сотрудники одного профиля');requireThat(s.vehicles.some(v=>v.id===vehicle)&&!s.crews.some(c=>c.vehicle===vehicle),'Машина уже назначена');s.crews.push({id:s.nextCrew++,service:ps[0].service,members:[...members],vehicle,point:depot(s.seed,s.region),status:'idle',job:null});}
export function sell(s,id){prep(s);const v=s.vehicles.find(v=>v.id===id);requireThat(v&&!s.crews.some(c=>c.vehicle===id),'Сначала освободите машину');log(s,Math.floor(VEHICLE_MODELS.find(m=>m.id===v.model).price*.6*v.condition/100),'Продажа машины');s.vehicles=s.vehicles.filter(item=>item!==v);}
export function encode(s){return JSON.stringify(s);}
export function decode(raw){
 const s=JSON.parse(raw),valid=v=>requireThat(v,'Сохранение кампании повреждено'),int=(n,a=0,b=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=a&&n<=b,pct=n=>Number.isFinite(n)&&n>=0&&n<=100;
 const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=DW*5&&p[1]>=0&&p[1]<=DH*4;
 valid(s&&s.version===4&&int(s.seed,0,0xffffffff)&&int(s.region,0,19)&&int(s.day,1)&&int(s.minute,0,SHIFT)&&Number.isSafeInteger(s.money)&&['prep','active','report','cleared','won'].includes(s.phase));
 valid(Array.isArray(s.done)&&s.done.length<=999&&new Set(s.done).size===s.done.length&&s.done.every(n=>int(n,0,998))&&int(s.cursor,0,999));
 valid(Array.isArray(s.calls)&&s.calls.length<=16&&Array.isArray(s.employees)&&s.employees.length<=24&&Array.isArray(s.vehicles)&&s.vehicles.length<=12&&Array.isArray(s.crews)&&s.crews.length<=8&&Array.isArray(s.stock)&&s.stock.length===3&&s.stock.every(n=>int(n,0,200))&&int(s.nextCall));
 valid(int(s.nextVehicle)&&int(s.nextEmployee)&&int(s.nextCrew)&&Array.isArray(s.ledger)&&s.ledger.length<=60&&s.ledger.every(e=>e&&int(e.day,1,s.day)&&Number.isFinite(e.amount)&&typeof e.label==='string'));
 const people=new Map(),vehicles=new Map(),crews=new Map(),usedPeople=new Set(),usedVehicles=new Set(),assigned=new Set();
 for(const p of s.employees){valid(p&&int(p.id,0,s.nextEmployee-1)&&!people.has(p.id)&&typeof p.name==='string'&&int(p.service,0,2)&&int(p.level,1,5)&&pct(p.fatigue));people.set(p.id,p);}
 for(const v of s.vehicles){valid(v&&int(v.id,0,s.nextVehicle-1)&&!vehicles.has(v.id)&&VEHICLE_MODELS.some(m=>m.id===v.model)&&pct(v.fuel)&&pct(v.condition));vehicles.set(v.id,v);}
 for(const cr of s.crews){valid(cr&&int(cr.id,0,s.nextCrew-1)&&!crews.has(cr.id)&&int(cr.service,0,2)&&Array.isArray(cr.members)&&cr.members.length===2&&cr.members[0]!==cr.members[1]&&vehicles.has(cr.vehicle)&&!usedVehicles.has(cr.vehicle)&&point(cr.point)&&['idle','travel','diagnosis','repair'].includes(cr.status));
  usedVehicles.add(cr.vehicle);for(const id of cr.members){valid(people.has(id)&&people.get(id).service===cr.service&&!usedPeople.has(id));usedPeople.add(id);}crews.set(cr.id,cr);
 }
 const seen=new Set(s.done),order=missionOrder(s.seed,s.region),issued=new Set(order.slice(0,s.cursor));
 for(const c of s.calls){valid(c&&int(c.mission,0,998)&&!seen.has(c.mission)&&['new','travel','diagnosis','repair'].includes(c.status)&&typeof c.asked==='boolean'&&typeof c.contained==='boolean'&&typeof c.late==='boolean'&&Number.isSafeInteger(c.due)&&int(c.remaining)&&int(c.total));seen.add(c.mission);
  if(c.status==='new')valid(c.crew===null&&c.remaining===0);else{const cr=crews.get(c.crew);valid(cr&&cr.job===c.mission&&cr.status===c.status&&cr.service===catalog(s)[c.mission].service&&!assigned.has(cr.id)&&c.remaining>0&&c.remaining<=c.total&&Array.isArray(c.path)&&c.path.length>0&&c.path.length<=4&&c.path.every(point));assigned.add(cr.id);}
 }
 valid(seen.size===s.cursor&&[...seen].every(n=>issued.has(n)));for(const cr of s.crews)valid(cr.status==='idle'?cr.job===null:assigned.has(cr.id));
 valid(s.phase==='cleared'?s.done.length===999&&s.region<19:s.phase==='won'?s.done.length===999&&s.region===19:s.done.length<999);
 return s;
}
export function load(storage){try{const raw=storage.getItem(SAVE),backup=storage.getItem(BACKUP);if(raw!==null){try{return {state:decode(raw),blocked:false};}catch{}}if(backup!==null){try{return {state:decode(backup),blocked:false,recovered:true};}catch{}}return {state:null,blocked:raw!==null||backup!==null};}catch{return {state:null,blocked:true};}}
export function save(storage,s){const raw=encode(s);decode(raw);const previous=storage.getItem(SAVE);let backup=raw;if(previous!==null){try{decode(previous);backup=previous;}catch{}}storage.setItem(BACKUP,backup);storage.setItem(SAVE,raw);}
