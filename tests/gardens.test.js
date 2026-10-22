import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GARDEN_BEDS,BUILDINGS,ROADS,COURTYARDS,footprint} from '../web/district.js';

test('Garden plots avoid houses, roads and recreation areas',()=>{
 const disjoint=(a,b)=>a.x1<=b.x0||a.x0>=b.x1||a.y1<=b.y0||a.y0>=b.y1;
 const box=(x,y,w,h)=>({x0:x,x1:x+w,y0:y,y1:y+h});
 assert.ok(GARDEN_BEDS.length>=6);
 for(const bed of GARDEN_BEDS){
  const a=box(bed.x,bed.y,bed.w,bed.h);
  for(const house of BUILDINGS)assert.ok(disjoint(a,footprint(house)));
  for(const court of COURTYARDS)assert.ok(disjoint(a,box(court.x,court.y,court.w,court.h)));
  for(const road of ROADS){
   const b=road.axis==='x'?box(road.at-.6,road.from,1.2,road.to-road.from):box(road.from,road.at-.6,road.to-road.from,1.2);
   assert.ok(disjoint(a,b));
  }
 }
});
