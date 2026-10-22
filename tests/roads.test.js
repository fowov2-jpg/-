import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEPOT} from '../web/content.js';
import {route,onRoute,travelTime,distance} from '../web/roads.js';
test('Every home and garage has a connected routes with symmetric travel cost',()=>{for(let from=0;from<=DEPOT;from++)for(let to=0;to<=DEPOT;to++){const path=route(from,to);assert.equal(travelTime(from,to),travelTime(to,from));assert.deepEqual(path[0],route(from,from)[0]);assert.deepEqual(path.at(-1),route(to,to)[0]);assert.ok(path.every(p=>p.every(Number.isFinite)));assert.ok(travelTime(from,to)>=3);}});
test('Routes use road junctions between houses, with monotonic interpolation',()=>{const path=route(DEPOT,0);assert.ok(path.length>=3);assert.deepEqual(onRoute(path,0).point,path[0]);assert.deepEqual(onRoute(path,1).point,path.at(-1));let travelled=0;for(let i=1;i<=100;i++)travelled+=distance(onRoute(path,(i-1)/100).point,onRoute(path,i/100).point);const length=path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);assert.ok(Math.abs(travelled-length)<20);assert.equal(travelTime(DEPOT,0),Math.max(3,Math.ceil(length/95)));assert.throws(()=>route(99,0));});
test('Stationary route has a finite position and angle',()=>{const p=route(2,2);assert.deepEqual(onRoute(p,.5),{point:p[0],angle:0});});
