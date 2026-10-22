import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fresh,start,dispatch,tick} from '../web/engine.js';
import {renderMap,useFoliageSprite} from '../web/map.js';

function fakeCanvas(width=412,height=800){
 const stats={paths:0,text:0,gradients:0};
 const style={};
 const gradient=()=>({addColorStop(){}});
 const ctx=new Proxy(style,{
  get(target,name){
   if(name==='createLinearGradient')return (...args)=>{stats.gradients++;return gradient();};
   if(name==='measureText')return text=>({width:String(text).length*7.8});
   if(name==='fillText')return (...args)=>{stats.text++;};
   if(name==='beginPath')return ()=>{stats.paths++;};
   if(Object.prototype.hasOwnProperty.call(target,name))return target[name];
   return ()=>{};
  },
  set(target,name,value){target[name]=value;return true;}
 });
 const canvas={
  width:0,height:0,
  getBoundingClientRect:()=>({width,height}),
  getContext:kind=>kind==='2d'?ctx:null
 };
 return {canvas,stats};
}

test('District renders a real first-day state on portrait canvas without mutating it',()=>{
 const s=fresh();start(s);
 const before=JSON.stringify(s);
 const {canvas,stats}=fakeCanvas();
 const view={zoom:1,x:0,y:0,hits:[],animation:0};
 renderMap(canvas,s,view);
 assert.equal(canvas.width,412);
 assert.equal(canvas.height,800);
 assert.ok(stats.paths>100,'Procedural district creates geometry');
 assert.ok(stats.text>3,'Buildings and incident markers have labels');
 assert.ok(stats.gradients>=1);
 assert.ok(view.hits.some(h=>h.call===1));
 assert.ok(view.hits.some(h=>h.home===0));
 assert.ok(view.hits.every(h=>h.point.every(Number.isFinite)));
 assert.equal(JSON.stringify(s),before);
});

test('Animated travel and seasonal changes remain visual only',()=>{
 const s=fresh();start(s);dispatch(s,1,0);tick(s,4);
 const {canvas}=fakeCanvas(360,740);
 const view={zoom:1.3,x:15,y:-20,hits:[],animation:3.5};
 const before=JSON.stringify(s);
 renderMap(canvas,s,view);
 view.animation=9.8;
 renderMap(canvas,s,view);
 assert.ok(view.hits.some(h=>h.call===1));
 assert.equal(JSON.stringify(s),before,'No simulation changes from rendering frames');
 s.day=15;
 renderMap(canvas,s,view);
 assert.equal(s.day,15,'Warm-season render also leaves day unchanged');
});

test('Winter uses snow-aware tree rendering rather than green foliage PNGs',()=>{
 assert.equal(useFoliageSprite(true),false);
 assert.equal(useFoliageSprite(false),true);
});
