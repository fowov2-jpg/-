import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../web/engine.js';

// Exercise the real startup and event handlers without a browser or Canvas.
const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function boot(raw=null,{unavailable=false}={}){
 const nodes=new Map(),events=new Map(),data=new Map(raw===null?[]:[['upravdom.v1',raw]]);
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{innerHTML:'',style:{},open:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});
  return nodes.get(id);
 };
 const document={hidden:false,querySelector:node,addEventListener:(name,fn)=>events.set('document:'+name,fn)};
 const window={addEventListener:(name,fn)=>events.set('window:'+name,fn)};
 const localStorage={getItem(key){if(unavailable)throw Error('Storage unavailable');return data.get(key)??null;},setItem(key,value){if(unavailable)throw Error('Storage unavailable');data.set(key,value);}};
 new Function('E','icon','renderMap','document','window','localStorage','setInterval','setTimeout','clearTimeout',source)(E,()=>'',()=>{},document,window,localStorage,()=>{},()=>{},()=>{});
 return {data,node,emit:name=>events.get(name)?.(),click:action=>events.get('document:click')({target:{closest:()=>({dataset:{action}})}})};
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
