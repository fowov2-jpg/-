import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
function expanded(){const s=E.fresh();for(let i=0;i<2;i++)E.hire(s,s.candidates.find(c=>c.service===0).id);E.buyVehicle(s,'van');E.formCrew(s,[6,7],3);return s;}
test('Hiring, buying a vehicle and forming a crew create a usable fourth team',()=>{const s=expanded();assert.equal(s.employees.length,8);assert.equal(s.vehicles.length,4);assert.equal(s.crews.length,4);assert.ok(s.money<3000000);E.start(s);const c=E.spawn(s,0,0);E.dispatch(s,c.id,3);assert.equal(s.crews[3].job,c.id);assert.deepEqual(E.decode(E.encode(s)),s);});
test('Team assembly rejects duplicate people, wrong profiles and already assigned vehicles atomically',()=>{const s=expanded(),before=E.encode(s);assert.throws(()=>E.formCrew(s,[6,6],3));assert.throws(()=>E.formCrew(s,[0,2],3));assert.throws(()=>E.formCrew(s,[0,1],0));assert.equal(E.encode(s),before);});
test('Disbanding frees staff and vehicle and preserves completed-job saves',()=>{const s=E.fresh();E.start(s);E.dispatch(s,1,0);E.tick(s,480);E.nextDay(s);E.disbandCrew(s,0);assert.equal(s.crews.length,2);assert.doesNotThrow(()=>E.decode(E.encode(s)));E.formCrew(s,[0,1],0);assert.equal(s.crews.length,3);});
test('Materials reserve once and urgent delivery arrives after 30 active minutes',()=>{const s=E.fresh();s.warehouse.stock[0]=0;E.start(s);const before=E.encode(s);assert.throws(()=>E.dispatch(s,1,0),/складе/);assert.equal(E.encode(s),before);E.orderParts(s,0,10,true);assert.equal(s.warehouse.stock[0],0);E.tick(s,29);assert.equal(s.warehouse.stock[0],0);E.tick(s);assert.equal(s.warehouse.stock[0],10);E.dispatch(s,1,0);assert.equal(s.warehouse.stock[0],5);assert.throws(()=>E.dispatch(s,1,0));assert.equal(s.warehouse.stock[0],5);});
test('Standard orders arrive next morning; reserved deliveries count against capacity',()=>{const s=E.fresh();E.orderParts(s,0,20);assert.equal(s.warehouse.stock[0],40);assert.equal(E.stockUsage(s),140);assert.throws(()=>E.orderParts(s,1,100),/места/);E.start(s);E.tick(s,480);E.nextDay(s);assert.equal(s.warehouse.stock[0],60);assert.equal(s.warehouse.orders.length,0);});
test('New contracts increase workload and expansion requirements cannot be bypassed',()=>{const s=E.fresh(),money=s.money;assert.throws(()=>E.acceptContract(s,4),/день/);E.acceptContract(s,3);assert.equal(E.ownedHomes(s).length,4);assert.equal(s.money,money-65000);assert.throws(()=>E.acceptContract(s,3));E.start(s);const c=E.spawn(s,4,3);assert.equal(c.home,3);assert.throws(()=>E.acceptContract(s,4));});
test('Neglect loses contracts and stops the company instead of producing passive profits',()=>{const s=E.fresh();while(s.day<12&&s.campaign.status!=='lost'){E.start(s);E.tick(s,480);if(s.campaign.status!=='lost')E.nextDay(s);}assert.equal(s.campaign.status,'lost');assert.equal(E.ownedHomes(s).length,0);assert.ok(s.money<3000000);assert.throws(()=>E.nextDay(s));assert.ok(s.report.invoices.length);});
test('Multi-stage incident unlocks later services only after their dependencies finish',()=>{const s=E.fresh();E.start(s);const [water,power,repair]=E.spawnEmergency(s,0);assert.equal(power.status,'blocked');assert.throws(()=>E.outsource(s,power.id));E.outsource(s,water.id);E.tick(s,45);assert.equal(power.status,'new');assert.equal(repair.status,'blocked');assert.equal(power.due,s.minute+65);E.outsource(s,power.id);E.tick(s,45);assert.equal(repair.status,'new');assert.doesNotThrow(()=>E.decode(E.encode(s)));});
test('Shared crew resources update individual workers and their assigned vehicle',()=>{const s=E.fresh();E.start(s);E.question(s,1);E.dispatch(s,1,0);E.tick(s,45);assert.equal(s.calls[0].status,'done');assert.equal(s.employees[0].xp,10);assert.equal(s.employees[1].fatigue,12);assert.equal(s.vehicles[0].fuel,92);assert.equal(s.vehicles[0].condition,97);assert.equal(s.crews[0].fatigue,12);});
test('Safety guidance is one-time and cannot extend a job indefinitely',()=>{const s=E.fresh();E.start(s);const due=s.calls[0].due;E.contain(s,1);assert.equal(s.calls[0].due,due+15);assert.throws(()=>E.contain(s,1));});
test('Selling and firing respect assignments and reconcile cash',()=>{const s=E.fresh();assert.throws(()=>E.fire(s,0));assert.throws(()=>E.sellVehicle(s,0));E.disbandCrew(s,0);const before=s.money;E.fire(s,0);E.sellVehicle(s,0);assert.equal(s.employees.length,5);assert.equal(s.vehicles.length,2);assert.ok(s.money>before);assert.doesNotThrow(()=>E.decode(E.encode(s)));});

test('An expanding company can reach the city objective using real hires, purchases and supplies',()=>{
 const s=E.fresh();E.expandWarehouse(s);
 for(let day=0;day<20&&s.campaign.status==='running';day++){
  for(let service=0;service<3;service++)if(s.crews.filter(c=>c.service===service).length<2&&s.money>800000){
   const candidates=s.candidates.filter(c=>c.service===service);
   if(candidates.length>=2){const first=s.nextEmployee,vehicle=s.nextVehicle;candidates.slice(0,2).forEach(c=>E.hire(s,c.id));E.buyVehicle(s,'van');E.formCrew(s,[first,first+1],vehicle);}
  }
  for(const h of s.homes)if(!h.active&&!E.contractReason(s,h.id)&&s.money>h.fee+500000)E.acceptContract(s,h.id);
  for(let part=0;part<3;part++)if(s.warehouse.stock[part]<40&&E.stockUsage(s)+50<=s.warehouse.capacity)E.orderParts(s,part,50,true);
  for(const cr of s.crews)if(cr.status==='idle'&&(cr.fuel<40||cr.condition<65))E.maintain(s,cr.id,'service');
  E.start(s);
  while(s.phase==='active'){
   for(const c of s.calls.filter(c=>c.status==='new').sort((a,b)=>b.priority-a.priority||a.due-b.due)){
    const cr=s.crews.find(cr=>!E.dispatchReason(s,c,cr));if(cr){E.contain(s,c.id);E.dispatch(s,c.id,cr.id);}
   }
   for(let part=0;part<3;part++)if(s.warehouse.stock[part]<8&&!s.warehouse.orders.some(o=>o.part===part)&&E.stockUsage(s)+40<=s.warehouse.capacity)E.orderParts(s,part,40,true);
   E.tick(s);
  }
  assert.doesNotThrow(()=>E.decode(E.encode(s)));
  if(s.campaign.status==='running')E.nextDay(s);
 }
 assert.equal(s.campaign.status,'won');assert.ok(E.ownedHomes(s).length>=9);assert.ok(s.campaign.completed>=100);assert.ok(s.money>0);
});
