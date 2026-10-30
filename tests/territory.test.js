import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import * as T from '../web/territory-progression.js';
import {SCENARIOS} from '../web/operations-content.js';
import {archiveSource} from '../web/company-storage.js';
const O=E.Operations;
const choices={lights:['scope','priority'],leak:['source','close'],flood:['network','branch'],door:['access','today'],sewer:['scope','notice'],entrance:['bypass','barrier'],outage:['residents','own'],roof:['history','cover'],pump:['scope','notice'],heating:['scope','local'],gutters:['access','clear'],delivery:['scope','barrier'],cable:['risk','barrier']};
export function talk(s,c){for(const choice of choices[c.kind])if(SCENARIOS[c.kind].dialogue[c.dialogue]?.options.some(v=>v.id===choice))E.answer(s,c.mission,choice);}
export function prepare(s){for(const v of s.vehicles)if((v.fuel<100||v.condition<100)&&!s.crews.some(cr=>cr.vehicle===v.id&&cr.status!=='idle'))E.maintain(s,v.id);for(let service=0;service<3;service++)if(s.stock[service]<30)E.procure(s,service);}
export function play(s,delay=0){
 prepare(s);E.start(s);
 for(let minute=0;minute<480&&s.phase==='active';minute++){
  for(const c of [...s.calls])if(s.clock-c.created>=delay){talk(s,c);for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);}
  E.tick(s);if(minute%120===0)E.decode(E.encode(s));
 }
 assert.equal(s.phase,'report');assert.equal(s.report.pending,0);assert.ok(s.report.results.every(r=>r.success&&!r.late));E.decode(E.encode(s));return s.report;
}
function duties(s,count,delay=0){for(let i=0;i<count;i++){if(s.phase==='report')E.nextDay(s);play(s,delay);}return s;}
function isolated(kind){const s=E.freshTerritoryCompany();E.start(s);s.calls=[];s.cursor=0;s.done=[];s.operations.shift.schedule=[];s.operations.shift.admitted=0;s.operations.planIndex=0;return {s,c:O.issue(s,kind,O.currentHouses(s)[0].id)};}

test('each area partitions its 999 real addresses into sixteen 60-home districts and one 39-home district',()=>{
 for(const seed of [0,1,112,2026])for(let region=0;region<20;region++){
  const list=T.districts(seed,region),ids=list.flatMap(d=>d.ids);
  assert.equal(list.length,17);assert.deepEqual(list.map(d=>d.capacity),[...Array(16).fill(60),39]);
  assert.equal(ids.length,999);assert.equal(new Set(ids).size,999);assert.ok(ids.every(id=>id>=0&&id<999));
  assert.deepEqual(list[0].ids.slice(0,3),[144,151,156]);
 }
});
test('the regional company starts with three contracts, a positive forecast and the original detailed fleet',()=>{
 const s=E.freshTerritoryCompany();assert.equal(s.version,9);assert.equal(O.currentHouses(s).length,3);
 assert.equal(O.Career.addressPool(s).length,60);assert.equal(T.contractLimit(s),3);assert.ok(O.Career.budget(s).estimatedNet>0);
 assert.deepEqual(s.vehicles.map(v=>v.model),['uaz39094-utility','gazelle-next-van','gazelle-business-flatbed']);
 assert.deepEqual(E.decode(E.encode(s)),s);
});
test('a reliable first duty pays its objective exactly once and visits all three starting homes',()=>{
 const s=E.freshTerritoryCompany(),opening=s.money,r=play(s);
 assert.equal(r.results.length,3);assert.equal(new Set(r.results.map(r=>r.home)).size,3);assert.equal(r.career.gained,38);
 assert.deepEqual(r.career.rewards,['reliable']);assert.equal(s.operations.shift.peak,1);assert.ok(s.money>opening);
 const points=s.operations.career.earned,money=s.money;E.tick(s,480);assert.equal(s.operations.career.earned,points);assert.equal(s.money,money);
 E.nextDay(s);play(s);assert.equal(s.ledger.filter(e=>e.label==='Цель: Первая надёжная смена').length,1);
});
test('local points reveal contracts in threes, and no address outside a 60-home district can be signed',()=>{
 const s=duties(E.freshTerritoryCompany(),1);E.nextDay(s);assert.equal(T.contractLimit(s),6);const points=T.balance(s);
 for(let i=0;i<3;i++)O.sign(s,O.candidates(s)[0].id,E.log);
 assert.equal(O.currentHouses(s).length,6);assert.equal(T.balance(s),points);assert.throws(()=>O.sign(s,O.candidates(s)[0].id,E.log));
 s.operations.career.earned=1000;T.area(s).points=1000;T.record(s).points=1000;s.money=20000000;
 while(O.currentHouses(s).length<60)O.sign(s,O.candidates(s)[0].id,E.log);
 assert.equal(O.candidates(s).length,0);assert.equal(T.contractLimit(s),60);assert.throws(()=>O.sign(s,T.districts(s.seed,0)[1].ids[0],E.log));
 assert.deepEqual(E.decode(E.encode(s)),s);
});
test('opening a district spends points once, preserves the old houses and really runs its dispatcher',()=>{
 const s=duties(E.freshTerritoryCompany(),2),before=structuredClone(s.operations.houses),balance=T.balance(s),cash=s.money;
 O.openDistrict(s,1,E.log);assert.equal(s.region,0);assert.equal(T.current(s),1);assert.equal(T.balance(s),balance-80);assert.equal(s.money,cash-90000);
 assert.equal(O.currentHouses(s).length,3);assert.deepEqual(s.operations.houses.slice(0,3),before);assert.equal(T.desks(s).length,1);
 const raw=E.encode(s);assert.throws(()=>O.openDistrict(s,1,E.log));assert.equal(E.encode(s),raw);
 play(s);const desk=T.desks(s)[0];assert.ok(desk.district.handled>0);assert.equal(desk.district.lastReport.completed,desk.district.lastReport.total);
 assert.equal(s.ledger.some(e=>e.label==='Обслуживание домов в прежних районах'),true);assert.deepEqual(E.decode(E.encode(s)),s);
});
test('switching manual control preserves district progress and cannot discard a live call',()=>{
 const s=duties(E.freshTerritoryCompany(),2);O.openDistrict(s,1,E.log);E.start(s);const raw=E.encode(s);
 assert.throws(()=>O.switchDistrict(s,0));assert.equal(E.encode(s),raw);
 for(let m=0;m<480;m++){for(const c of [...s.calls]){talk(s,c);for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);}E.tick(s);}
 const d=T.record(s);O.switchDistrict(s,0);assert.equal(s.operations.districtShifts,2);assert.equal(d.shifts,1);assert.equal(T.current(s),0);
 assert.equal(T.desks(s)[0].district.id,1);assert.deepEqual(E.decode(E.encode(s)),s);
});
test('a new area needs three developed districts and six duties as well as points',()=>{
 const s=E.freshTerritoryCompany();s.operations.career.earned=1000;T.area(s).points=1000;T.record(s).points=1000;
 const raw=E.encode(s);assert.throws(()=>E.nextDistrict(s));assert.equal(E.encode(s),raw);
 const playthrough=E.freshTerritoryCompany();let opened=false;
 for(let i=0;i<14&&!opened;i++){
  if(playthrough.phase==='report')E.nextDay(playthrough);
  if(T.expansion(playthrough).district&&T.area(playthrough).districts.length<3)O.openDistrict(playthrough,T.nextDistrict(playthrough).id,E.log);
  if(T.expansion(playthrough).area){const money=playthrough.money,points=T.balance(playthrough);E.nextDistrict(playthrough);assert.equal(T.balance(playthrough),points-300);assert.equal(playthrough.money,money+150000);opened=true;break;}
  play(playthrough,12);
 }
 assert.ok(opened);assert.equal(playthrough.region,1);assert.equal(O.currentHouses(playthrough).length,3);assert.equal(T.desks(playthrough).length,3);assert.equal(O.Career.addressPool(playthrough).length,60);
 play(playthrough);assert.ok(T.desks(playthrough).every(d=>d.district.shift.completed===d.district.shift.jobs.length));
 const count=playthrough.operations.houses.length,points=playthrough.operations.career.earned,cursor=playthrough.cursor;
 O.switchArea(playthrough,0);assert.equal(playthrough.region,0);assert.equal(T.unlocked(playthrough),1);assert.equal(T.current(playthrough),2);assert.equal(playthrough.operations.houses.length,count);assert.equal(playthrough.operations.career.earned,points);assert.equal(playthrough.cursor,cursor);assert.equal(T.expansion(playthrough).area,false);
 assert.deepEqual(E.decode(E.encode(playthrough)),playthrough);play(playthrough);
 O.switchArea(playthrough,1);assert.equal(T.current(playthrough),0);assert.deepEqual(E.decode(E.encode(playthrough)),playthrough);
});
test('new authored heating, gutter, steps and cable jobs finish through their real work dependencies',()=>{
 for(const kind of ['heating','gutters','delivery','cable']){
  const {s,c}=isolated(kind);talk(s,c);
  for(let minute=0;minute<220&&s.calls.length;minute++){
   for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);
   E.tick(s);if(minute%30===0)E.decode(E.encode(s));
  }
  assert.equal(s.calls.length,0,kind);assert.ok(s.operations.history[0].success,kind);assert.ok(c.work.every(w=>w.status==='done'));
 }
});
test('securing a worksite reduces harm while preserving the required electrical safety stages',()=>{
 for(const kind of ['gutters','delivery','cable']){
  const secured=isolated(kind),unsecured=isolated(kind);talk(secured.s,secured.c);
  E.tick(secured.s,20);E.tick(unsecured.s,20);assert.ok(secured.c.damage<unsecured.c.damage,kind);
  if(kind==='cable')assert.ok(O.definitions(secured.c).find(d=>d.id==='trench').requires.includes('isolate'));
 }
});
test('specialist purchases have real career gates, speed benefits and compatibility limits',()=>{
 const s=E.freshTerritoryCompany(),before=E.encode(s);assert.throws(()=>E.buy(s,'gazelle-next-aerial-lift'));assert.equal(E.encode(s),before);
 s.operations.career.earned=220;T.area(s).points=220;T.record(s).points=220;E.buy(s,'gazelle-next-aerial-lift');
 assert.equal(s.vehicles.at(-1).model,'gazelle-next-aerial-lift');
 const {s:work,c}=isolated('gutters'),cr=work.crews[2],v=work.vehicles.find(v=>v.id===cr.vehicle),d=O.definitions(c)[0];
 const regular=O.workTime(work,c,cr,d);v.model='gazelle-next-aerial-lift';assert.equal(E.reason(work,c,cr),'');assert.ok(O.workTime(work,c,cr,d)<regular);
 const other=O.issue(work,'door',O.currentHouses(work)[1].id);assert.match(E.reason(work,other,cr),/спецтехника/);
});
test('replacing a crew vehicle keeps its identity and kit, and rejects occupied staff or vehicles atomically',()=>{
 const s=E.freshTerritoryCompany(),cr=s.crews[0],id=cr.id,kit=O.kitFor(s,cr).id;
 E.buy(s,'gazelle-next-van');const replacement=s.vehicles.at(-1).id,old=cr.vehicle;
 E.reconfigureCrew(s,id,[...cr.members],replacement);assert.equal(cr.vehicle,replacement);assert.equal(cr.id,id);assert.equal(O.kitFor(s,cr).id,kit);assert.ok(!s.crews.some(c=>c.vehicle===old));
 const raw=E.encode(s);assert.throws(()=>E.reconfigureCrew(s,id,[...s.crews[1].members],cr.vehicle));assert.equal(E.encode(s),raw);assert.throws(()=>E.reconfigureCrew(s,id,[...cr.members],s.crews[1].vehicle));assert.equal(E.encode(s),raw);assert.deepEqual(E.decode(E.encode(s)),s);
});
test('prevention objectives and consecutive-shift bonuses are credited once per eligible result',()=>{
 const s=E.freshTerritoryCompany();O.prevent(s,O.currentHouses(s)[0].id,'water',E.log);play(s);assert.ok(s.report.career.rewards.includes('care'));
 duties(s,2);assert.equal(s.operations.territory.streak,3);assert.equal(s.ledger.filter(e=>e.label==='Цель: Предупредить аварию').length,1);assert.equal(s.ledger.filter(e=>e.label==='Три надёжные смены подряд').length,1);
});
test('v8 active routes and work survive the regional migration and its original file is archived atomically',()=>{
 const old=E.freshCompany();E.start(old);E.dispatch(old,old.calls[0].mission,1);E.tick(old,3);
 const raw=E.encode(old),up=E.upgradeTerritoryCompany(E.decode(raw));assert.equal(up.version,9);assert.equal(up.operations.territory.transition,true);
 assert.deepEqual(up.calls,old.calls);assert.deepEqual(up.crews,old.crews);assert.deepEqual(up.operations.houses,old.operations.houses);assert.equal(up.money,old.money);
 const data=new Map([[E.SAVE,raw]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,up);assert.equal(data.get(E.TERRITORY_ARCHIVE),raw);
 data.set(E.SAVE,raw);data.delete(E.TERRITORY_ARCHIVE);const broken={...storage,setItem:(k,v)=>{if(k===E.TERRITORY_ARCHIVE)throw Error('Full');data.set(k,v);}};
 assert.throws(()=>E.save(broken,up));assert.equal(data.get(E.SAVE),raw);assert.deepEqual(E.decode(E.encode(up)),up);
});
test('malformed district links, payments, objectives and desk jobs cannot replace a valid company',()=>{
 const s=E.freshTerritoryCompany(),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,s);const raw=data.get(E.SAVE);
 for(const mutate of [s=>s.operations.territory.current=16,s=>T.area(s).districts.push(structuredClone(T.record(s))),s=>s.operations.career.spent=1,s=>T.record(s).points=5,s=>s.operations.territory.achievements.push({id:'fake',day:1}),s=>s.operations.houses[0].id=998,s=>T.record(s).shifts=10]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>E.save(storage,bad));assert.equal(data.get(E.SAVE),raw);
 }
});
test('a large v8 portfolio can archive and migrate inside the browser quota without losing its original bytes',()=>{
 const old=E.freshCompany(),sample=structuredClone(old.operations.houses[0]);old.region=19;
 old.operations.houses=Array.from({length:20},(_,region)=>Array.from({length:99},(_,id)=>({...structuredClone(sample),region,id,history:Array.from({length:12},()=>({day:1,text:'Районный диспетчер: протечка устранена, подача воды восстановлена. Доступ в подвал проверен.'}))}))).flat();
 old.operations.career.earned=20000;old.operations.career.spent=7030;old.operations.career.areas=Array.from({length:20},(_,region)=>({region,openedDay:1,points:1000,handled:0,shift:null,lastReport:null}));
 for(const cr of old.crews)cr.point=O.parkingPosition(old,cr.id);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{const next=new Map(data);next.set(k,v);if([...next.values()].reduce((n,t)=>n+2*t.length,0)>5000000)throw Error('Quota exceeded');data.set(k,v);}};
 E.save(storage,old);E.save(storage,old);const source=data.get(E.SAVE),up=E.upgradeTerritoryCompany(E.decode(source));E.save(storage,up);
 assert.equal(archiveSource(data.get(E.TERRITORY_ARCHIVE)),source);assert.deepEqual(E.load(storage).state,up);
});
test('first three duties remain bounded and solvent with a twelve-minute human reaction delay',()=>{
 for(const seed of [0,1,7,99,112,808]){
  const s=duties(E.freshTerritoryCompany(seed),3,12);assert.ok(s.money>3000000);assert.ok(s.operations.shift.peak<=O.Career.shiftRules(s).concurrent);
 }
});
test('a full 20-area company survives lossless local compression, backup and portable JSON export',()=>{
 const s=E.freshTerritoryCompany(),sample=structuredClone(s.operations.houses[0]);s.region=19;
 s.operations.houses=Array.from({length:20},(_,region)=>Array.from({length:999},(_,id)=>({...structuredClone(sample),region,id,history:Array.from({length:12},(_,i)=>({day:1,text:'Районный диспетчер: протечка устранена, подача воды восстановлена. Запись '+i+'.'}))}))).flat();
 s.operations.career.earned=200000;s.operations.career.spent=0;s.operations.territory.legacySpent=0;
 s.operations.career.areas=Array.from({length:20},(_,region)=>({region,openedDay:1,price:0,points:10000,handled:0,shift:null,lastReport:null,districts:Array.from({length:17},(_,id)=>({id,openedDay:1,price:0,points:500,shifts:0,handled:0,shift:null,lastReport:null}))}));
 for(const cr of s.crews)cr.point=O.parkingPosition(s,cr.id);
 const raw=E.encode(s);assert.ok(Buffer.byteLength(raw,'utf8')<64000000);assert.deepEqual(E.decode(raw),s);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,s);E.save(storage,s);
 assert.ok(data.get(E.SAVE).startsWith('UD9L1:'));assert.ok(2*(data.get(E.SAVE).length+data.get(E.BACKUP).length)<5000000);
 assert.deepEqual(E.load(storage).state,s);data.set(E.SAVE,'UD9L1:broken');assert.equal(E.load(storage).recovered,true);assert.deepEqual(E.load(storage).state,s);
});
