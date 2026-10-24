import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeEdgeIndicators} from '../web/map-annotations.js';
test('Eight offscreen incidents get non-overlapping controls above the incident drawer',()=>{
 for(const width of [344,360,412,760]){
  const items=Array.from({length:8},(_,mission)=>({mission,point:[2000,2000+mission*20]}));
  const pins=placeEdgeIndicators(items,{width,height:800,top:136,bottom:320});
  assert.equal(pins.length,8);assert.equal(new Set(pins.map(p=>p.mission)).size,8);
  for(const p of pins){assert.ok(p.x>=27&&p.x<=width-27&&p.y>=136&&p.y<=320);assert.ok(Number.isFinite(p.angle));
   for(const q of pins)if(p!==q)assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=46);
  }
  assert.deepEqual(placeEdgeIndicators(items,{width,height:800,top:136,bottom:320}),pins);
 }
});
test('Tiny available playfields omit excess pointers instead of overlapping touch targets',()=>{
 const pins=placeEdgeIndicators(Array.from({length:16},(_,id)=>({id,point:[999,999]})),{width:150,height:300,top:136,bottom:140});
 assert.ok(pins.length>0&&pins.length<8);
 assert.deepEqual(placeEdgeIndicators([{point:[999,999]}],{width:344,height:400,top:190,bottom:150}),[]);
 for(const p of pins)for(const q of pins)if(p!==q)assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=46);
});
