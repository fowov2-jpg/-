import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {ART,district,TW,TH,DW,DH,districtOrigin,roadStop,streetRoute} from '../web/campaign-city.js';
import {riverColumns,riverTile,riverCenter,isWater,tileDesign,bridgeSites} from '../web/city-geography.js';
import {drivingPose} from '../web/vehicle-motion.js';

test('Ten art families compose spatially zoned quarters and distinct districts',()=>{
 assert.equal(ART.length,10);const kinds=new Set(),signatures=new Set();let mixed=0,industrialEast=0,industrialWest=0,towersCenter=0;
 for(let d=0;d<20;d++){
  const city=district(112,d);signatures.add(JSON.stringify(city.layouts));
  for(const l of city.layouts){for(const kind of l.quarters){kinds.add(kind);if(kind===4||kind===5){if(l.col>=30)industrialEast++;if(l.col<8)industrialWest++;}if(kind===2&&l.col>=12&&l.col<25)towersCenter++;}if(new Set(l.quarters).size>1)mixed++;}
 }
 assert.equal(signatures.size,20);assert.equal(kinds.size,10);assert.ok(mixed>500);assert.ok(industrialEast>industrialWest*3);assert.ok(towersCenter>100);
 assert.deepEqual(tileDesign(112,0,3),tileDesign(112,0,3));assert.notDeepEqual(tileDesign(112,0,3),tileDesign(113,0,3));
});
test('River ports remain continuous across all tile and district boundaries; every crossing has a bridge',()=>{
 for(const seed of [0,1,112,999,0xffffffff])for(const col of riverColumns(seed))for(let row=0;row<32;row++){
  const river=riverTile(seed,col,row);assert.ok(river);assert.equal(riverCenter(river,0),river.north);assert.equal(riverCenter(river,TH),river.south);
  if(row<31)assert.equal(river.south,riverTile(seed,col,row+1).north);
  const d=Array.from({length:20},(_,d)=>d).find(d=>{const o=districtOrigin(d);return col*TW>=o[0]&&col*TW<o[0]+DW&&row*TH>=o[1]&&row*TH<o[1]+DH;});
  const bridges=bridgeSites(seed,districtOrigin(d));for(const y of [0,434,TH])assert.ok(bridges.some(b=>b.angle===0&&b.x===col*TW+riverCenter(river,y)&&b.y===row*TH+y));
  if(river.kind===9)assert.ok(bridges.some(b=>b.angle===Math.PI/2&&b.x===col*TW+708&&b.y>=row*TH&&b.y<row*TH+TH));
 }
});
test('All 19,980 address entrances stay on land for different seeded cities, and routes use continuous street axes',()=>{
 for(const seed of [0,112,999,0xffffffff])for(let d=0;d<20;d++){
  const city=district(seed,d);assert.equal(city.homes.length,999);
  for(const home of city.homes){assert.equal(isWater(seed,home.x,home.y,15),false,`${seed}:${d}:${home.id}`);const route=streetRoute([city.origin[0]+708,city.origin[1]+434],roadStop(home));for(let i=1;i<route.length;i++)assert.ok(route[i][0]===route[i-1][0]||route[i][1]===route[i-1][1]);}
 }
});
test('v5 ongoing travel keeps its visible position, contract, resources and progress; new destination is reached',()=>{
 const old=E.fresh(112);E.start(old);const call=old.calls[0],m=E.task(old,call),crew=old.crews.find(c=>c.service===m.service);E.dispatch(old,call.mission,crew.id);old.version=5;
 call.path=[[708,434],[1416,434],[1416,1000]];call.total=20;call.remaining=9;const pose=drivingPose(call.path,.55),raw=E.encode(old),s=E.decode(raw),updated=s.calls[0],cr=s.crews.find(c=>c.id===crew.id);
 assert.equal(s.version,6);assert.deepEqual(cr.point,pose.point);assert.deepEqual(updated.path[0],pose.point);assert.deepEqual(updated.path.at(-1),roadStop(district(112,0).homes[call.mission]));assert.ok(updated.due>=call.due);assert.deepEqual(updated.spec,call.spec);assert.deepEqual(s.stock,old.stock);assert.deepEqual(s.vehicles,old.vehicles);assert.equal(s.cursor,old.cursor);assert.equal(s.money,old.money);assert.deepEqual(E.decode(E.encode(s)),s);
 const corrupt=JSON.parse(raw);corrupt.calls[0].path[0]=[-1,434];assert.throws(()=>E.decode(E.encode(corrupt)));
 const data=new Map([[E.SAVE,raw]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};E.save(storage,s);E.save(storage,s);assert.equal(data.get(E.MIGRATION_ARCHIVE),raw);
 E.tick(s,updated.remaining);assert.equal(updated.status,'diagnosis');assert.deepEqual(cr.point,roadStop(district(112,0).homes[call.mission]));
});
test('v5 work at relocated entrances keeps the remaining inspection and repair time',()=>{
 for(const status of ['diagnosis','repair']){
  const s=E.fresh(112);E.start(s);const call=s.calls[0],crew=s.crews.find(c=>c.service===E.task(s,call).service);E.dispatch(s,call.mission,crew.id);s.version=5;call.status=crew.status=status;call.total=40;call.remaining=17;
  const moved=E.decode(E.encode(s));assert.equal(moved.calls[0].remaining,17);assert.equal(moved.calls[0].total,40);assert.deepEqual(moved.crews.find(c=>c.id===crew.id).point,roadStop(district(112,0).homes[call.mission]));
 }
});
