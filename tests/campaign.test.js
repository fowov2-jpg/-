import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {district,missions,missionOrder,districtOrigin,parkingBay,roadStop,streetRoute,DW,DH} from '../web/campaign-city.js';

test('20 deterministic districts contain 19,980 unique address IDs and prepared assignments',()=>{
 const ids=new Set(),signatures=new Set(),layouts=new Set();
 for(let d=0;d<20;d++){
  const city=district(112,d),list=missions(112,d),order=missionOrder(112,d),origin=districtOrigin(d);
  assert.equal(city.homes.length,999);assert.equal(list.length,999);assert.equal(new Set(order).size,999);
  assert.equal(new Set(city.homes.map(h=>h.name)).size,999);assert.equal(new Set(city.homes.map(h=>h.x+':'+h.y)).size,999);
  assert.equal(new Set(list.map(m=>m.brief)).size,999);
  for(const [i,h] of city.homes.entries()){
   assert.ok(h.x>origin[0]&&h.x<origin[0]+DW&&h.y>origin[1]&&h.y<origin[1]+DH);assert.equal(list[i].home,h.id);
   ids.add(h.globalId);signatures.add(list[i].id);assert.ok(list[i].brief.includes('Место:')&&list[i].brief.includes('Объём')&&list[i].answer.includes('Контроль результата:'));
  }
  layouts.add(city.tiles.join(','));assert.deepEqual(missions(112,d),list);
 }
 assert.equal(ids.size,19980);assert.equal(signatures.size,19980);assert.equal(layouts.size,20);
 assert.notDeepEqual(district(113,0).tiles,district(112,0).tiles);
});
test('Every address has an axis-aligned street route, including between adjacent districts',()=>{
 for(let d=0;d<20;d++){
  const city=district(112,d),start=roadStop(city.homes[0]);
  for(const home of city.homes){const end=roadStop(home),path=streetRoute(start,end);assert.deepEqual(path[0],start);assert.deepEqual(path.at(-1),end);for(let i=1;i<path.length;i++)assert.ok(path[i][0]===path[i-1][0]||path[i][1]===path[i-1][1]);}
  if(d){const a=districtOrigin(d-1),b=districtOrigin(d);assert.ok(Math.abs(a[0]-b[0])===DW&&a[1]===b[1]||Math.abs(a[1]-b[1])===DH&&a[0]===b[0]);}
 }
});
test('Issued jobs never duplicate; only finishing the 999th job unlocks the next district',()=>{
 const s=E.fresh();assert.throws(()=>E.nextDistrict(s),/999/);
 E.start(s);assert.equal(s.calls.length,3);assert.equal(new Set(s.calls.map(c=>c.mission)).size,3);
 assert.deepEqual(E.decode(E.encode(s)),s);
 for(let d=0;d<20;d++){
  const order=missionOrder(s.seed,s.region),id=order.at(-1),m=E.catalog(s)[id],cr=s.crews.find(c=>c.service===m.service);
  s.cursor=999;s.done=order.slice(0,-1);s.phase='active';s.minute=0;
  s.calls=[{mission:id,status:'repair',crew:cr.id,due:80,late:false,asked:true,contained:false,remaining:1,total:1,path:[cr.point]}];cr.status='repair';cr.job=id;
  assert.throws(()=>E.nextDistrict(s),/999/);assert.doesNotThrow(()=>E.decode(E.encode(s)));
  E.tick(s);assert.equal(s.done.length,999);assert.equal(s.calls.length,0);assert.equal(cr.status,'returning');assert.ok(cr.returnTrip.remaining>0);assert.doesNotThrow(()=>E.decode(E.encode(s)));
  if(d<19){assert.equal(s.phase,'cleared');E.nextDistrict(s);assert.equal(s.region,d+1);assert.equal(s.done.length,0);assert.equal(s.cursor,0);assert.deepEqual(s.crews[0].point,parkingBay(s.seed,s.region,s.crews[0].id));}
  else{assert.equal(s.phase,'won');assert.throws(()=>E.nextDistrict(s));}
 }
});
test('Real dispatch consumes supplies, follows travel, diagnosis, repair, and pays exactly once',()=>{
 const s=E.fresh();E.start(s);const c=s.calls[0],m=E.task(s,c),cr=s.crews.find(c=>c.service===m.service),before=s.money,stock=s.stock[m.service];
 E.dispatch(s,c.mission,cr.id);assert.equal(s.stock[m.service],stock-m.quantity);assert.throws(()=>E.dispatch(s,c.mission,cr.id));
 E.question(s,c.mission);const encoded=E.encode(s);assert.deepEqual(E.decode(encoded),s);
 E.tick(s,c.remaining);assert.equal(c.status,'diagnosis');E.tick(s,c.remaining);assert.equal(c.status,'repair');E.tick(s,c.remaining);
 assert.ok(s.done.includes(c.mission));assert.ok(!s.calls.includes(c));assert.equal(s.money,before+E.payment(m,c.late));
 const reward=s.money;E.tick(s,1);assert.equal(s.money,reward);assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Invalid assignments and busy maintenance do not spend money, materials or fuel',()=>{
 const s=E.fresh();E.start(s);const c=s.calls[0],m=E.task(s,c),cr=s.crews.find(c=>c.service===m.service),wrong=s.crews.find(c=>c.service!==m.service),before=E.encode(s);
 assert.throws(()=>E.dispatch(s,c.mission,wrong.id));assert.equal(E.encode(s),before);E.dispatch(s,c.mission,cr.id);const busy=E.encode(s);assert.throws(()=>E.maintain(s,cr.vehicle));assert.equal(E.encode(s),busy);
});
test('Fleet management frees staff, keeps other vehicles when selling, and validates limits',()=>{
 const s=E.fresh();E.disband(s,0);E.sell(s,0);assert.equal(s.vehicles.length,2);assert.deepEqual(s.vehicles.map(v=>v.id),[1,2]);E.buy(s,'gazelle-next-van');E.form(s,[0,1],3);assert.equal(s.crews.length,3);assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Save recovery preserves corrupt records and rejects duplicate, unissued and inconsistent jobs',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},s=E.fresh();E.start(s);E.save(storage,s);s.money-=100;E.save(storage,s);
 data.set(E.SAVE,'broken');assert.equal(E.load(storage).recovered,true);assert.equal(E.load(storage).state.money,3000000);data.set(E.BACKUP,'also broken');assert.equal(E.load(storage).blocked,true);assert.equal(data.get(E.SAVE),'broken');
 for(const mutate of [s=>s.done.push(s.calls[0].mission),s=>s.calls[0].mission=missionOrder(s.seed,s.region).at(-1),s=>s.crews[0].members=[0,0],s=>s.phase='cleared',s=>s.cursor=4,s=>s.calls[0].status='repair',s=>s.stock[0]=-1]){const state=E.fresh();E.start(state);mutate(state);assert.throws(()=>E.decode(E.encode(state)),/повреждено/);}
 assert.ok(E.encode(s).length<20000,'Compact save does not persist all 19,980 templates');
});
