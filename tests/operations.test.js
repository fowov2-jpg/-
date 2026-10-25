import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {SCENARIOS} from '../web/operations-content.js';
import {district,roadStop} from '../web/campaign-city.js';
const O=E.Operations;
const freshV7=seed=>E.freshCompany(seed,{gradual:false});

function incident(kind='flood'){
  const s=freshV7(112);E.start(s);
  s.calls=[];s.cursor=0;s.done=[];s.operations.planIndex=8;
  const c=O.issue(s,kind,s.operations.houses[1].id);
  return {s,c};
}
function answer(s,c,first,last){E.answer(s,c.mission,first);E.answer(s,c.mission,last);}
function dispatchAvailable(s){for(const c of [...s.calls])for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);}
function run(s,minutes=480){for(let i=0;i<minutes&&s.phase==='active';i++){dispatchAvailable(s);E.tick(s);E.decode(E.encode(s));}}
function until(s,predicate,limit=300){for(let i=0;i<limit&&!predicate();i++)E.tick(s);assert.ok(predicate(),'condition reached within '+limit+' minutes');}

test('updated company keeps original assets and opens a paced authored shift',()=>{
 const s=freshV7();assert.equal(s.money,3000000);assert.equal(s.crews.length,3);assert.equal(s.vehicles.length,3);assert.equal(s.employees.length,6);assert.equal(s.operations.houses.length,3);
 E.start(s);assert.equal(s.calls.length,1);assert.equal(s.calls[0].kind,'lights');assert.equal(s.version,7);
 assert.deepEqual(E.decode(E.encode(s)),s);assert.ok(s.shift.income>0,'contracts pay actual income');
 E.tick(s,29);assert.equal(s.calls.length,1);E.tick(s);assert.equal(s.calls.length,2);
});

test('three services share one flood, wait for dependencies and restore both systems',()=>{
 const {s,c}=incident();answer(s,c,'risk','local');
 for(const cr of s.crews)E.dispatch(s,c.mission,cr.id);
 assert.equal(c.assignments.length,3);assert.equal(new Set(s.crews.map(cr=>cr.job)).size,1);
 until(s,()=>c.assignments.some(a=>a.service===2&&a.status==='waiting'));
 assert.equal(c.work.find(w=>w.id==='drain').status,'pending');
 assert.ok(O.waitingFor(c,2).length>0);
 let observedWait=false;
 while(s.calls.includes(c)){
  E.tick(s);E.decode(E.encode(s));
  if(c.work.find(w=>w.id==='drain').status==='working'){
    assert.equal(c.work.find(w=>w.id==='isolate').status,'done');assert.equal(c.work.find(w=>w.id==='stop').status,'done');
    observedWait=true;
  }
 }
 assert.ok(observedWait);assert.equal(s.operations.completed,1);assert.equal(s.operations.districtMajor,1);
 assert.ok(s.crews.every(cr=>['idle','returning'].includes(cr.status)));
 assert.ok(s.operations.houses.every(h=>!h.outages.water&&!h.outages.electric));
 const reward=s.money;E.tick(s,10);assert.equal(s.money,reward,'completion pays only once');
});

test('branch shutdown prevents damage but cuts three homes and affects trust and money',()=>{
 const a=incident(),b=incident();answer(a.s,a.c,'network','branch');answer(b.s,b.c,'risk','local');
 E.tick(a.s,55);E.tick(b.s,55);
 assert.equal(a.c.damage,0);assert.ok(b.c.damage>15);
 assert.equal(a.s.operations.houses.filter(h=>h.outages.water).length,3);
 assert.equal(b.s.operations.houses.filter(h=>h.outages.water).length,0);
 assert.ok(a.s.operations.houses[0].trust<b.s.operations.houses[0].trust,'neighbouring homes react to shutdown');
 run(a.s);run(b.s);
 assert.ok(a.s.report.waterMinutes>b.s.report.waterMinutes);
 assert.ok(a.s.report.compensation>b.s.report.compensation);
 assert.ok(a.s.report.damage<b.s.report.damage);
 assert.ok(a.s.report.decisions.some(d=>d.text.includes('ветки')));
});

test('an unattended flood develops an extra cleanup dependency and reserves its materials safely',()=>{
 const {s,c}=incident();E.tick(s,80);assert.ok(c.flags.escalated);
 assert.ok(O.definitions(c).find(w=>w.id==='pipe').requires.includes('cleanup'));
 for(const cr of s.crews)E.dispatch(s,c.mission,cr.id);
 const before=s.stock[2];
 until(s,()=>!s.calls.includes(c));
 assert.equal(s.stock[2],before-4,'drain and extra cleanup both consume their materials');
 assert.doesNotThrow(()=>E.decode(E.encode(s)));
});

test('withdrawing a waiting crew frees its load without duplicating consumed materials',()=>{
 const {s,c}=incident();E.dispatch(s,c.mission,2);const initial=s.stock[2];
 until(s,()=>s.crews[2].status==='waiting');assert.equal(O.availableStock(s,2),initial-2);
 O.withdraw(s,c.mission,2);assert.equal(O.availableStock(s,2),initial);assert.equal(s.stock[2],initial);
 assert.throws(()=>O.withdraw(s,c.mission,2));
 until(s,()=>s.crews[2].status==='idle');
 run(s,200);assert.equal(s.operations.completed,1);assert.equal(s.stock[2],initial-2);
});

test('invalid double assignments and insufficient fuel leave all resources unchanged',()=>{
 const {s,c}=incident();s.vehicles[0].fuel=0;let before=E.encode(s);assert.throws(()=>E.dispatch(s,c.mission,0));assert.equal(E.encode(s),before);
 s.vehicles[0].fuel=100;E.dispatch(s,c.mission,0);before=E.encode(s);assert.throws(()=>E.dispatch(s,c.mission,0));assert.equal(E.encode(s),before);
 assert.doesNotThrow(()=>E.decode(E.encode(s)));
});

test('a roof decision changes the restoration plan; cover consumes time and supplies once',()=>{
 const {s,c}=incident('roof');answer(s,c,'history','cover');
 assert.equal(c.work.length,2);assert.deepEqual(O.definitions(c).find(d=>d.id==='roof').requires,['cover']);
 const stock=s.stock[2];E.dispatch(s,c.mission,2);until(s,()=>!s.calls.includes(c));
 assert.equal(s.stock[2],stock-5);assert.equal(s.operations.completed,1);
 assert.throws(()=>E.answer(s,c.mission,'cover'));
});

test('equipment changes real stage duration with a cost and a specialization tradeoff',()=>{
 const s=freshV7(),c={kind:'flood',flags:{}},cr=s.crews[2],defs=O.definitions(c);
 const standardDrain=O.workTime(s,c,cr,defs.find(d=>d.id==='drain'));
 const roof={kind:'roof',flags:{}},standardRoof=O.workTime(s,roof,cr,O.definitions(roof)[0]);
 const before=s.money;O.equip(s,2,'repair-pump',E.log);assert.equal(s.money,before-36000);
 assert.ok(O.workTime(s,c,cr,defs.find(d=>d.id==='drain'))<standardDrain);
 assert.ok(O.workTime(s,roof,cr,O.definitions(roof)[0])>standardRoof);
 O.equip(s,2,'repair-standard',E.log);O.equip(s,2,'repair-pump',E.log);assert.equal(s.money,before-36000,'owned equipment is reusable');
});

test('weather and congestion change actual travel and the displayed estimate matches dispatch',()=>{
 const {s,c}=incident('leak'),cr=s.crews[0],destination=roadStop(district(s.seed,s.region).homes[c.home]);
 s.operations.weather=1;s.minute=150;const dry=O.travelEstimate(s,cr,destination);
 s.operations.weather=2;s.minute=0;const coldRush=O.travelEstimate(s,cr,destination);
 assert.ok(coldRush.minutes>dry.minutes);assert.ok(coldRush.traffic>0);
 E.dispatch(s,c.mission,cr.id);assert.equal(c.assignments[0].total,coldRush.minutes);
});

test('contract income, house wear, prevention and a new contract persist across days',()=>{
 const s=freshV7(),h=s.operations.houses[0],initial=h.water;
 O.prevent(s,h.id,'water',E.log);assert.equal(h.water,initial+20);assert.equal(h.prevention.water,3);
 assert.throws(()=>O.prevent(s,h.id,'water',E.log));
 E.start(s);run(s);const money=s.money,wear=h.water;
 E.nextDay(s);assert.equal(h.water,wear,'protected system does not wear overnight');
 const candidate=O.candidates(s)[0];O.sign(s,candidate.id,E.log);assert.equal(s.operations.houses.length,4);assert.equal(s.money,money-candidate.fee);
 assert.throws(()=>O.sign(s,candidate.id,E.log));assert.deepEqual(E.decode(E.encode(s)),s);
 const before=s.money;E.start(s);assert.equal(s.money-before,s.operations.houses.reduce((sum,h)=>sum+h.rate,0));
});

test('planned calls carry over by agreement and resume without an overnight overdue penalty',()=>{
 const {s,c}=incident('door');answer(s,c,'access','planned');E.tick(s,480);
 assert.equal(c.late,false);assert.equal(s.report.pending,1);assert.equal(c.damage,0);
 E.nextDay(s);assert.equal(c.deferred,false);assert.equal(c.due,SCENARIOS.door.deadline);
 E.start(s);run(s);assert.ok(s.operations.history.some(h=>h.id===c.mission&&h.success));
});

test('external contractor costs once, finishes asynchronously and can be saved mid-response',()=>{
 const {s,c}=incident('outage');const money=s.money;answer(s,c,'residents','external');assert.equal(s.money,money-18000);
 assert.throws(()=>E.answer(s,c.mission,'external'));E.tick(s,20);assert.deepEqual(E.decode(E.encode(s)),s);
 E.tick(s,14);assert.equal(s.calls.length,0);assert.equal(s.operations.history[0].external,true);
});

test('three successful shifts and four contracts unlock growth without a 999-job grind',()=>{
 const s=freshV7();assert.throws(()=>E.nextDistrict(s));
 for(let day=1;day<=3;day++){
   if(day>1){E.nextDay(s);for(const v of s.vehicles)if(v.fuel<100||v.condition<100)E.maintain(s,v.id);for(let service=0;service<3;service++)if(s.stock[service]<25)E.procure(s,service);}
   if(day===2)O.sign(s,O.candidates(s)[0].id,E.log);
   E.start(s);run(s);assert.equal(s.phase,'report');
 }
 assert.ok(O.canExpand(s));assert.ok(s.done.length<30);const history=s.operations.houses.length;
 E.nextDistrict(s);assert.equal(s.region,1);assert.equal(s.operations.houses.length,history+3);assert.equal(s.operations.districtShifts,0);assert.equal(s.cursor,0);
 assert.deepEqual(E.decode(E.encode(s)),s);
});

test('v7 recovery rejects broken task dependencies, reservations and crew links atomically',()=>{
 const {s,c}=incident();for(const cr of s.crews)E.dispatch(s,c.mission,cr.id);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,s);
 const original=data.get(E.SAVE);
 const mutations=[
  x=>x.calls[0].assignments[0].reserved=100,
  x=>x.calls[0].work.find(w=>w.id==='drain').status='done',
  x=>x.crews[0].job=999,
  x=>x.calls[0].home=998,
  x=>x.operations.houses.push(structuredClone(x.operations.houses[0])),
  x=>x.operations.weather=99,
  x=>x.phase='report'
 ];
 for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);assert.throws(()=>E.save(storage,bad));assert.equal(data.get(E.SAVE),original);}
 data.set(E.SAVE,'broken');assert.equal(E.load(storage).recovered,true);assert.equal(E.load(storage).state.version,8);
});

test('switching from v6 archives the exact company; archive write failure preserves the active save',()=>{
 const previous=E.fresh(99),next=freshV7(112),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 E.save(storage,previous);const raw=data.get(E.SAVE);E.save(storage,next);
 assert.equal(data.get(E.OPERATION_ARCHIVE),raw);assert.equal(E.load(storage).state.version,8);
 data.clear();E.save(storage,previous);
 const full={getItem:storage.getItem,setItem(k,v){if(k===E.OPERATION_ARCHIVE)throw Error('Disk full');storage.setItem(k,v);}};
 assert.throws(()=>E.save(full,next),/Disk full/);assert.equal(data.get(E.SAVE),raw);
 data.clear();data.set(E.SAVE,'broken primary');data.set(E.BACKUP,raw);
 assert.equal(E.load(storage).recovered,true);E.save(storage,next);
 assert.equal(data.get(E.OPERATION_ARCHIVE),raw,'the only valid recovered v6 company is archived before the backup is replaced');
 assert.equal(data.get(E.BACKUP),raw);assert.equal(E.load(storage).state.version,8);
});
