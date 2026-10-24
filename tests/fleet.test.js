import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {FLEET_ART,FLEET_SIZE} from '../web/fleet-art.js';
import {vehicle} from '../web/graphics.js';

test('Each reference vehicle can be bought, restored, assigned, dispatched and sold',()=>{
 assert.equal(Object.keys(FLEET_ART).length,14);
 assert.equal(new Set(E.VEHICLE_MODELS.map(m=>m.id)).size,17);
 for(const id of Object.keys(FLEET_ART)){
  const model=E.VEHICLE_MODELS.find(m=>m.id===id),s=E.fresh(),before=s.money;
  E.buyVehicle(s,id);assert.equal(s.money,before-model.price);
  assert.equal(E.decode(E.encode(s)).vehicles.at(-1).model,id);
  const type=model.supportedTypes?.[0]??0,service=E.TYPES[type][1];
  E.disbandCrew(s,service);E.formCrew(s,[service*2,service*2+1],3);
  E.start(s);const call=E.spawn(s,type,0),crew=s.crews.at(-1);
  E.dispatch(s,call.id,crew.id);assert.doesNotThrow(()=>E.decode(E.encode(s)));
  E.tick(s,Math.min(300,crew.total+E.TYPES[type][3]+20));assert.equal(call.status,'done',id);
  E.tick(s,480);E.nextDay(s);E.disbandCrew(s,crew.id);
  const cash=s.money,condition=s.vehicles.find(v=>v.id===3).condition;
  E.sellVehicle(s,3);assert.equal(s.money,cash+Math.floor(model.price*.6*condition/100));
  assert.doesNotThrow(()=>E.decode(E.encode(s)));
 }
});
test('Special equipment refuses unrelated jobs without spending materials or fuel',()=>{
 for(const model of E.VEHICLE_MODELS.filter(m=>m.supportedTypes)){
  const type=E.TYPES.findIndex((_,i)=>!model.supportedTypes.includes(i)),s=E.fresh(),service=E.TYPES[type][1];
  s.vehicles[service].model=model.id;E.start(s);const call=E.spawn(s,type,0),before=E.encode(s);
  assert.match(E.dispatchReason(s,call,s.crews[service]),/не подходит/);
  assert.throws(()=>E.dispatch(s,call.id,service),/не подходит/);assert.equal(E.encode(s),before);
 }
});
test('Reference image rectangles stay in bounds and garage renders every model',()=>{
 for(const [id,{rect,length}] of Object.entries(FLEET_ART)){
  const [x,y,w,h]=rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=FLEET_SIZE[0]&&y+h<=FLEET_SIZE[1]);
  assert.ok(length>=40&&length<=100);assert.match(vehicle(2,id),new RegExp(`data-model="${id}"`));
  assert.ok(!vehicle(5,id).includes('undefined'));
 }
 const legacy=E.fresh();assert.deepEqual(E.decode(E.encode(legacy)),legacy);
});
test('Garage limit still applies independently of catalog size',()=>{
 const s=E.fresh();s.money=50000000;for(let i=0;i<9;i++)E.buyVehicle(s,'uaz2206-minibus');
 const before=E.encode(s);assert.throws(()=>E.buyVehicle(s,'gazelle-next-van'));assert.equal(E.encode(s),before);
});
