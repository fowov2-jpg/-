import {SERVICES,COLORS,TYPES,decode as decodeLegacy} from './legacy-engine.js';
import {CITY_HOMES,DEPOT,DISTRICTS,PARTS,VEHICLE_MODELS,PEOPLE,MILESTONES,billFor} from './content.js';
import {travelTime} from './roads.js';
export {SERVICES,COLORS,TYPES,PARTS,VEHICLE_MODELS,DISTRICTS,MILESTONES};
export const HOMES=CITY_HOMES,SHIFT=480;
const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,n));
const clone=v=>JSON.parse(JSON.stringify(v));
function requireThat(condition,message){if(!condition)throw Error(message);}
function rand(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export const ownedHomes=s=>s.homes.filter(h=>h.active);
export const payroll=s=>s.employees.reduce((sum,e)=>sum+e.wage,0);
export const overhead=s=>4500+s.vehicles.reduce((sum,v)=>sum+VEHICLE_MODELS.find(m=>m.id===v.model).upkeep,0);
export const baseRevenue=s=>ownedHomes(s).reduce((sum,h)=>sum+h.rate,0);
export function book(s,amount,label){s.money+=amount;s.ledger.unshift({day:s.day,minute:s.minute,amount,label});s.ledger=s.ledger.slice(0,500);}
function spend(s,amount,label){requireThat(Number.isFinite(amount)&&amount>=0,'Неверная сумма');requireThat(s.money>=amount,'Недостаточно средств');book(s,-amount,label);}
function preparation(s){requireThat(s.phase==='prep','Доступно перед началом смены');requireThat(s.campaign.status!=='lost','Компания прекратила работу');}
export function crewVehicle(s,cr){return s.vehicles.find(v=>v.id===cr.vehicle);}
export function crewPeople(s,cr){return cr.members.map(id=>s.employees.find(e=>e.id===id));}
export function refreshCrews(s){for(const cr of s.crews){const people=crewPeople(s,cr),v=crewVehicle(s,cr);cr.level=Math.min(...people.map(e=>e.level));cr.xp=Math.min(...people.map(e=>e.xp));cr.fatigue=Math.max(...people.map(e=>e.fatigue));cr.fuel=v.fuel;cr.condition=v.condition;cr.equipment=v.equipment;}}
function makeMarket(s){s.candidates=[];for(let service=0;service<3;service++){const pool=PEOPLE.filter(p=>p[1]===service&&!s.employees.some(e=>e.name===p[0]));for(let i=0;i<Math.min(2,pool.length);i++){const p=pool[(s.day-1+i)%pool.length];s.candidates.push({id:s.day*100+service*2+i,name:p[0],service:p[1],level:p[2],wage:p[3],years:p[4]});}}}
export function fresh(){
 const s={version:3,day:1,minute:0,phase:'prep',money:3000000,opening:3000000,reputation:70,seed:112,sequence:0,nextCall:0,report:null,calls:[],ledger:[],
  homes:CITY_HOMES.map(h=>({...h,active:h.id<3,wear:[40,32,48][h.id]??(42+h.id%4*7),loyalty:85,cooldown:0})),
  employees:PEOPLE.slice(0,6).map((p,id)=>({id,name:p[0],service:p[1],level:p[2],wage:p[3],years:p[4],xp:0,fatigue:0})),
  vehicles:[0,1,2].map(id=>({id,model:id===2?'truck':'van',fuel:100,condition:100,equipment:1})),
  crews:SERVICES.map((name,id)=>({id,name,service:id,members:[id*2,id*2+1],vehicle:id,status:'idle',job:null,remaining:0,total:0,home:DEPOT})),
  warehouse:{capacity:200,stock:[40,40,40],orders:[],sequence:0},candidates:[],nextEmployee:6,nextVehicle:3,nextCrew:3,
  campaign:{status:'running',completed:0,onTime:0,contractsWon:3,milestones:[],lossReason:null}};
 makeMarket(s);refreshCrews(s);return s;
}
export function materials(s,call){return billFor(call.type,TYPES);}
export function stockUsage(s){return s.warehouse.stock.reduce((a,b)=>a+b,0)+s.warehouse.orders.reduce((a,o)=>a+o.quantity,0);}
export function dispatchReason(s,call,cr){
 if(s.phase!=='active')return 'Сначала начните смену';
 if(call.status==='blocked')return 'Сначала завершите предыдущий этап';
 if(call.status!=='new')return 'Заявка уже назначена';
 if(cr.service!==TYPES[call.type][1])return 'Другая специализация';
 if(cr.status!=='idle')return 'Бригада занята';
 if(cr.fuel<8)return 'Нужна заправка';if(cr.condition<20)return 'Нужно ТО';if(cr.fatigue>90)return 'Сотрудникам нужен отдых';
 const bill=materials(s,call),model=VEHICLE_MODELS.find(m=>m.id===crewVehicle(s,cr).model);
 if(bill.quantity>model.capacity)return 'Не хватает грузового места';
 if(s.warehouse.stock[bill.part]<bill.quantity)return 'Недостаточно комплектов на складе';return '';
}
export function spawn(s,typeIndex=null,homeIndex=null){
 const homes=ownedHomes(s);requireThat(homes.length>0,'Нет действующих договоров');
 const winter=Math.floor((s.day-1)/7)%4===0,pool=TYPES.map((_,i)=>i).filter(i=>winter||i!==17);if(winter)pool.push(5,5,17,17);
 const type=typeIndex??pool[Math.floor(rand(s)*pool.length)];requireThat(Number.isInteger(type)&&!!TYPES[type],'Неизвестный тип обращения');
 const weights=homes.map(h=>20+h.wear);let roll=rand(s)*weights.reduce((a,b)=>a+b,0),index=0;while(index<weights.length-1&&(roll-=weights[index])>0)index++;
 const home=homeIndex??homes[index].id;requireThat(s.homes[home]?.active,'Дом не обслуживается');
 const priority=TYPES[type][2],call={id:++s.sequence,type,home,priority,created:s.minute,createdDay:s.day,status:'new',asked:false,diagnosed:false,contained:false,crew:null,due:s.minute+[180,110,65][priority-1],late:false,reserved:null,dependsOn:null,incident:null,completedDay:null};s.calls.push(call);return call;
}
export function spawnEmergency(s,home){
 const a=spawn(s,0,home),b=spawn(s,8,home),c=spawn(s,18,home),incident='flood-'+a.id;
 for(const call of [a,b,c])call.incident=incident;
 b.dependsOn=a.id;b.status='blocked';c.dependsOn=b.id;c.status='blocked';return [a,b,c];
}
export function start(s){
 preparation(s);s.phase='active';s.minute=0;s.nextCall=30;
 if(s.day===1&&s.sequence===0){spawn(s,0,0);spawn(s,7,1);spawn(s,15,2);}
 else {if(s.calls.filter(c=>!['done','blocked'].includes(c.status)).length<3)spawn(s);if(s.day%5===0)spawnEmergency(s,ownedHomes(s)[Math.floor(rand(s)*ownedHomes(s).length)].id);}
}
export function question(s,id){const c=s.calls.find(c=>c.id===id);requireThat(c,'Заявка не найдена');if(!c.asked&&c.status==='diagnosis'){const cr=s.crews.find(cr=>cr.job===id);if(cr){const elapsed=cr.total-cr.remaining;cr.remaining=Math.min(cr.remaining,Math.max(1,4-elapsed));cr.total=elapsed+cr.remaining;}}c.asked=true;return TYPES[c.type][6];}
export function contain(s,id){const c=s.calls.find(c=>c.id===id);requireThat(c&&c.status==='new'&&!c.contained,'Инструкция уже передана или работа началась');c.contained=true;c.asked=true;c.due+=15;}
export function dispatch(s,id,crewId){
 refreshCrews(s);const c=s.calls.find(c=>c.id===id),cr=s.crews.find(cr=>cr.id===crewId);requireThat(c&&cr,'Заявка или бригада не найдена');const reason=dispatchReason(s,c,cr);requireThat(!reason,reason);
 const bill=materials(s,c);s.warehouse.stock[bill.part]-=bill.quantity;c.reserved={...bill};c.origin=cr.home;c.status='travel';c.crew=cr.id;cr.status='travel';cr.job=c.id;
 const v=crewVehicle(s,cr),model=VEHICLE_MODELS.find(m=>m.id===v.model);cr.remaining=cr.total=travelTime(cr.home,c.home,model.speed);v.fuel-=8;refreshCrews(s);
}
export function outsource(s,id){requireThat(s.phase==='active','Смена не запущена');const c=s.calls.find(c=>c.id===id);requireThat(c&&c.status==='new','Заявка недоступна');spend(s,TYPES[c.type][4]*3,'Подрядчик: '+TYPES[c.type][0]);c.status='contractor';c.remaining=45;}
function complete(s,c){
 c.status='done';c.completed=s.minute;c.completedDay=s.day;s.campaign.completed++;if(!c.late){s.campaign.onTime++;s.reputation=clamp(s.reputation+1);}s.homes[c.home].wear=clamp(s.homes[c.home].wear-2);
 for(const next of s.calls.filter(call=>call.status==='blocked'&&call.dependsOn===c.id)){next.status='new';next.created=s.minute;next.due=s.minute+[180,110,65][next.priority-1];}
}
function receiveOrders(s){const ready=s.warehouse.orders.filter(o=>o.arriveDay<=s.day&&o.remaining<=0);for(const o of ready)s.warehouse.stock[o.part]+=o.quantity;s.warehouse.orders=s.warehouse.orders.filter(o=>!ready.includes(o));}
export function tick(s,minutes=1){
 if(s.phase!=='active')return;
 for(let n=0;n<Math.min(SHIFT,Math.max(0,Math.floor(minutes)))&&s.phase==='active';n++){
  s.minute++;
  for(const order of s.warehouse.orders)if(order.arriveDay<=s.day&&order.remaining>0)order.remaining--;receiveOrders(s);
  if(s.minute>=s.nextCall&&s.minute<400){const cap=Math.min(24,ownedHomes(s).length*3);if(s.calls.filter(c=>c.status!=='done').length<cap&&rand(s)<.35+ownedHomes(s).reduce((sum,h)=>sum+h.wear,0)/(ownedHomes(s).length*100))spawn(s);s.nextCall=s.minute+Math.max(12,45-ownedHomes(s).length*2)+Math.floor(rand(s)*15);}
  for(const c of s.calls){
   if(!['done','blocked'].includes(c.status)&&!c.late&&s.minute>c.due){c.late=true;s.reputation=clamp(s.reputation-3);book(s,-1500*c.priority,'Ущерб: '+TYPES[c.type][0]);s.homes[c.home].wear=clamp(s.homes[c.home].wear+3);}
   if(c.status==='contractor'&&--c.remaining<=0)complete(s,c);
  }
  for(const cr of s.crews){
   if(cr.status==='idle'||--cr.remaining>0)continue;
   const c=s.calls.find(c=>c.id===cr.job);
   if(cr.status==='travel'){cr.status=c.status='diagnosis';cr.home=c.home;cr.remaining=cr.total=c.asked?4:8;}
   else if(cr.status==='diagnosis'){c.diagnosed=true;cr.status=c.status='repair';cr.remaining=cr.total=Math.ceil(TYPES[c.type][3]*(c.contained?.9:1)/(1+(cr.level-1)*.1+(cr.equipment-1)*.15));}
   else {complete(s,c);cr.status='idle';cr.job=null;for(const person of crewPeople(s,cr)){person.xp+=10;person.fatigue=clamp(person.fatigue+12);}const v=crewVehicle(s,cr);v.condition=clamp(v.condition-3);}
  }
  refreshCrews(s);if(s.minute>=SHIFT)finish(s);
 }
}
function awardMilestones(s){
 const rewards=[];
 const conditions={reliable:s.campaign.completed>=3&&!s.calls.some(c=>c.status!=='done'&&c.late),growth:ownedHomes(s).length>=4&&s.crews.length>=4,operator:ownedHomes(s).length>=9&&s.reputation>=90&&s.campaign.completed>=100};
 for(const m of MILESTONES)if(conditions[m.id]&&!s.campaign.milestones.includes(m.id)){s.campaign.milestones.push(m.id);book(s,m.reward,'Цель: '+m.title);rewards.push(m.id);if(m.id==='operator')s.campaign.status='won';}return rewards;
}
export function finish(s){
 if(s.phase!=='active')return;
 const invoices=[],lost=[];
 for(const home of ownedHomes(s)){
  const overdue=s.calls.filter(c=>c.home===home.id&&c.status!=='done'&&c.status!=='blocked'&&c.late),lateDone=s.calls.filter(c=>c.home===home.id&&c.status==='done'&&c.completedDay===s.day&&c.late),critical=overdue.filter(c=>c.priority===3).length;
  const quality=clamp(1-overdue.length*.45-critical*.55-lateDone.length*.08,0,1),paid=Math.round(home.rate*quality);
  book(s,paid,'Договор: '+home.name);home.loyalty=clamp(home.loyalty+(overdue.length?-(8+overdue.length*4+critical*3):lateDone.length?-lateDone.length*3:2));
  invoices.push({home:home.id,base:home.rate,paid,loyalty:home.loyalty});
  if(home.loyalty<25){home.active=false;home.cooldown=s.day+14;lost.push(home.id);}
 }
 book(s,-payroll(s),'Зарплаты: '+s.employees.length+' сотрудников');book(s,-overhead(s),'Гараж и автопарк');
 const pending=s.calls.filter(c=>c.status!=='done').length,late=s.calls.filter(c=>c.late).length;
 if(pending)s.reputation=clamp(s.reputation-Math.min(8,s.calls.filter(c=>c.status!=='done'&&c.late).length));
 const rewards=awardMilestones(s);
 if(s.money<0||!ownedHomes(s).length||s.reputation===0){s.campaign.status='lost';s.campaign.lossReason=s.money<0?'Компания не смогла оплатить обязательства':!ownedHomes(s).length?'Жители расторгли все договоры':'Компания потеряла доверие жителей';}
 s.report={done:s.calls.filter(c=>c.status==='done'&&c.completedDay===s.day).length,pending,total:s.calls.length,late,net:s.money-s.opening,invoices,lost,rewards};s.phase='report';
}
export function nextDay(s){
 requireThat(s.phase==='report','Сначала завершите смену');requireThat(s.campaign.status!=='lost',s.campaign.lossReason||'Компания прекратила работу');s.day++;s.minute=0;s.phase='prep';s.report=null;s.opening=s.money;
 s.calls=s.calls.filter(c=>c.status!=='done');for(const c of s.calls){c.created-=SHIFT;c.due-=SHIFT;}
 for(const e of s.employees)e.fatigue=clamp(e.fatigue-50);for(const h of ownedHomes(s))h.wear=clamp(h.wear+1);
 for(const order of s.warehouse.orders)if(order.arriveDay<=s.day)order.remaining=0;receiveOrders(s);makeMarket(s);refreshCrews(s);
}
export function maintain(s,id,kind){
 const cr=s.crews.find(c=>c.id===id);requireThat(cr&&cr.status==='idle','Дождитесь освобождения бригады');const v=crewVehicle(s,cr);
 if(kind==='train'){preparation(s);requireThat(cr.xp>=30&&cr.level<5,'Нужно 30 опыта; максимальный уровень — 5');spend(s,15000,'Обучение: '+cr.name);for(const e of crewPeople(s,cr)){e.xp-=30;e.level=Math.min(5,e.level+1);}}
 else return maintainVehicle(s,v.id,kind);refreshCrews(s);
}
export function maintainVehicle(s,id,kind){
 requireThat(s.phase!=='report'&&s.campaign.status!=='lost','Обслуживание доступно до смены и во время работы');
 const v=s.vehicles.find(v=>v.id===id);requireThat(v,'Автомобиль не найден');const crew=s.crews.find(c=>c.vehicle===id);requireThat(!crew||crew.status==='idle','Дождитесь возвращения автомобиля');
 if(kind==='service'){requireThat(v.fuel<100||v.condition<100,'Автомобиль уже обслужен');spend(s,5000,'Топливо и ТО: автомобиль №'+(id+1));v.fuel=100;v.condition=100;}
 else if(kind==='equipment'){requireThat(v.equipment<3,'Максимальное оснащение');spend(s,25000*v.equipment,'Оснащение: автомобиль №'+(id+1));v.equipment++;}
 else throw Error('Неизвестное действие');refreshCrews(s);
}

export function prevent(s,id){preparation(s);const h=s.homes[id];requireThat(h?.active,'Дом не обслуживается');requireThat(h.wear>0,'Сети в хорошем состоянии');spend(s,12000,'Профилактика: '+h.name);h.wear=clamp(h.wear-15);}
export function renovate(s,id){preparation(s);const h=s.homes[id];requireThat(h?.active,'Дом не обслуживается');requireThat(h.wear>15,'Капитальный ремонт пока не требуется');spend(s,150000,'Капитальный ремонт: '+h.name);h.wear=clamp(h.wear-45);h.loyalty=clamp(h.loyalty+12);}
export function contractReason(s,id){const h=s.homes[id];if(!h)return 'Дом не найден';if(h.active)return 'Договор уже действует';if(h.cooldown>s.day)return 'Повторные переговоры: день '+h.cooldown;const d=DISTRICTS[h.district];if(s.day<d.day)return 'Район откроется на '+d.day+' день';if(s.reputation<d.reputation)return 'Нужна репутация '+d.reputation;if(s.campaign.completed<d.completed)return 'Нужно выполнить '+d.completed+' работ';if(s.money<h.fee)return 'Недостаточно средств для запуска обслуживания';return '';}
export function acceptContract(s,id){preparation(s);const reason=contractReason(s,id);requireThat(!reason,reason);const h=s.homes[id];spend(s,h.fee,'Запуск договора: '+h.name);h.active=true;h.loyalty=85;s.campaign.contractsWon++;}
export function orderParts(s,part,quantity,express=false){
 requireThat(s.phase!=='report','Закупки доступны в подготовке и во время смены');requireThat(Number.isInteger(part)&&!!PARTS[part]&&Number.isInteger(quantity)&&quantity>0&&quantity<=100,'Неверное количество');requireThat(stockUsage(s)+quantity<=s.warehouse.capacity,'Недостаточно места на складе');
 const price=Math.round(PARTS[part].price*quantity*(express?1.35:.9));spend(s,price,'Закупка: '+PARTS[part].short+' ×'+quantity+(express?' · экспресс':''));
 if(express&&s.phase==='prep')s.warehouse.stock[part]+=quantity;
 else s.warehouse.orders.push({id:++s.warehouse.sequence,part,quantity,arriveDay:express?s.day:s.day+1,remaining:express?30:0});
}
export function expandWarehouse(s){preparation(s);requireThat(s.warehouse.capacity<800,'Максимальный склад');spend(s,80000,'Расширение склада');s.warehouse.capacity+=200;}
export function hire(s,candidateId){preparation(s);const c=s.candidates.find(c=>c.id===candidateId);requireThat(c,'Кандидат недоступен');requireThat(s.employees.length<24,'В штате максимум 24 сотрудника');spend(s,8000+c.wage*3,'Найм: '+c.name);s.employees.push({...c,id:s.nextEmployee++,fatigue:0,xp:0});s.candidates=s.candidates.filter(v=>v.id!==candidateId);}
export function fire(s,id){preparation(s);const e=s.employees.find(e=>e.id===id);requireThat(e&&!s.crews.some(cr=>cr.members.includes(id)),'Сначала освободите сотрудника от бригады');spend(s,e.wage*2,'Расчёт: '+e.name);s.employees=s.employees.filter(e=>e.id!==id);}
export function trainEmployee(s,id){preparation(s);const e=s.employees.find(e=>e.id===id);requireThat(e&&e.xp>=20&&e.level<5,'Нужно 20 опыта; максимальный уровень — 5');requireThat(!s.crews.some(cr=>cr.members.includes(id)&&cr.status!=='idle'),'Сотрудник на выезде');spend(s,5000*e.level,'Обучение: '+e.name);e.xp-=20;e.level++;refreshCrews(s);}
export function buyVehicle(s,modelId){preparation(s);const model=VEHICLE_MODELS.find(v=>v.id===modelId);requireThat(model&&s.vehicles.length<12,'Автомобиль недоступен');spend(s,model.price,'Покупка: '+model.name);s.vehicles.push({id:s.nextVehicle++,model:model.id,fuel:100,condition:100,equipment:1});}
export function sellVehicle(s,id){preparation(s);const v=s.vehicles.find(v=>v.id===id);requireThat(v&&!s.crews.some(cr=>cr.vehicle===id),'Сначала снимите автомобиль с бригады');const model=VEHICLE_MODELS.find(m=>m.id===v.model);book(s,Math.floor(model.price*.6*v.condition/100),'Продажа: '+model.name);s.vehicles=s.vehicles.filter(v=>v.id!==id);}
export function formCrew(s,memberIds,vehicleId){
 preparation(s);requireThat(s.crews.length<8&&Array.isArray(memberIds)&&memberIds.length===2&&memberIds[0]!==memberIds[1],'Нужны два разных специалиста; максимум 8 бригад');
 const people=memberIds.map(id=>s.employees.find(e=>e.id===id)),v=s.vehicles.find(v=>v.id===vehicleId);
 requireThat(people.every(Boolean)&&people[0].service===people[1].service,'Нужны два специалиста одного профиля');
 requireThat(people.every(e=>!s.crews.some(cr=>cr.members.includes(e.id))),'Сотрудник уже назначен в бригаду');requireThat(v&&!s.crews.some(cr=>cr.vehicle===v.id),'Автомобиль недоступен');
 const id=s.nextCrew++,service=people[0].service;s.crews.push({id,name:SERVICES[service].replace(/№\d+/, '№'+(id+1)),service,members:[...memberIds],vehicle:vehicleId,status:'idle',job:null,remaining:0,total:0,home:DEPOT});refreshCrews(s);
}
export function disbandCrew(s,id){preparation(s);const cr=s.crews.find(cr=>cr.id===id);requireThat(cr&&cr.status==='idle','Бригада на выезде');s.crews=s.crews.filter(cr=>cr.id!==id);for(const c of s.calls)if(c.status==='done'&&c.crew===id)c.crew=null;}
export function encode(s){return JSON.stringify(s);}
function migrate(raw){
 const old=decodeLegacy(raw),s=fresh();for(const key of ['day','minute','phase','money','opening','reputation','seed','sequence','nextCall','ledger'])s[key]=clone(old[key]);
 for(const [id,h] of old.homes.entries())s.homes[id]={...s.homes[id],wear:h.wear,name:h.name};
 for(const cr of old.crews){const target=s.crews[cr.id],v=s.vehicles[cr.id];Object.assign(target,{status:cr.status,job:cr.job,remaining:cr.remaining,total:cr.total,home:cr.home===3?DEPOT:cr.home});Object.assign(v,{fuel:cr.fuel,condition:cr.condition,equipment:cr.equipment});for(const e of crewPeople(s,target))Object.assign(e,{level:cr.level,xp:cr.xp,fatigue:cr.fatigue});}
 s.calls=old.calls.map(c=>({...c,createdDay:old.day,completedDay:c.status==='done'?old.day:null,contained:false,reserved:null,dependsOn:null,incident:null}));
 s.campaign.completed=s.calls.filter(c=>c.status==='done').length;s.campaign.onTime=s.calls.filter(c=>c.status==='done'&&!c.late).length;
 s.report=old.report?{...old.report,invoices:[],lost:[],rewards:[]}:null;makeMarket(s);refreshCrews(s);return s;
}
export function decode(raw){
 let s=JSON.parse(raw);if(s?.version===1||s?.version===2)s=migrate(raw);
 const valid=c=>requireThat(c,'Сохранение повреждено'),obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),int=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max,pct=v=>Number.isFinite(v)&&v>=0&&v<=100;
 valid(obj(s)&&s.version===3&&['prep','active','report'].includes(s.phase));valid(int(s.day,1)&&int(s.minute,0,SHIFT)&&Number.isFinite(s.money)&&Number.isFinite(s.opening)&&pct(s.reputation)&&int(s.seed,0,0xffffffff)&&int(s.sequence)&&int(s.nextCall));
 valid(Array.isArray(s.homes)&&s.homes.length===CITY_HOMES.length&&Array.isArray(s.crews)&&s.crews.length<=8&&Array.isArray(s.employees)&&s.employees.length<=24&&Array.isArray(s.vehicles)&&s.vehicles.length<=12&&Array.isArray(s.calls)&&Array.isArray(s.ledger)&&Array.isArray(s.candidates));
 valid(obj(s.campaign)&&['running','won','lost'].includes(s.campaign.status)&&int(s.campaign.completed)&&int(s.campaign.onTime,0,s.campaign.completed)&&int(s.campaign.contractsWon)&&Array.isArray(s.campaign.milestones)&&s.campaign.milestones.every(id=>MILESTONES.some(m=>m.id===id)));
 for(const [id,h] of s.homes.entries())valid(obj(h)&&h.id===id&&typeof h.name==='string'&&h.district===CITY_HOMES[id].district&&typeof h.active==='boolean'&&pct(h.wear)&&pct(h.loyalty)&&int(h.cooldown)&&int(h.rate,1)&&int(h.fee)&&Number.isFinite(h.x)&&Number.isFinite(h.y));
 const people=new Map(),vehicles=new Map(),crews=new Map(),calls=new Map(),usedPeople=new Set(),usedVehicles=new Set();
 for(const e of s.employees){valid(obj(e)&&int(e.id)&&!people.has(e.id)&&typeof e.name==='string'&&int(e.service,0,2)&&int(e.level,1,10000)&&int(e.xp)&&int(e.wage,1)&&int(e.years)&&pct(e.fatigue));people.set(e.id,e);}
 for(const v of s.vehicles){valid(obj(v)&&int(v.id)&&!vehicles.has(v.id)&&VEHICLE_MODELS.some(m=>m.id===v.model)&&pct(v.fuel)&&pct(v.condition)&&int(v.equipment,1,3));vehicles.set(v.id,v);}
 for(const cr of s.crews){
  valid(obj(cr)&&int(cr.id)&&!crews.has(cr.id)&&typeof cr.name==='string'&&int(cr.service,0,2)&&Array.isArray(cr.members)&&cr.members.length===2&&cr.members[0]!==cr.members[1]&&vehicles.has(cr.vehicle)&&!usedVehicles.has(cr.vehicle));usedVehicles.add(cr.vehicle);
  for(const id of cr.members){valid(people.has(id)&&!usedPeople.has(id)&&people.get(id).service===cr.service);usedPeople.add(id);}
  valid(['idle','travel','diagnosis','repair'].includes(cr.status)&&int(cr.home,0,DEPOT)&&int(cr.remaining)&&int(cr.total));if(cr.status==='idle')valid(cr.job===null);else valid(int(cr.job,1)&&cr.remaining>0&&cr.remaining<=cr.total);crews.set(cr.id,cr);
 }
 for(const c of s.calls){
  valid(obj(c)&&int(c.id,1,s.sequence)&&!calls.has(c.id)&&int(c.type,0,TYPES.length-1)&&int(c.home,0,CITY_HOMES.length-1)&&c.priority===TYPES[c.type][2]&&['new','blocked','travel','diagnosis','repair','contractor','done'].includes(c.status));
  valid(Number.isSafeInteger(c.created)&&c.created<=s.minute&&Number.isSafeInteger(c.due)&&c.due>=c.created&&int(c.createdDay,1,s.day)&&typeof c.asked==='boolean'&&typeof c.diagnosed==='boolean'&&typeof c.contained==='boolean'&&typeof c.late==='boolean');
  valid(c.origin===undefined||int(c.origin,0,DEPOT));valid(c.crew===null||crews.has(c.crew));valid(c.dependsOn===null||int(c.dependsOn,1,c.id-1));valid(c.reserved===null||(obj(c.reserved)&&int(c.reserved.part,0,2)&&int(c.reserved.quantity,1,100)));
  if(['new','blocked','contractor'].includes(c.status))valid(c.crew===null);if(c.status==='contractor')valid(int(c.remaining,1,45));if(c.status==='done')valid(int(c.completed,0,SHIFT)&&int(c.completedDay,1,s.day));calls.set(c.id,c);
 }
 for(const c of s.calls){if(c.dependsOn!==null)valid(calls.has(c.dependsOn)||c.status!=='blocked');if(['travel','diagnosis','repair'].includes(c.status)){const cr=crews.get(c.crew);valid(cr&&cr.job===c.id&&cr.status===c.status&&cr.service===TYPES[c.type][1]);}}
 for(const cr of s.crews)if(cr.status!=='idle'){const c=calls.get(cr.job);valid(c&&c.crew===cr.id&&c.status===cr.status);}
 const w=s.warehouse;valid(obj(w)&&int(w.capacity,1,10000)&&Array.isArray(w.stock)&&w.stock.length===3&&w.stock.every(n=>int(n))&&Array.isArray(w.orders)&&int(w.sequence));
 const orders=new Set();for(const o of w.orders){valid(obj(o)&&int(o.id,1,w.sequence)&&!orders.has(o.id)&&int(o.part,0,2)&&int(o.quantity,1,100)&&int(o.arriveDay,1)&&int(o.remaining,0,30));orders.add(o.id);}valid(stockUsage(s)<=w.capacity);
 for(const e of s.ledger)valid(obj(e)&&int(e.day,1,s.day)&&int(e.minute,0,SHIFT)&&Number.isFinite(e.amount)&&typeof e.label==='string');
 for(const c of s.candidates)valid(obj(c)&&int(c.id)&&typeof c.name==='string'&&int(c.service,0,2)&&int(c.level,1,5)&&int(c.wage,1)&&int(c.years));
 valid(int(s.nextEmployee)&&s.employees.every(e=>e.id<s.nextEmployee)&&int(s.nextVehicle)&&s.vehicles.every(v=>v.id<s.nextVehicle)&&int(s.nextCrew)&&s.crews.every(c=>c.id<s.nextCrew));
 if(s.phase==='report'){const r=s.report;valid(obj(r)&&int(r.done)&&int(r.pending)&&int(r.total)&&int(r.late,0,r.total)&&Number.isFinite(r.net)&&Array.isArray(r.invoices)&&Array.isArray(r.lost)&&Array.isArray(r.rewards));for(const row of r.invoices)valid(obj(row)&&int(row.home,0,s.homes.length-1)&&int(row.base)&&int(row.paid,0,row.base)&&pct(row.loyalty));valid(r.lost.every(id=>int(id,0,s.homes.length-1))&&r.rewards.every(id=>MILESTONES.some(m=>m.id===id)));}else valid(s.report===null);
 refreshCrews(s);return s;
}
