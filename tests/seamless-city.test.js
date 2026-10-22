import {test} from 'node:test';
import assert from 'node:assert/strict';
import {districtHomes,visibleTiles,MAX_DISTRICT_HOMES} from '../web/city-grid.js';
import {WORLD,DISTRICT_HEIGHT,MARKERS,route,travelTime} from '../web/roads.js';
import {CITY_HOMES,DEPOT} from '../web/content.js';
test('999 unique, repeatable locations per district with stable prefixes',()=>{
 for(let district=0;district<3;district++){
  const full=districtHomes(district,MAX_DISTRICT_HOMES,42);
  assert.equal(full.length,999);
  assert.deepEqual(full.slice(0,48),districtHomes(district,48,42));
  assert.equal(new Set(full.map(h=>h.id)).size,999);
  assert.equal(new Set(full.map(h=>h.x+':'+h.y)).size,999);
  assert.ok(full.some(h=>h.row<0)&&full.some(h=>h.row>0));
  assert.ok(full.some(h=>h.col<0)&&full.some(h=>h.col>0));
 }
});
test('Viewport culls offscreen tiles and preserves seamless grid origin',()=>{
 assert.deepEqual(visibleTiles(0,0,1,480,720),[{row:0,col:0}]);
 const tiles=visibleTiles(0,0,.05,450,500);
 assert.ok(tiles.length>1&&tiles.length<=64);
});
test('Existing playable routes remain connected with symmetric travel time',()=>{
 assert.equal(CITY_HOMES.length,12);assert.equal(MARKERS.length,12);
 assert.equal(DISTRICT_HEIGHT,WORLD.height);
 for(let from=0;from<=DEPOT;from++)for(let to=0;to<=DEPOT;to++){
  const a=route(from,to),b=route(to,from);
  assert.deepEqual(a,[...b].reverse());
  assert.equal(travelTime(from,to),travelTime(to,from));
  assert.ok(a.every(point=>point.every(Number.isFinite)));
 }
});