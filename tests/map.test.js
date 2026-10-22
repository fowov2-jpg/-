import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cameraFor,transformCamera} from '../web/map.js';
import {WORLD} from '../web/roads.js';
import {GRID_BOUNDS} from '../web/city-grid.js';

test('Single illustrated district never exposes empty edges after swipe and zoom',()=>{
 for(const width of [320,360,412,560])for(const height of [350,600,800,1100])
 for(const zoom of [.1,.65,1,1.8,2.7,4,50])for(const shift of [-100000,0,100000])
 for(const district of [0,1,2]){
  const view={zoom,x:shift,y:-shift,district,focus:[190,220+district*1024]},c=cameraFor(width,height,view);
  assert.ok(c.left<=0&&c.top<=0&&c.right>=width-.001&&c.bottom>=height-.001);
  assert.ok(view.zoom>=.12&&view.zoom<=4);
  assert.ok(Math.abs(c.right-c.left-(GRID_BOUNDS.maxX-GRID_BOUNDS.minX)*c.scale)<.001);
  assert.ok(Math.abs(c.bottom-c.top-(GRID_BOUNDS.maxY-GRID_BOUNDS.minY)*c.scale)<.001);
 }
});

test('Pinch anchors the world coordinate beneath fingers',()=>{
 const width=412,height=720,view={zoom:1.5,x:0,y:0,district:0,focus:null};
 const before=cameraFor(width,height,view),anchor=[206,360],world=[(anchor[0]-before.x)/before.scale,(anchor[1]-before.y)/before.scale];
 const after=transformCamera(width,height,view,...anchor,...anchor,1.7);
 assert.ok(after.scale>before.scale);
 assert.ok(Math.abs(world[0]*after.scale+after.x-anchor[0])<.001);
 assert.ok(Math.abs(world[1]*after.scale+after.y-anchor[1])<.001);
});

test('Two finger motion translates camera and pinches simultaneously',()=>{
 const view={zoom:1.5,x:0,y:0,district:0,focus:null};
 const before=cameraFor(412,720,view);
 const prev=[206,360],next=[225,390],originalWorld=[(prev[0]-before.x)/before.scale,(prev[1]-before.y)/before.scale];
 const after=transformCamera(412,720,view,...prev,...next,1.2);
 assert.ok(Math.abs(originalWorld[0]*after.scale+after.x-next[0])<.001);
 assert.ok(Math.abs(originalWorld[1]*after.scale+after.y-next[1])<.001);
});

test('Gesture zoom is bounded, and invalid ratios are rejected',()=>{
 const view={zoom:1,x:0,y:0,district:0,focus:null};
 transformCamera(412,720,view,206,360,206,360,100);
 assert.equal(view.zoom,4);
 transformCamera(412,720,view,206,360,206,360,.0001);
 assert.ok(view.zoom>=.12&&view.zoom<=.13);
 assert.throws(()=>transformCamera(412,720,view,206,360,206,360,0));
});
