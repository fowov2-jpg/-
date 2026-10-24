import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {crewForecast,rankedCrews,dispatchOverview} from '../web/dispatch-intelligence.js';

test('Forecast matches actual arrival, diagnosis and repair without mutating saves',()=>{
 const s=E.fresh();E.start(s);const call=s.calls[0],crew=s.crews.find(cr=>cr.service===E.task(s,call).service);
 E.contain(s,call.mission);const raw=E.encode(s),forecast=crewForecast(s,call,crew);
 assert.equal(E.encode(s),raw);assert.equal(forecast.eligible,true);
 assert.equal(rankedCrews(s,call)[0].crewId,crew.id);
 E.dispatch(s,call.mission,crew.id);assert.equal(call.total,forecast.eta);
 E.tick(s,forecast.eta);assert.equal(call.status,'diagnosis');
 E.tick(s,3);assert.equal(call.status,'repair');assert.equal(call.remaining,forecast.work);
 E.tick(s,forecast.work);assert.ok(s.done.includes(call.mission));
 assert.equal(s.minute,forecast.total);assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Dispatch overview counts work stages and excludes busy crews',()=>{
 const s=E.fresh();E.start(s);const call=s.calls[0],crew=s.crews.find(cr=>cr.service===E.task(s,call).service);
 assert.deepEqual(dispatchOverview(s),{newCalls:3,critical:0,enroute:0,working:0,available:3,total:3});
 E.dispatch(s,call.mission,crew.id);assert.equal(dispatchOverview(s).enroute,1);
 assert.equal(dispatchOverview(s).available,2);assert.equal(crewForecast(s,call,crew).eligible,false);
 E.tick(s,call.remaining);assert.equal(dispatchOverview(s).working,1);
});
test('Question during campaign diagnosis reduces remaining inspection once',()=>{
 const s=E.fresh();E.start(s);const call=s.calls[0],crew=s.crews.find(cr=>cr.service===E.task(s,call).service);
 E.dispatch(s,call.mission,crew.id);E.tick(s,call.remaining);E.tick(s,2);
 assert.equal(call.remaining,5);E.question(s,call.mission);assert.equal(call.remaining,1);
 const raw=E.encode(s);E.question(s,call.mission);assert.equal(E.encode(s),raw);
 assert.doesNotThrow(()=>E.decode(raw));E.tick(s);assert.equal(call.status,'repair');
});
test('Saves cannot resume an active shift beyond its final minute',()=>{
 const s=E.fresh();E.start(s);s.minute=E.SHIFT;assert.throws(()=>E.decode(E.encode(s)),/повреждено/);
 s.phase='report';assert.doesNotThrow(()=>E.decode(E.encode(s)));
 s.minute=0;assert.throws(()=>E.decode(E.encode(s)),/повреждено/);
});
