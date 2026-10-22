import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraFor} from '../web/map.js';
import {WORLD} from '../web/roads.js';
import {boundsForHomes} from '../web/district-generator.js';
test('Map always covers viewport after zoom, focus and dragging beyond all edges',()=>{
 for(const width of [320,360,412,560])for(const height of [350,600,800,1100])for(const zoom of [.1,.65,1,1.8,2.7])for(const shift of [-100000,0,100000])for(const district of [0,1,2])for(const plannedHomes of [4,12,48,999]){
  const view={zoom,x:shift,y:-shift,district,focus:[235,310+district*1500],plannedHomes},c=cameraFor(width,height,view);
  assert.ok(c.left<=0&&c.top<=0&&c.right>=width-.001&&c.bottom>=height-.001);
  assert.ok(view.zoom>=1);assert.ok(Number.isFinite(c.scale));assert.ok(Math.abs(c.right-c.left-boundsForHomes(plannedHomes).width*c.scale)<.001);
  assert.ok(c.maxX>0&&c.minX<=0);
  assert.ok(Math.abs(c.bottom-c.top-WORLD.height*c.scale)<.001);
 }
});
