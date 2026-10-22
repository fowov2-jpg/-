import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY_HOMES} from '../web/content.js';
import {generateDistrictHomes,boundsForHomes,sectionForGroup,MAX_HOMES_PER_DISTRICT} from '../web/district-generator.js';

test('District extends left, right, up and down while preserving the four original houses',()=>{
 assert.deepEqual(Array.from({length:5},(_,i)=>sectionForGroup(i)),[
  [0,0],[-1,0],[1,0],[0,-1],[0,1]
 ]);
 for(let district=0;district<3;district++){
  const homes=generateDistrictHomes(district,24);
  assert.equal(homes.length,24);
  assert.deepEqual(homes.slice(0,4).map(h=>h.id),CITY_HOMES.filter(h=>h.district===district).map(h=>h.id));
  const quadrants=new Set(homes.map(h=>h.column+':'+h.row));
  for(const tile of ['0:0','-1:0','1:0','0:-1','0:1'])assert.ok(quadrants.has(tile));
  assert.equal(new Set(homes.map(h=>h.x+':'+h.y)).size,homes.length);
 }
 const bounds=boundsForHomes(24);
 assert.equal(bounds.minX,-1000);assert.equal(bounds.maxX,2000);
 assert.equal(bounds.minY,-1500);assert.equal(bounds.maxY,3000);
});

test('Mirrored tile house locations stay inside their own tile in both axes',()=>{
 for(let district=0;district<3;district++){
  for(const house of generateDistrictHomes(district,999,42)){
   const localY=house.y-district*1500;
   assert.ok(house.x>house.column*1000&&house.x<(house.column+1)*1000);
   assert.ok(localY>house.row*1500&&localY<(house.row+1)*1500);
  }
 }
});

test('Seeded generation supports 999 stable unique houses without collisions',()=>{
 for(const district of [0,1,2]){
  const homes=generateDistrictHomes(district,MAX_HOMES_PER_DISTRICT,123456);
  assert.equal(homes.length,999);
  assert.deepEqual(homes,generateDistrictHomes(district,999,123456));
  assert.deepEqual(homes.slice(0,48),generateDistrictHomes(district,48,123456));
  assert.equal(new Set(homes.map(h=>h.id)).size,999);
  assert.equal(new Set(homes.map(h=>h.x+':'+h.y)).size,999);
  assert.ok(homes.some(h=>h.column<0)&&homes.some(h=>h.column>0));
  assert.ok(homes.some(h=>h.row<0)&&homes.some(h=>h.row>0));
 }
 const bounds=boundsForHomes(999);
 assert.equal(bounds.sections,250);
 assert.equal(bounds.minTileX,-8);assert.equal(bounds.maxTileX,8);
 assert.equal(bounds.minTileY,-8);assert.equal(bounds.maxTileY,8);
 assert.equal(bounds.width,17000);assert.equal(bounds.height,25500);
});

test('Generator enforces house, district, seed and section limits',()=>{
 for(const invalid of [0,3,1000,-1,2.5,NaN,Infinity])assert.throws(()=>generateDistrictHomes(0,invalid));
 assert.throws(()=>generateDistrictHomes(3,12));
 assert.throws(()=>generateDistrictHomes(0,12,NaN));
 assert.throws(()=>sectionForGroup(-1));assert.throws(()=>sectionForGroup(250));
});
