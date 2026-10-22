import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../web/engine.js';
import {GameClock} from '../web/game-clock.js';
import {loadGame,saveGame,loadSettings,saveSettings,SAVE_KEY,BACKUP_KEY} from '../web/storage.js';
import {STAFF,vehicle} from '../web/graphics.js';
import {MARKERS,travelTime} from '../web/roads.js';
import {managementPage,domainDialog} from '../web/management.js';
import {DEPOT,DISTRICTS,VEHICLE_MODELS} from '../web/content.js';

// Exercise the real startup and event handlers without a browser or Canvas.
const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function boot(raw=null,{unavailable=false,backup=null}={}){
 let time=0;
 const nodes=new Map(),events=new Map(),data=new Map(raw===null?[]:[['upravdom.v1',raw]]);
 if(backup!==null)data.set(BACKUP_KEY,backup);
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{innerHTML:'',style:{},classList:{add(){},remove(){}},open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(id);
 };
 const document={hidden:false,querySelector:node,addEventListener:(name,fn)=>events.set('document:'+name,fn)};
 const window={addEventListener:(name,fn)=>events.set('window:'+name,fn)};
 const localStorage={getItem(key){if(unavailable)throw Error('Storage unavailable');return data.get(key)??null;},setItem(key,value){if(unavailable)throw Error('Storage unavailable');data.set(key,value);}};
 const dependencies={E,GameClock,performance:{now:()=>time},icon:()=>'',renderMap:()=>{},loadArtwork:()=>{},MARKERS,travelTime,loadGame,saveGame,loadSettings,saveSettings,SAVE_KEY,BACKUP_KEY,notifySound:()=>{},STAFF,vehicle,managementPage,domainDialog,DEPOT,DISTRICTS,VEHICLE_MODELS,document,window,globalThis:{localStorage},requestAnimationFrame:()=>1,setInterval:fn=>events.set('timer:tick',fn),setTimeout:()=>1,clearTimeout:()=>{}};
 new Function(...Object.keys(dependencies),source)(...Object.values(dependencies));
 return {data,node,emit:name=>{if(name==='timer:tick')time+=1000;return events.get(name)?.();},click:(action,attributes={})=>events.get('document:click')({target:{closest:()=>({dataset:{action,...attributes}})}})};
}
test('First launch starts a company without a load-error dialog',()=>{
 const app=boot();assert.equal(app.node('#dialog').open,false);
 app.emit('window:pagehide');assert.equal(E.decode(app.data.get('upravdom.v1')).money,3000000);
});
test('Corrupt save survives closing the warning, navigation and page exit',()=>{
 const raw='{"version":1,"money":12345}',app=boot(raw);
 assert.equal(app.node('#dialog').open,true);
 assert.match(app.node('#dialog').innerHTML,/Автосохранение отключено/);
 app.click('close');app.click('pause');app.emit('window:pagehide');app.emit('window:upravdom-pause');
 assert.equal(app.data.get('upravdom.v1'),raw);
 app.click('reset');app.click('close');app.emit('window:pagehide');
 assert.equal(app.data.get('upravdom.v1'),raw);
 app.click('reset');app.click('confirmReset');
 assert.equal(E.decode(app.data.get('upravdom.v1')).phase,'prep');
 app.click('start');assert.equal(E.decode(app.data.get('upravdom.v1')).phase,'active');
});
test('Valid existing company resumes without a recovery warning',()=>{
 const s=E.fresh();E.start(s);E.dispatch(s,1,0);E.tick(s,18);
 const app=boot(E.encode(s));assert.equal(app.node('#dialog').open,false);
 app.emit('window:pagehide');assert.deepEqual(E.decode(app.data.get('upravdom.v1')),s);
});
test('Unavailable storage produces a visible warning without crashing startup',()=>{
 const app=boot(null,{unavailable:true});assert.equal(app.node('#dialog').open,true);
 assert.doesNotThrow(()=>app.emit('window:pagehide'));
});

test('Five sections render real services, people, vehicles and finance',()=>{
 const app=boot();assert.match(app.node('#nav').innerHTML,/data-tab="garage"/);
 app.click('tab',{tab:'services'});for(const people of STAFF)for(const person of people)assert.ok(app.node('#page').innerHTML.includes(person.name));
 app.click('tab',{tab:'garage'});assert.match(app.node('#page').innerHTML,/Заправить и ТО/);assert.match(app.node('#page').innerHTML,/Оснастить/);
 app.click('tab',{tab:'finance'});assert.match(app.node('#page').innerHTML,/3\s000\s000/);
 app.click('tab',{tab:'calls'});assert.match(app.node('#page').innerHTML,/Все обращения под контролем/);
});
test('Recovered company remains playable and preserves valid backup',()=>{
 const old=E.fresh();E.prevent(old,0);const app=boot('broken',{backup:E.encode(old)});
 assert.equal(app.node('#dialog').open,false);app.click('start');
 const saved=E.decode(app.data.get(SAVE_KEY));assert.equal(saved.money,2988000);assert.equal(saved.phase,'active');assert.equal(E.decode(app.data.get(BACKUP_KEY)).money,2988000);
});
test('Dialog pauses simulation; background and reload resume on pause',()=>{
 const s=E.fresh();E.start(s);const app=boot(E.encode(s));app.click('pause');app.emit('timer:tick');app.emit('window:pagehide');
 assert.equal(E.decode(app.data.get(SAVE_KEY)).minute,1);
 app.click('pause');app.click('call',{id:'1'});app.emit('timer:tick');app.emit('window:pagehide');assert.equal(E.decode(app.data.get(SAVE_KEY)).minute,1);
 app.click('close');app.emit('window:upravdom-pause');app.emit('timer:tick');assert.equal(E.decode(app.data.get(SAVE_KEY)).minute,1);
});
test('Sound and map preferences persist independently of company',()=>{
 const app=boot();app.click('settings');app.click('setting',{key:'sound'});
 assert.equal(JSON.parse(app.data.get('upravdom.settings')).sound,false);
});
