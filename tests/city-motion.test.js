import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {TW,TH,DW,DH,SOURCE,ROAD_X,ROAD_Y,missions,missionOrder,streetRoute,pathLength} from '../web/campaign-city.js';
import {roadAxes} from '../web/campaign-roads-art.js';
import {roundedRoute,drivingPose,equipmentState} from '../web/vehicle-motion.js';
import {trafficPoses,TrafficController} from '../web/city-traffic.js';
import {efficiency,repairTime,deadlineFor,fuelFor,serviceCost,payment} from '../web/campaign-balance.js';
import {simulate} from '../tools/balance-report.js';

test('Neighbouring tiles share a single street and district boundaries share the same road axes',()=>{
 assert.equal(SOURCE.x+TW,1476);assert.equal(SOURCE.y+TH,950);
 assert.equal(ROAD_X.at(-1),TW+ROAD_X[0]);assert.equal(ROAD_Y.at(-1),TH+ROAD_Y[0]);
 assert.equal(roadAxes(0,TW,DW,ROAD_X).length,17);assert.equal(roadAxes(0,TH,DH,ROAD_Y).length,17);
 assert.equal(roadAxes(0,TW,DW,ROAD_X).at(-1),roadAxes(DW,TW,DW,ROAD_X)[0]);
});
test('v4 migration preserves ongoing work, old prices, resources and cursor without transforming twice',()=>{
 const s=E.fresh(112),id=missionOrder(112,0)[0],m=missions(112,0,1)[id],cr=s.crews[m.service];
 s.version=4;delete s.clock;s.phase='active';s.day=4;s.minute=25;s.cursor=1;
 for(const c of s.crews){c.point=[768,510];delete c.angle;}
 cr.status='travel';cr.job=id;s.calls=[{mission:id,status:'travel',crew:cr.id,due:100,late:false,asked:true,contained:false,remaining:9,total:17,path:[[768,510],[60,510],[60,200]]}];
 const raw=E.encode(s),restored=E.decode(raw);assert.equal(restored.version,5);assert.equal(restored.clock,1465);assert.deepEqual(restored.crews[0].point,[708,434]);assert.deepEqual(restored.calls[0].path,[[708,434],[0,434],[0,124]]);
 assert.equal(restored.calls[0].remaining,9);assert.equal(restored.calls[0].spec.reward,m.reward);assert.equal(restored.money,3000000);assert.deepEqual(restored.stock,s.stock);
 assert.deepEqual(E.decode(E.encode(restored)),restored);const broken=JSON.parse(raw);broken.crews[0].point=[-100,510];assert.throws(()=>E.decode(E.encode(broken)));
 const data=new Map([[E.SAVE,raw]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,restored);restored.money+=100;E.save(storage,restored);assert.equal(data.get(E.MIGRATION_ARCHIVE),raw,'The pre-update original must survive later autosaves');
});
test('Turns are continuous, endpoints keep their heading, and zero-length legs cannot create NaN',()=>{
 const path=[[0,0],[100,0],[100,100],[200,100]],curve=roundedRoute(path);assert.ok(pathLength(curve)<pathLength(path));
 assert.deepEqual(drivingPose(path,0).point,path[0]);assert.ok(Math.hypot(...drivingPose(path,1).point.map((v,i)=>v-path.at(-1)[i]))<1e-8);assert.equal(drivingPose(path,1).angle,0);
 let previous=drivingPose(path,0);for(let i=1;i<=1000;i++){const next=drivingPose(path,i/1000);assert.ok(Math.hypot(next.point[0]-previous.point[0],next.point[1]-previous.point[1])<.4);const turn=Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle));assert.ok(Math.abs(turn)<.4);previous=next;}
 const zero=drivingPose([[1,2],[1,2]],.5);assert.ok(zero.point.every(Number.isFinite));
 assert.equal(drivingPose([[0,0],[0,100]],1).angle,Math.PI/2);
});
test('All nine special vehicles deploy, work, fold and stay stowed during travel',()=>{
 const models=E.VEHICLE_MODELS.filter(m=>['crane','lift','tipper'].includes(m.kind));assert.equal(models.length,9);
 for(const model of models){
  const call={status:'repair',total:40,remaining:40};assert.equal(equipmentState(model,call).deployment,0);
  call.remaining=30;assert.equal(equipmentState(model,call).phase,'working');assert.equal(equipmentState(model,call).deployment,1);
  call.remaining=1;assert.equal(equipmentState(model,call).phase,'stowing');assert.ok(equipmentState(model,call).deployment<.5);
  call.status='travel';assert.equal(equipmentState(model,call).deployment,0);call.status='repair';assert.deepEqual(equipmentState(model,call,.9,false),{phase:'working',deployment:1,cycle:0});
 }
});
test('Traffic stays on street lanes and has no position jumps at loop wraps or turns',()=>{
 let previous=trafficPoses(112,0,0,0),stops=0;
 for(let tick=1;tick<=2000;tick++){
  const current=trafficPoses(112,0,0,tick*.05);
  for(let i=0;i<current.length;i++){const c=current[i],p=previous[i];assert.ok(Math.hypot(c.point[0]-p.point[0],c.point[1]-p.point[1])<4.5,'Traffic teleported');assert.ok(c.point.every(Number.isFinite));assert.ok(Math.min(...ROAD_X.map(x=>Math.abs(c.point[0]-x)),...ROAD_Y.map(y=>Math.abs(c.point[1]-y)))<=22);if(c.stopped)stops++;}
  previous=current;
 }
 assert.ok(stops>100);assert.deepEqual(trafficPoses(112,2,3,45),trafficPoses(112,2,3,45));
});
test('Traffic brakes before work zones, resumes when cleared, and freezes at paused simulation time',()=>{
 const controller=new TrafficController(),first=controller.frame(112,[[0,0]],0),car=first.find(c=>!c.stopped&&Math.abs(c.angle)<.01&&c.point[0]>100&&c.point[0]<500);assert.ok(car);
 const block=[car.point[0]+40,car.point[1]];let posed;
 for(let i=1;i<=60;i++)posed=controller.frame(112,[[0,0]],i*.05,[block]).find(c=>c.id===car.id);
 assert.ok(posed.point[0]<block[0]-24);const stopped=posed.point[0];
 for(let i=0;i<10;i++)assert.deepEqual(controller.frame(112,[[0,0]],3,[block]).find(c=>c.id===car.id).point,posed.point);
 for(let i=61;i<=100;i++)posed=controller.frame(112,[[0,0]],i*.05).find(c=>c.id===car.id);assert.ok(posed.point[0]>stopped+30);
});
test('Equipment has a real repair benefit; fuel, supplies, maintenance and late payments follow their costs',()=>{
 const s=E.fresh(),mission=E.catalog(s).find(m=>m.type===18),cr=s.crews[2],baseline=repairTime(s,mission,cr);s.vehicles[2].model='maz-tipper';assert.ok(repairTime(s,mission,cr)<baseline);assert.ok(efficiency(E.VEHICLE_MODELS.find(m=>m.id==='maz-tipper'))>1);
 assert.ok(fuelFor([[0,0],[100,0]])<fuelFor([[0,0],[10000,0]]));assert.equal(serviceCost({fuel:100,condition:100}),0);assert.ok(serviceCost({fuel:96,condition:99})<serviceCost({fuel:20,condition:40}));
 assert.ok(payment(mission,true)>=mission.materialsCost);assert.ok(payment(mission,true)<mission.reward);assert.equal(E.supplyCost(1),22000);assert.equal(E.supplyCost(2),36000);
 for(const m of missions(112,19).filter(m=>[9,13,16,19].includes(m.type)))assert.ok(m.quantity<=8,'Small lifts must retain useful jobs in late districts');
 E.start(s);const c=s.calls[0],m=E.task(s,c);const matching=s.crews.find(cr=>cr.service===m.service),model=E.VEHICLE_MODELS.find(mod=>mod.id===s.vehicles.find(v=>v.id===matching.vehicle).model);if(!model.supportedTypes||model.supportedTypes.includes(m.type))assert.ok(deadlineFor(s,m)>=m.duration);
});
test('A complete district is economically playable with both initial and expanded fleets',()=>{
 for(const teams of [3,6]){const r=simulate(112,teams,1);assert.equal(r.completed,999);assert.ok(r.minMoney>0);assert.ok(r.finalMoney>3000000);assert.ok(r.days<100);assert.ok(r.lateRate<.25);}
});
