import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {crewForecast,rankedCrews,dispatchOverview} from '../web/dispatch-intelligence.js';

test('Dispatcher ranks real crews by ETA and job completion without mutating saves',()=>{
 const state=E.fresh(112);E.start(state);
 const call=state.calls.find(c=>c.status==='new'),before=JSON.stringify(state);
 const forecast=rankedCrews(state,call);
 assert.equal(forecast.length,state.crews.length);
 assert.deepEqual(rankedCrews(state,call),forecast);
 assert.ok(forecast.some(c=>c.eligible));
 assert.ok(forecast.every(c=>Number.isFinite(c.eta)&&Number.isFinite(c.total)&&c.total>=c.eta+c.work));
 assert.ok(forecast[0].eligible);
 assert.equal(JSON.stringify(state),before);
});
test('Operational overview follows crew state and does not fabricate jobs',()=>{
 const state=E.fresh(112);E.start(state);
 assert.equal(dispatchOverview(state).newCalls,3);
 assert.equal(dispatchOverview(state).available,3);
 const call=state.calls.find(c=>rankedCrews(state,c).some(x=>x.eligible));
 const option=rankedCrews(state,call).find(x=>x.eligible);
 E.dispatch(state,call.mission,option.crewId);
 assert.equal(dispatchOverview(state).enroute,1);
 assert.equal(dispatchOverview(state).available,2);
 assert.equal(dispatchOverview(state).newCalls,2);
 const another=state.calls.find(c=>c.status==='new');
 assert.ok(rankedCrews(state,another).some(x=>!x.eligible&&x.reason==='Бригада занята'));
});
test('Recommendation flags elapsed deadlines and unavailable crews',()=>{
 const state=E.fresh(112);E.start(state);
 const call=state.calls[0],crew=state.crews[0],snapshot=JSON.stringify(state);
 call.due=state.minute-1;
 const result=crewForecast(state,call,crew);
 assert.equal(result.remain,0);
 if(result.eligible)assert.equal(result.risk,'late');
 else assert.equal(result.risk,'unavailable');
 call.due=state.minute+10000;
 if(crewForecast(state,call,crew).eligible)assert.equal(crewForecast(state,call,crew).risk,'safe');
 assert.ok(snapshot.length>0);
});
