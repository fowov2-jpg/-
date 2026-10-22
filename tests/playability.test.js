import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {GameClock} from '../web/game-clock.js';
import {vehiclePose} from '../web/map.js';
import {DEPOT} from '../web/content.js';
import {route,stopAt,onRoute,distance,isTransfer} from '../web/roads.js';
test('Pause, dialogs and speed changes preserve fractional movement and elapsed game time',()=>{
 const c=new GameClock(0);assert.equal(c.advance(450,true,1),0);assert.equal(c.progress(450,false),.45);
 c.advance(10450,false);assert.equal(c.progress(10450,false),.45);
 assert.equal(c.advance(10700,true,2),0);assert.ok(Math.abs(c.carry-.95)<1e-9);
 assert.equal(c.advance(10725,true,2),1);assert.ok(c.carry<1e-9);
 assert.equal(c.advance(11725,true,4),4);c.reset(11725);assert.equal(c.carry,0);
});
test('Questioning during diagnosis actually shortens it, once, without extending elapsed work',()=>{
 const s=E.fresh();E.start(s);E.dispatch(s,1,0);E.tick(s,s.crews[0].total+2);
 assert.equal(s.crews[0].status,'diagnosis');assert.equal(s.crews[0].remaining,6);
 E.question(s,1);assert.equal(s.crews[0].remaining,2);const remaining=s.crews[0].remaining;E.question(s,1);assert.equal(s.crews[0].remaining,remaining);
 E.tick(s,2);assert.equal(s.crews[0].status,'repair');assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Free vehicles can be maintained and equipped; busy and already serviced vehicles cannot charge money',()=>{
 const s=E.fresh();E.disbandCrew(s,0);s.vehicles[0].fuel=40;
 E.maintainVehicle(s,0,'service');E.maintainVehicle(s,0,'equipment');assert.equal(s.vehicles[0].fuel,100);assert.equal(s.vehicles[0].equipment,2);
 const cash=s.money;assert.throws(()=>E.maintainVehicle(s,0,'service'));assert.equal(s.money,cash);
 E.formCrew(s,[0,1],0);E.start(s);E.dispatch(s,1,3);assert.throws(()=>E.maintainVehicle(s,0,'service'));assert.equal(s.money,cash);
});
test('Depot parking spaces remain fixed when another crew leaves and all vehicle bays fit district',()=>{
 const s=E.fresh(),before=vehiclePose(s,s.crews[1]);E.start(s);E.dispatch(s,1,0);assert.deepEqual(vehiclePose(s,s.crews[1]),before);
 for(let id=0;id<12;id++){const v=s.vehicles[1];v.id=id;const cr={...s.crews[1],vehicle:id};const p=vehiclePose({...s,vehicles:[v]},cr);assert.ok(p.point[1]>0&&p.point[1]<1500);}
});
test('Vehicle arrival keeps the incoming heading through diagnosis, repair and completion',()=>{
 const s=E.fresh();E.start(s);E.dispatch(s,1,0);const arrival=onRoute(route(DEPOT,0),1).angle;E.tick(s,s.crews[0].total);
 assert.equal(vehiclePose(s,s.crews[0]).angle,arrival);E.tick(s,100);assert.equal(vehiclePose(s,s.crews[0]).angle,arrival);assert.equal(vehiclePose(E.decode(E.encode(s)),s.crews[0]).angle,arrival);
});
test('Every road route is continuous, follows the graph and marks inter-district transfers',()=>{
 for(let a=0;a<=DEPOT;a++)for(let b=0;b<=DEPOT;b++){
  const path=route(a,b);assert.deepEqual(path[0],stopAt(a));assert.deepEqual(path.at(-1),stopAt(b));
  const length=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
  let last=path[0];for(let step=0;step<=200;step++){const p=onRoute(path,step/200);assert.ok(p.point.every(Number.isFinite));assert.ok(distance(last,p.point)<=length/200+.001);last=p.point;}
  if(a<12&&b<12&&Math.floor(a/4)!==Math.floor(b/4))assert.ok(path.slice(1).some((p,i)=>isTransfer(path[i],p)));
 }
});
test('All 20 incident types, 3 vehicle models and 12 homes complete with the correct specialization and resources',()=>{
 let cases=0;
 for(let type=0;type<E.TYPES.length;type++)for(const model of E.VEHICLE_MODELS)for(let home=0;home<12;home++){
  const s=E.fresh();s.day=10;s.reputation=100;s.campaign.completed=100;
  for(let id=3;id<12;id++)E.acceptContract(s,id);
  const service=E.TYPES[type][1];s.vehicles[service].model=model.id;E.start(s);s.calls=[];
  const c=E.spawn(s,type,home),bill=E.materials(s,c),before=s.warehouse.stock[bill.part];
  if(bill.quantity>model.capacity){assert.match(E.dispatchReason(s,c,s.crews[service]),/груз/);continue;}
  E.question(s,c.id);E.dispatch(s,c.id,service);assert.equal(s.warehouse.stock[bill.part],before-bill.quantity);
  let ticks=0;while(c.status!=='done'&&ticks++<300)E.tick(s);
  assert.equal(c.status,'done',`${type}/${model.id}/${home}`);assert.equal(s.crews[service].status,'idle');assert.equal(s.employees[service*2].xp,10);assert.doesNotThrow(()=>E.decode(E.encode(s)));cases++;
 }
 assert.ok(cases>=700);
});
