import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {ART_SHEETS,BLENDER_MODELS,BLENDER_PROPS,NEIGHBORHOODS} from '../web/blender-manifest.js';
import {VEHICLE_MODELS} from '../web/content.js';

test('Every playable vehicle has complete Blender body, garage and equipment exports',()=>{
 assert.deepEqual(Object.keys(BLENDER_MODELS).sort(),VEHICLE_MODELS.map(m=>m.id).sort());
 let mechanisms=0;
 for(const model of VEHICLE_MODELS){
  const art=BLENDER_MODELS[model.id];assert.equal(art.body.length,16);assert.ok(art.body.every(Boolean),model.id);
  assert.ok(art.metres>4&&art.metres<12&&art.width>1.5&&art.width<3);
  assert.equal(art.bodyCell,192);assert.ok(art.card?.width>80&&art.card.height>100,model.id+' garage');
  assert.ok(statSync(new URL('../web/'+art.card.src,import.meta.url)).size>1000);
  assert.ok(art.icon?.width>30&&art.icon.height>60,model.id+' compact icon');
  assert.ok(statSync(new URL('../web/'+art.icon.src,import.meta.url)).size>500);
  const specialized=['crane','lift','tipper'].includes(model.kind);
  assert.equal(!!art.rig,specialized,model.id+' equipment');
  if(specialized){mechanisms++;assert.equal(art.rig.length,5);for(const row of art.rig){assert.equal(row.length,8);assert.ok(row.every(Boolean));}}
 }
 assert.equal(mechanisms,9);
});
test('Cropped frames retain finite camera anchors and fit bounded Android texture pages',()=>{
 let decoded=0;
 for(const pages of Object.values(ART_SHEETS))for(const page of pages){
  assert.ok(page.width>0&&page.width<=2048&&page.height>0&&page.height<=2048);
  const bytes=readFileSync(new URL('../web/'+page.src,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  decoded+=page.width*page.height*4;
 }
 assert.ok(decoded<48*1024*1024,'Decoded sprite pages exceed 48 MiB: '+decoded);
 function check(kind,frame){
  assert.ok(frame&&frame.length===7);assert.ok(frame.every(Number.isFinite));
  const [p,x,y,w,h]=frame,sheet=ART_SHEETS[kind][p];assert.ok(sheet);assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=sheet.width&&y+h<=sheet.height);
 }
 for(const model of Object.values(BLENDER_MODELS)){
  for(const frame of model.body)check('body',frame);
  for(const row of model.rig??[])for(const frame of row)check('rig',frame);
 }
 assert.equal(Object.keys(BLENDER_PROPS).length,19);
 for(const prop of Object.values(BLENDER_PROPS)){check('props',prop.frame);assert.ok(prop.view>0&&prop.cell===128);}
 assert.equal(NEIGHBORHOODS.length,10);
 for(const image of NEIGHBORHOODS){assert.ok(image);assert.ok(statSync(new URL('../web/'+image,import.meta.url)).size>10000);}
});
