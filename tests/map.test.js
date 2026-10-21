import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {route,vehiclePosition} from '../web/map.js';
import {BUILDINGS,STOPS,ROADS,COURTYARDS,TREES,footprint,onRoad,buildingIntersectsRoad} from '../web/district.js';

test('Road network uses orthogonal service routes',()=>{
 assert.deepEqual(route(0,2),[[0,4],[0,5.55]]);
 const local=route(1,1);
 assert.equal(local.length,3);
 assert.deepEqual(local[0],local.at(-1));
 for(let i=1;i<local.length;i++){
  assert.ok(local[i][0]===local[i-1][0]||local[i][1]===local[i-1][1],'Local roads stay orthogonal');
 }
});
test('Van position uses real dispatch job and progress',()=>{
 const s=E.fresh();E.start(s);
 E.dispatch(s,2,1);
 const cr=s.crews[1];
 assert.deepEqual(vehiclePosition(cr,s),STOPS[3]); // Fresh crews wait at the depot.
 E.tick(s,20);
 assert.deepEqual(vehiclePosition(cr,s),STOPS[1]);
 assert.equal(cr.status,'diagnosis');
});
test('Van interpolates travel path without modifying game state',()=>{
 const s=E.fresh();E.start(s);
 const call=E.spawn(s,1,2);
 E.dispatch(s,call.id,0);
 const cr=s.crews[0],before=JSON.stringify(s);
 assert.deepEqual(vehiclePosition(cr,s),STOPS[3]);
 cr.remaining=cr.total/2;
 const p=vehiclePosition(cr,s);
 assert.ok(onRoad(p),'Service van remains on asphalt');
 assert.equal(s.money,3000000-E.TYPES[1][4]);
 assert.equal(s.calls.find(c=>c.id===call.id).status,'travel');
 assert.notEqual(JSON.stringify(s),before);
});


test('Curated blocks cannot intersect roads, playgrounds or other houses',()=>{
 assert.equal(BUILDINGS.length,8);
 assert.equal(BUILDINGS.filter(b=>Number.isInteger(b.managed)).length,3);
 const overlap=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
 for(const [i,b] of BUILDINGS.entries()){
  assert.equal(buildingIntersectsRoad(b),false,'Road clearance: '+b.id);
  const bb=footprint(b);
  for(const other of BUILDINGS.slice(i+1))
   assert.equal(overlap(bb,footprint(other)),false,'Buildings collide: '+b.id+'/'+other.id);
  for(const court of COURTYARDS)
   assert.equal(overlap(bb,{x0:court.x,x1:court.x+court.w,y0:court.y,y1:court.y+court.h}),false,
    'Court overlaps a house: '+b.id);
 }
 assert.equal(STOPS.length,4);
 for(const stop of STOPS) assert.ok(onRoad(stop),'Door-side arrival is on road');
 assert.ok(ROADS.length<=6,'No endless tight-grid road pattern');
});

test('All service routes use only street centerlines',()=>{
 for(let a=0;a<4;a++)for(let b=0;b<4;b++){
  const path=route(a,b);
  assert.deepEqual(path[0],STOPS[a]);
  assert.deepEqual(path.at(-1),STOPS[b]);
  for(const pt of path)assert.ok(onRoad(pt),'Route turns only on streets');
  for(let i=1;i<path.length;i++){
   const p=path[i-1],q=path[i];
   assert.ok(p[0]===q[0]||p[1]===q[1],'Road segment axis aligned');
   for(let n=0;n<=20;n++){
    const t=n/20;
    assert.ok(onRoad([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]),
      'Van crosses lawn on route '+a+' to '+b);
   }
  }
 }
});

test('Fresh crews use the public-road depot without changing active saved assignments',()=>{
 const s=E.fresh();
 assert.ok(s.crews.every(c=>c.home===3));
 const legacy=E.fresh();
 legacy.crews.forEach(c=>c.home=0);
 const restored=E.decode(E.encode(legacy));
 assert.ok(restored.crews.every(c=>c.home===3),'Unplayed version-one saves migrate');
 legacy.day=2;
 const played=E.decode(E.encode(legacy));
 assert.ok(played.crews.every(c=>c.home===0),'Played saves keep actual crew locations');
});
