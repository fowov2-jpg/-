import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraFor} from '../web/map.js';
import {boundsForHomes} from '../web/district-generator.js';

test('Map covers viewport in all four directions at all zoom and preview sizes',()=>{
 for(const width of [320,360,412,560])for(const height of [350,600,800,1100])
 for(const zoom of [.1,.65,1,1.8,2.7])for(const shift of [-100000,0,100000])
 for(const district of [0,1,2])for(const plannedHomes of [4,12,24,48,999]){
  const view={zoom,x:shift,y:-shift,district,focus:[235,310+district*1500],plannedHomes};
  const c=cameraFor(width,height,view),bounds=boundsForHomes(plannedHomes);
  assert.ok(c.left<=0&&c.top<=0&&c.right>=width-.001&&c.bottom>=height-.001);
  assert.ok(view.zoom>=1);assert.ok(Number.isFinite(c.scale));
  assert.ok(Math.abs(c.right-c.left-bounds.width*c.scale)<.001);
  assert.ok(Math.abs(c.bottom-c.top-bounds.height*c.scale)<.001);
  assert.equal(c.minTileX,bounds.minTileX);assert.equal(c.maxTileY,bounds.maxTileY);
 }
});
test('North and south extremes both clamp to the actual district edges',()=>{
 for(const preview of [24,48,999]){
  const bounds=boundsForHomes(preview);
  const north=cameraFor(412,640,{zoom:1,x:0,y:1000000,district:0,plannedHomes:preview});
  const south=cameraFor(412,640,{zoom:1,x:0,y:-1000000,district:0,plannedHomes:preview});
  assert.ok(Math.abs(north.top)<.001);
  assert.ok(Math.abs(south.bottom-640)<.001);
  assert.ok(north.y>south.y);
  assert.ok(bounds.minY<0&&bounds.maxY>1500);
 }
});
