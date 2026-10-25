import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {SCENARIOS} from '../web/operations-content.js';
const O=E.Operations,C=O.Career;
const choices={lights:['scope','priority'],leak:['source','close'],flood:['network','branch'],door:['access','today'],sewer:['scope','notice'],entrance:['bypass','barrier'],outage:['residents','own'],roof:['history','cover'],pump:['scope','notice']};
function talk(s,c){for(const choice of choices[c.kind])if(SCENARIOS[c.kind].dialogue[c.dialogue]?.options.some(v=>v.id===choice))E.answer(s,c.mission,choice);}
function prepare(s){for(const v of s.vehicles)if((v.fuel<100||v.condition<100)&&!s.crews.some(cr=>cr.vehicle===v.id&&cr.status!=='idle'))E.maintain(s,v.id);for(let service=0;service<3;service++)if(s.stock[service]<20)E.procure(s,service);}
function play(s){prepare(s);E.start(s);for(let minute=0;minute<480&&s.phase==='active';minute++){for(const c of [...s.calls]){talk(s,c);for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);}E.tick(s);if(minute%60===0)E.decode(E.encode(s));}return s.report;}
function advance(s,days){for(let i=0;i<days;i++){if(s.phase==='report')E.nextDay(s);play(s);}return s;}
function isolated(kind='lights'){
 const s=E.freshCompany();E.start(s);s.calls=[];s.cursor=0;s.done=[];s.operations.shift.schedule=[];s.operations.shift.admitted=0;s.operations.planIndex=0;
 const c=O.issue(s,kind,s.operations.houses[0].id);return {s,c};
}
function unlock(s){s.operations.career.earned=60;C.currentArea(s).points=60;C.setAssistant(s,true);}

test('career opens two contracts, 99 unique addresses and a three-call first duty',()=>{
 const s=E.freshCompany();assert.equal(s.version,8);assert.equal(s.operations.houses.length,2);assert.equal(C.addressPool(s).length,99);assert.equal(new Set(C.addressPool(s)).size,99);assert.equal(C.points(s),0);
 const b=C.budget(s);assert.equal(b.quota,3);assert.equal(b.concurrent,1);assert.ok(b.estimatedNet>0);assert.equal(C.contractLimit(s),2);
 assert.deepEqual(E.decode(E.encode(s)),s);E.start(s);assert.equal(s.calls.length,1);assert.equal(s.calls[0].channel,'phone');assert.equal(s.operations.shift.schedule.length,3);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('a normal first duty finishes every call without loss, and pays career points once',()=>{
 const s=E.freshCompany(),opening=s.money;const r=play(s);
 assert.equal(s.phase,'report');assert.equal(r.results.length,3);assert.ok(r.results.every(v=>v.success&&!v.late));assert.equal(r.pending,0);assert.equal(s.operations.shift.peak,1);assert.ok(s.money>opening);assert.equal(r.career.gained,28);assert.equal(C.points(s),28);
 const earned=s.operations.career.earned;E.tick(s,480);assert.equal(s.operations.career.earned,earned);assert.throws(()=>E.start(s));
});

test('ignoring calls cannot cause a first-duty avalanche or an automatic opening debt',()=>{
 const s=E.freshCompany();E.start(s);let max=0;
 for(let m=0;m<480;m++){E.tick(s);max=Math.max(max,s.calls.length);E.decode(E.encode(s));}
 assert.equal(max,1);assert.ok(s.operations.shift.admitted<=3);assert.ok(s.money>2800000);assert.equal(s.report.career.gained,0);
 assert.equal(s.report.results.length+s.report.pending,s.operations.shift.admitted);
});

test('delayed admission gets its own deadline and cannot produce a burst after a blocked call',()=>{
 const s=E.freshCompany();E.start(s);E.tick(s,155);const first=s.calls[0];talk(s,first);E.dispatch(s,first.mission,1);
 for(let i=0;i<120&&!s.calls.some(c=>c.kind==='leak');i++)E.tick(s);
 const next=s.calls.find(c=>c.kind==='leak');assert.ok(next);assert.ok(next.created>120);assert.equal(next.due-s.minute,SCENARIOS.leak.deadline);assert.equal(s.calls.length,1);
 assert.ok(s.operations.shift.nextAdmission>=s.minute+70);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('a linked emergency holds new routine arrivals while its services are occupied',()=>{
 const {s,c}=isolated('flood');s.day=3;s.shift.day=3;s.operations.shift.schedule=[{minute:1,kind:'lights',home:1,channel:'report'}];
 E.tick(s,60);assert.equal(s.calls.length,1);assert.equal(s.calls[0],c);assert.equal(s.operations.planIndex,0);
 assert.deepEqual(E.decode(E.encode(s)),s);
});

test('the assistant unlocks through earned points, and does not take phone calls',()=>{
 const s=E.freshCompany();assert.throws(()=>C.setAssistant(s,true));advance(s,2);assert.ok(C.assistantUnlocked(s));assert.ok(C.points(s)>=60);
 E.nextDay(s);C.setAssistant(s,true);E.start(s);const call=s.calls[0];E.tick(s,12);assert.equal(call.channel,'phone');assert.equal(call.assignments.length,0);assert.equal(s.operations.career.assistant.assigned,0);
});

test('the assistant really answers and dispatches a report, and persists its active job',()=>{
 const {s,c}=isolated();unlock(s);E.tick(s,5);assert.equal(c.assignments.length,0);E.tick(s);
 assert.equal(c.dialogue,'done');assert.equal(c.assistant,true);assert.equal(c.assignments[0].crew,1);assert.equal(s.operations.career.assistant.assigned,1);
 const restored=E.decode(E.encode(s));E.tick(restored,100);
 assert.equal(restored.operations.career.assistant.completed,1);assert.equal(restored.operations.completed,1);assert.equal(restored.calls.length,0);assert.equal(restored.operations.career.earned,66);
});

test('manual report control, reserved crews and helper disable prevent automatic dispatch',()=>{
 const {s,c}=isolated();unlock(s);c.manual=true;E.tick(s,7);assert.equal(c.assignments.length,0);
 c.manual=false;C.reserveCrew(s,1);E.tick(s,7);assert.equal(c.assignments.length,0);
 C.reserveCrew(s,1);C.setAssistant(s,false);E.tick(s,7);assert.equal(c.assignments.length,0);
 C.setAssistant(s,true);E.tick(s);assert.equal(c.assignments.length,1);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('the helper never sends a crew to a multi-service emergency or hires a contractor',()=>{
 const {s,c}=isolated('flood');unlock(s);c.channel='report';const before=s.money;E.tick(s,20);
 assert.equal(c.assignments.length,0);assert.equal(c.answers.length,0);assert.equal(s.money,before);
});

test('contracts open in pairs through local points without spending the district point bank',()=>{
 const s=advance(E.freshCompany(),1);E.nextDay(s);assert.equal(C.contractLimit(s),4);const points=C.points(s);
 for(let i=0;i<2;i++)O.sign(s,O.candidates(s)[0].id,E.log);
 assert.equal(s.operations.houses.length,4);assert.equal(C.points(s),points);const money=s.money;
 assert.throws(()=>O.sign(s,O.candidates(s)[0].id,E.log));assert.equal(s.money,money);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('a district licence has exactly 99 contracts and cannot leak the other 900 addresses',()=>{
 const s=E.freshCompany();s.day=2;s.operations.districtShifts=1;s.money=20000000;s.operations.career.earned=1000;C.currentArea(s).points=1000;
 while(O.currentHouses(s).length<99)O.sign(s,O.candidates(s)[0].id,E.log);
 assert.equal(C.addressPool(s).length,99);assert.equal(O.candidates(s).length,0);assert.equal(C.contractLimit(s),99);assert.throws(()=>O.sign(s,998,E.log));assert.deepEqual(E.decode(E.encode(s)),s);
 const rules=C.shiftRules(s);assert.ok(rules.quota<=10);assert.ok(rules.concurrent<=3);
});

test('career points buy a second district and give the previous district its own dispatcher',()=>{
 const s=advance(E.freshCompany(),3);assert.ok(O.canExpand(s));const before=C.points(s),earned=s.operations.career.earned,history=structuredClone(s.operations.houses);
 E.nextDistrict(s);assert.equal(s.region,1);assert.equal(C.points(s),before-100);assert.equal(s.operations.career.earned,earned);assert.equal(C.currentArea(s).points,0);assert.equal(O.currentHouses(s).length,2);assert.equal(s.operations.career.areas.length,2);
 assert.deepEqual(s.operations.houses.filter(h=>h.region===0),history);assert.equal(C.addressPool(s,1).length,99);assert.equal(O.canExpand(s),false);
 play(s);const desk=s.operations.career.areas[0];assert.ok(desk.handled>0);assert.equal(desk.lastReport.completed,desk.lastReport.total);assert.equal(desk.shift.jobs.every(j=>j.status==='done'),true);assert.equal(s.operations.career.assistant.assigned,0);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('expansion cannot spend points twice and cannot discard pending work',()=>{
 const s=advance(E.freshCompany(),3);E.nextDistrict(s);const raw=E.encode(s);assert.throws(()=>E.nextDistrict(s));assert.equal(E.encode(s),raw);
 const blocked=advance(E.freshCompany(),3);E.nextDay(blocked);E.start(blocked);assert.ok(blocked.calls.length);assert.equal(O.canExpand(blocked),false);assert.throws(()=>E.nextDistrict(blocked));
});

test('mandatory budget costs can block an insolvent new duty before changing any state',()=>{
 const s=E.freshCompany();for(let i=0;i<8;i++)E.hire(s,0);s.money=0;
 // Two contracts still cover a modest team, so exercise a genuinely insolvent roster.
 s.employees.forEach(p=>p.level=5);for(let i=0;i<6;i++)s.vehicles.push({id:s.nextVehicle++,model:[...E.VEHICLE_MODELS].sort((a,b)=>b.upkeep-a.upkeep)[0].id,fuel:100,condition:100});
 assert.ok(C.budget(s).minimumClosing<0);const raw=E.encode(s);assert.throws(()=>E.start(s));assert.equal(E.encode(s),raw);
});

test('v7 work upgrades intact and the exact original is archived before v8 replaces it',()=>{
 const old=E.freshCompany(112,{gradual:false});E.start(old);old.calls=[];old.cursor=0;old.operations.planIndex=8;const c=O.issue(old,'flood',old.operations.houses[1].id);for(const cr of old.crews)E.dispatch(old,c.mission,cr.id);E.tick(old,23);
 const raw=E.encode(old),up=E.upgradeCompany(E.decode(raw));assert.equal(up.version,8);assert.deepEqual(up.calls[0].assignments,old.calls[0].assignments);assert.deepEqual(up.calls[0].work,old.calls[0].work);assert.deepEqual(up.operations.houses,old.operations.houses);assert.equal(up.clock,old.clock);
 const data=new Map([[E.SAVE,raw]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,up);assert.equal(data.get(E.PROGRESSION_ARCHIVE),raw);assert.equal(E.load(storage).state.version,8);
 data.set(E.SAVE,raw);data.delete(E.PROGRESSION_ARCHIVE);const broken={...storage,setItem:(k,v)=>{if(k===E.PROGRESSION_ARCHIVE)throw Error('Disk full');data.set(k,v);}};assert.throws(()=>E.save(broken,up));assert.equal(data.get(E.SAVE),raw);
 assert.deepEqual(E.decode(E.encode(up)),up);
});

test('invalid career balances, desk links, quota and helper state are rejected atomically',()=>{
 const s=E.freshCompany();E.start(s);const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,s);const raw=data.get(E.SAVE);
 for(const mutate of [x=>x.operations.career.spent=1,x=>x.operations.career.earned=-1,x=>x.operations.career.areas.push(structuredClone(x.operations.career.areas[0])),x=>x.operations.career.assistant.enabled=true,x=>x.operations.shift.admitted=4,x=>x.calls[0].channel='unknown']){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>E.save(storage,bad));assert.equal(data.get(E.SAVE),raw);
 }
});

test('different starting cities stay solvent for three duties with a human reaction margin',()=>{
 for(const seed of [0,1,7,99,112,808]){
  const s=E.freshCompany(seed);
  for(let day=0;day<3;day++){
   if(s.phase==='report')E.nextDay(s);prepare(s);E.start(s);
   for(let minute=0;minute<480;minute++){
    for(const c of [...s.calls])if(s.clock-c.created>=12){talk(s,c);for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);}
    E.tick(s);
   }
   assert.equal(s.phase,'report','seed '+seed);assert.equal(s.report.pending,0);assert.ok(s.report.results.every(r=>r.success&&!r.late));assert.ok(s.money>2900000);assert.ok(s.operations.shift.peak<=C.shiftRules(s).concurrent);E.decode(E.encode(s));
  }
 }
});

test('closed intake leaves unseen calls outside results and penalties',()=>{
 const {s}=isolated();s.operations.shift.schedule=[{minute:370,kind:'outage',home:1,channel:'phone'}];
 s.operations.shift.nextAdmission=480;
 E.tick(s,480);assert.equal(s.operations.shift.admitted,0);assert.equal(s.operations.planIndex,0);
 assert.equal(s.report.results.some(r=>r.kind==='outage'),false);assert.ok(s.report.damage<38000);assert.deepEqual(E.decode(E.encode(s)),s);
});

test('the assistant is charged once after use even if switched off before the report',()=>{
 const s=E.freshCompany();unlock(s);E.start(s);C.setAssistant(s,false);
 assert.equal(C.budget(s).dispatcher,2500);E.tick(s,480);
 assert.equal(s.ledger.filter(r=>r.label==='Работа помощника диспетчера').length,1);
 E.nextDay(s);assert.equal(C.budget(s).dispatcher,0);
});

test('importing v7 over v8 archives the imported original and preserves the prior v8 backup',()=>{
 const old=E.freshCompany(77,{gradual:false}),raw=E.encode(old),next=E.upgradeCompany(E.decode(raw));
 const previous=E.freshCompany(99),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 E.save(storage,previous);const backup=data.get(E.SAVE);E.save(storage,next,raw);
 assert.equal(data.get(E.PROGRESSION_ARCHIVE),raw);assert.equal(data.get(E.BACKUP),backup);
 assert.equal(E.load(storage).state.seed,77);
});

test('the full 20 by 99 house company with normal histories fits the native document limit',()=>{
 const s=E.freshCompany(),sample=structuredClone(s.operations.houses[0]);s.region=19;
 s.operations.houses=Array.from({length:20},(_,region)=>Array.from({length:99},(_,id)=>({...structuredClone(sample),region,id,history:Array.from({length:12},()=>({day:1,text:'Районный диспетчер: протечка устранена, подача воды восстановлена. Доступ в подвал проверен.'}))}))).flat();
 s.operations.career.earned=20000;s.operations.career.spent=Array.from({length:19},(_,i)=>100+30*i).reduce((n,v)=>n+v,0);
 s.operations.career.areas=Array.from({length:20},(_,region)=>({region,openedDay:1,points:1000,handled:0,shift:null,lastReport:null}));
 s.operations.houses[0].custom={note:'Сохранить дополнительное поле'};s.operations.houses[0].history[0].custom=42;
 const raw=E.encode(s);assert.ok(Buffer.byteLength(raw,'utf8')<8000000);assert.deepEqual(E.decode(raw),s);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 E.save(storage,s);E.save(storage,s);const packed=data.get(E.SAVE);assert.ok(packed.startsWith('UD8P1:'));assert.ok((packed.length+data.get(E.BACKUP).length)*2<5000000);assert.deepEqual(E.load(storage).state,s);
 data.set(E.SAVE,'UD8P1:broken');assert.equal(E.load(storage).recovered,true);assert.deepEqual(E.load(storage).state,s);
});
