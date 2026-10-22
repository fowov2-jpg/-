import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY_HOMES} from '../web/content.js';
import {generateDistrictHomes,boundsForHomes,sectionForGroup,MAX_HOMES_PER_DISTRICT} from '../web/district-generator.js';

test('Horizontal district grows symmetrically, preserving existing homes',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(sectionForGroup),[0,-1,1,-2,2,-3]);
 for(let district=0;district<3;district++){
  const homes=generateDistrictHomes(district,12);
  assert.equal(homes.length,12);
  assert.deepEqual(homes.slice(0,4).map(h=>h.id),CITY_HOMES.filter(h=>h.district===district).map(h=>h.id));
  assert.deepEqual([...new Set(homes.map(h=>h.section))].sort((a,b)=>a-b),[-1,0,1]);
  assert.equal(new Set(homes.map(h=>h.x+':'+h.y)).size,homes.length);
 }
});
test('Seeded generation supports 999 stable houses without collisions',()=>{
 for(const district of [0,1,2]){
  const homes=generateDistrictHomes(district,MAX_HOMES_PER_DISTRICT,123456);
  assert.equal(homes.length,999);
  assert.deepEqual(homes,generateDistrictHomes(district,999,123456));
  assert.deepEqual(homes.slice(0,48),generateDistrictHomes(district,48,123456));
  assert.equal(new Set(homes.map(h=>h.id)).size,999);
  assert.equal(new Set(homes.map(h=>h.x+':'+h.y)).size,999);
  assert.ok(homes.every(h=>Number.isFinite(h.x)&&Number.isFinite(h.y)));
  assert.ok(homes.some(h=>h.section<0)&&homes.some(h=>h.section>0));
 }
 const bounds=boundsForHomes(999);
 assert.equal(bounds.width,250*1000);
 assert.equal(bounds.minTile,-125);
 assert.equal(bounds.maxTile,124);
});
test('Generator validates limits and seed',()=>{
 for(const invalid of [0,3,1000,-1,2.5,NaN,Infinity])assert.throws(()=>generateDistrictHomes(0,invalid));
 assert.throws(()=>generateDistrictHomes(3,12));
 assert.throws(()=>generateDistrictHomes(0,12,NaN));
});
