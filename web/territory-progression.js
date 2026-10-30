import {district,roadStop,parkingBay,hash} from './campaign-city.js';

export const AREA_CAPACITY=999, DISTRICT_CAPACITY=60, STARTING_HOUSES=3;
export const AREA_NAMES=['Северная','Садовая','Центральная','Заречная','Восточная','Промышленная','Берёзовая','Высотная','Солнечная','Вокзальная','Озёрная','Южная','Новогородская','Заводская','Лесная','Западная','Парковая','Прибрежная','Академическая','Столичная'];
const NAMES=['Уютный','Сосновый','Старый центр','Речной','Молодёжный','Вишнёвый','Мостовой','Школьный','Нагорный','Мастеровой','Липовый','Станционный','Островной','Ясный','Каменный','Дальний','Тихий'];
const cache=new Map(),houseIndices=new WeakMap();
export const enabled=s=>s?.version===9&&!!s.operations?.territory;
export const area=s=>s.operations.career.areas[s.region];
export const current=s=>s.operations.territory.current;
export const record=s=>area(s).districts.find(d=>d.id===current(s));
export const balance=s=>s.operations.career.earned-s.operations.career.spent;
export const unlocked=s=>s.operations.career.areas.length-1;
export const areaName=(s,region=s.region)=>AREA_NAMES[region]+' область';

// The address catalogue is partitioned once. Neighbouring entrances form compact
// service districts; there are no duplicate contracts or invented extra homes.
export function districts(seed,region){
 const key=seed+':'+region;if(cache.has(key))return cache.get(key);
 const city=district(seed,region),remaining=new Set(city.homes.map(h=>h.id)),result=[];
 let anchor=city.homes[151];
 while(remaining.size){
  let ids=[...remaining].sort((a,b)=>Math.hypot(city.homes[a].x-anchor.x,city.homes[a].y-anchor.y)-Math.hypot(city.homes[b].x-anchor.x,city.homes[b].y-anchor.y)||a-b);
  if(!result.length)ids=[...new Set([144,151,156,147,152,159,162,164,...ids])];
  ids=ids.slice(0,DISTRICT_CAPACITY);for(const id of ids)remaining.delete(id);
  const x=ids.reduce((n,id)=>n+city.homes[id].x,0)/ids.length,y=ids.reduce((n,id)=>n+city.homes[id].y,0)/ids.length;
  result.push({id:result.length,name:NAMES[result.length],ids,x,y,capacity:ids.length});
  if(remaining.size)anchor=city.homes[[...remaining].sort((a,b)=>Math.hypot(city.homes[a].x-x,city.homes[a].y-y)-Math.hypot(city.homes[b].x-x,city.homes[b].y-y)||a-b)[0]];
 }
 cache.set(key,result);return result;
}
export const layout=(s,id=current(s),region=s.region)=>districts(s.seed,region)[id];
export const districtName=s=>layout(s).name+' район';
export const districtFor=(s,id,region=s.region)=>districts(s.seed,region).find(d=>d.ids.includes(id)).id;
function houseIndex(s){
 const list=s.operations.houses,previous=houseIndices.get(s);
 if(previous?.list===list&&previous.length===list.length)return previous;
 const groups=new Map(),regions=new Map(),lookups=new Map();
 for(const h of list){
  if(!lookups.has(h.region)){const map=new Uint8Array(999);for(const d of districts(s.seed,h.region))for(const id of d.ids)map[id]=d.id;lookups.set(h.region,map);}
  const key=h.region+':'+lookups.get(h.region)[h.id];
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(h);
  if(!regions.has(h.region))regions.set(h.region,[]);regions.get(h.region).push(h);
 }
 const index={list,length:list.length,groups,regions};houseIndices.set(s,index);return index;
}
export function homes(s,region=s.region,id=current(s)){
 const index=houseIndex(s);
 if(s.operations.territory.transition&&region===s.region)return index.regions.get(region)??[];
 return index.groups.get(region+':'+id)??[];
}
export function desks(s){
 return s.operations.career.areas.flatMap(a=>a.districts.filter(d=>!(a.region===s.region&&(d.id===current(s)||s.operations.territory.transition))).map(d=>({area:a,district:d,homes:homes(s,a.region,d.id)})));
}
export function parking(s,id){
 if(current(s)===0){const p=parkingBay(s.seed,s.region,id);return [p[0]+1416,p[1]+874];}
 const group=layout(s),p=roadStop(district(s.seed,s.region).homes[group.ids[0]]);
 // Stay on the existing curb, with separate positions along its road axis.
 const vertical=Math.abs(p[0]-district(s.seed,s.region).homes[group.ids[0]].x)>1;
 return vertical?[p[0]+14,p[1]+(id%4)*90]:[p[0]+(id%4)*90,p[1]+14];
}
export function upgrade(s){
 if(!s||s.version!==8)return s;
 const c=s.operations.career;
 s.operations.territory={schema:1,current:0,legacySpent:c.spent,transition:s.phase!=='prep',achievements:[],streak:0};
 for(const a of c.areas){
  const owned=s.operations.houses.filter(h=>h.region===a.region),groups=districts(s.seed,a.region);
  const occupied=groups.filter(g=>owned.some(h=>g.ids.includes(h.id)));
  const active=[...occupied].sort((a,b)=>owned.filter(h=>b.ids.includes(h.id)).length-owned.filter(h=>a.ids.includes(h.id)).length||a.id-b.id)[0].id;
  a.price=0;a.selected=active;a.districts=occupied.map(g=>({id:g.id,openedDay:a.openedDay,price:0,points:g.id===active?a.points:0,
   shifts:a.region===s.region&&g.id===active?s.operations.districtShifts:0,handled:0,shift:null,lastReport:null}));
  if(a.region===s.region)s.operations.territory.current=active;
  if(a.shift)for(const d of a.districts){
   const ids=new Set(groups[d.id].ids),jobs=a.shift.jobs.filter(j=>ids.has(j.home));
   if(jobs.length){d.shift={...a.shift,jobs,completed:jobs.filter(j=>j.status==='done').length};d.lastReport=null;}
  }
  a.shift=null;
 }
 s.version=9;s.operations.schema=3;
 if(s.report?.career)s.report.career.price=areaPrice(s);
 return s;
}
export const districtPrice=s=>80+20*(area(s).districts.length-1);
export const areaPrice=s=>300+unlocked(s)*75;
export function expansion(s){
 const trust=Math.round(homes(s).reduce((n,h)=>n+h.trust,0)/homes(s).length);
 const common=['prep','report'].includes(s.phase)&&!s.calls.length&&trust>=65;
 return {trust,points:balance(s),price:districtPrice(s),shifts:record(s).shifts,
  district:common&&record(s).shifts>=2&&balance(s)>=districtPrice(s)&&s.money>=90000+25000&&area(s).districts.length<17,
  area:common&&s.region===unlocked(s)&&area(s).districts.length>=3&&area(s).districts.reduce((n,d)=>n+d.shifts,0)>=6&&balance(s)>=areaPrice(s)&&unlocked(s)<19};
}
export function contractLimit(s){
 const count=homes(s).length;
 return Math.min(s.operations.territory.transition?999:layout(s).capacity,Math.max(count,STARTING_HOUSES+3*Math.floor(record(s).points/20)));
}
export function nextDistrict(s){return districts(s.seed,s.region).find(d=>!area(s).districts.some(o=>o.id===d.id));}
export function openDistrict(s,id,log,newHouse){
 const group=nextDistrict(s);
 if(!group||group.id!==id||!expansion(s).district)throw Error('Нужны две смены района, доверие от 65, баллы и 90 000 ₽ на открытие. Закройте очередь.');
 const price=districtPrice(s);s.operations.career.spent+=price;
 if(s.phase==='report')s.day++;
 area(s).districts.push({id,openedDay:s.day,price,points:0,shifts:0,handled:0,shift:null,lastReport:null});
 log(s,-90000,'Открытие района: '+group.name);
 for(const [i,home]of group.ids.slice(0,STARTING_HOUSES).entries())s.operations.houses.push(newHouse(s,home,i));
 move(s,id);
}
export function switchDistrict(s,id){
 if(!['prep','report'].includes(s.phase)||s.calls.length||!area(s).districts.some(d=>d.id===id))throw Error('Сменить район можно между сменами после закрытия обращений');
 if(id===current(s))return;
 if(s.phase==='report')s.day++;
 move(s,id);
}
export function switchArea(s,region){
 if(!['prep','report'].includes(s.phase)||s.calls.length||!s.operations.career.areas[region])throw Error('Перейти в другую область можно между сменами после закрытия обращений');
 if(region===s.region)return;
 if(s.phase==='report')s.day++;
 area(s).selected=current(s);s.region=region;
 move(s,area(s).selected??area(s).districts[0].id);
}
function move(s,id){
 s.operations.territory.current=id;s.operations.territory.transition=false;
 area(s).selected=id;
 const d=record(s);d.shift=null;s.phase='prep';s.minute=0;s.report=null;
 s.operations.districtShifts=d.shifts;s.operations.districtStartDay=d.openedDay;s.operations.districtMajor=0;
 for(const cr of s.crews){cr.point=parking(s,cr.id);cr.angle=-Math.PI/2;cr.status='idle';cr.job=null;delete cr.returnTrip;}
 for(const p of s.employees)p.fatigue=Math.max(0,p.fatigue-60);
}
export function openArea(s){
 if(!expansion(s).area)throw Error('Для новой области нужны три района, шесть смен, доверие от 65 и карьерные баллы');
 const price=areaPrice(s);s.operations.career.spent+=price;area(s).selected=current(s);
 s.operations.career.areas.push({region:s.region+1,openedDay:s.day+(s.phase==='report'?1:0),price,selected:0,points:0,handled:0,shift:null,lastReport:null,
  districts:[{id:0,openedDay:s.day+(s.phase==='report'?1:0),price:0,points:0,shifts:0,handled:0,shift:null,lastReport:null}]});
 s.operations.territory.current=0;s.operations.territory.transition=false;
}
export function vehicleAccess(s,model){
 const required={lift:90,tipper:140,crane:220}[model.kind]??0;
 return {required,unlocked:!enabled(s)||s.operations.career.earned>=required};
}
export const OBJECTIVES=[
 {id:'reliable',title:'Первая надёжная смена',detail:'Закройте все поступившие обращения без просрочек.',target:1,cash:25000,points:10,value:s=>s.operations.territory.streak},
 {id:'care',title:'Предупредить аварию',detail:'Проведите профилактику любой системы дома.',target:1,cash:12000,points:5,value:s=>s.operations.houses.some(h=>Object.values(h.prevention).some(n=>n>0))?1:0},
 {id:'operator',title:'На связи с жителями',detail:'Успешно завершите десять обращений.',target:10,cash:50000,points:15,value:s=>s.operations.completed},
 {id:'growth',title:'Район доверяет',detail:'Примите десять домов в одном районе.',target:10,cash:80000,points:20,value:s=>Math.max(...s.operations.career.areas.flatMap(a=>a.districts.map(d=>homes(s,a.region,d.id).length)))},
 {id:'network',title:'Районная сеть',detail:'Откройте три района в одной области.',target:3,cash:100000,points:25,value:s=>Math.max(...s.operations.career.areas.map(a=>a.districts.length))},
 {id:'region',title:'Новая область',detail:'Начните работу во второй области.',target:2,cash:150000,points:30,value:s=>s.operations.career.areas.length},
 {id:'all-areas',title:'Сеть областей',detail:'Откройте все двадцать областей и продолжайте развивать районы.',target:20,cash:500000,points:100,value:s=>s.operations.career.areas.length}
];
export function finishShift(s,log){
 const shift=s.operations.shift,t=s.operations.territory;
 const reliable=shift.results.length&&!s.calls.length&&shift.results.every(r=>r.success&&!r.late);
 t.streak=reliable?t.streak+1:0;record(s).shifts++;record(s).handled+=shift.results.filter(r=>r.success).length;
 let gained=0;const rewards=[];
 for(const goal of OBJECTIVES){
  if(t.achievements.some(a=>a.id===goal.id)||goal.value(s)<goal.target)continue;
  t.achievements.push({id:goal.id,day:s.day});log(s,goal.cash,'Цель: '+goal.title);gained+=goal.points;rewards.push(goal.id);
 }
 if(reliable&&t.streak%3===0)log(s,10000,'Три надёжные смены подряд');
 s.operations.career.earned+=gained;area(s).points+=gained;record(s).points+=gained;shift.points+=gained;
 return rewards;
}
export function scheduleKinds(s){
 const groups=[['lights','leak','outage','door','gutters','sewer','heating','entrance','delivery','roof'],
  ['heating','entrance','flood','lights','cable','roof','door','sewer','gutters','delivery'],
  ['door','gutters','pump','leak','delivery','outage','cable','heating','lights','sewer']];
 return groups[(s.day+current(s)+hash(s.seed,s.region)%3)%groups.length];
}
