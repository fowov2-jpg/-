import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../web/routing.js';
import * as E from '../web/engine.js';
import {crewOption} from '../web/dispatch.js';

test('Road graph connects all three homes with real orthogonal segments', () => {
  for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    const path=R.routePlan(a,b,{day:1,minute:200});
    assert.deepEqual(path.points[0],R.ROAD_STOPS[a]);
    assert.deepEqual(path.points.at(-1),R.ROAD_STOPS[b]);
    assert.ok(path.minutes>=10);
    for(let i=1;i<path.points.length;i++)
      assert.ok(path.points[i][0]===path.points[i-1][0] ||
        path.points[i][1]===path.points[i-1][1], 'Route must stay on axis-aligned roads');
  }
  assert.equal(R.routePlan(0,0).minutes,10);
  assert.equal(R.routePlan(0,1,{day:1,minute:200}).distance,4);
});

test('Morning rush and bad weather modify ETA predictably', () => {
  assert.equal(R.weatherForDay(1).kind,'snow');
  assert.equal(R.weatherForDay(8).kind,'rain');
  assert.equal(R.weatherForDay(15).kind,'clear');
  const rush=R.routePlan(0,1,{day:1,minute:0});
  const quiet=R.routePlan(0,1,{day:1,minute:200});
  const summer=R.routePlan(0,1,{day:15,minute:200});
  assert.ok(rush.minutes>quiet.minutes, 'Morning rush must affect travel');
  assert.ok(quiet.minutes>summer.minutes, 'Snow must slow vehicles');
  assert.equal(rush.weather,'snow');
  assert.equal(rush.rush,true);
});

test('Route closures force a detour or signal an unavailable route', () => {
  const direct=R.routePlan(0,1,{day:15,minute:200});
  const detour=R.routePlan(0,1,{day:15,minute:200,blockedEdges:['2,4|4,4']});
  assert.ok(detour.distance>direct.distance);
  assert.ok(detour.minutes>direct.minutes);
  assert.throws(()=>R.routePlan(0,1,{blockedEdges:['0,4|2,4','2,4|4,4']}),/перекрыт/);
  assert.throws(()=>R.routePlan(9,0),/остановка/);
});

test('Crew uses the same immutable route and ETA as the dispatch forecast', () => {
  const s=E.fresh();E.start(s);
  const c=E.spawn(s,0,1);
  const expected=R.routePlan(0,1,{day:s.day,minute:s.minute});
  const option=crewOption(s,c,s.crews[0]);
  assert.equal(option.arrival,expected.minutes);
  E.dispatch(s,c.id,0);
  assert.deepEqual(s.crews[0].route,expected.points);
  assert.equal(s.crews[0].remaining,option.arrival);
  const snapshot=E.decode(E.encode(s));
  assert.deepEqual(snapshot.crews[0].route,expected.points);
  E.tick(snapshot,5);
  assert.deepEqual(snapshot.crews[0].route,expected.points);
  E.tick(snapshot,option.arrival-5);
  assert.equal(snapshot.crews[0].status,'diagnosis');
  E.tick(snapshot,50);
  assert.equal(snapshot.crews[0].status,'idle');
  assert.equal(snapshot.crews[0].route,null);
});

test('Legacy version-one saves without routes still load and continue', () => {
  const s=E.fresh();E.start(s);E.dispatch(s,1,0);
  delete s.crews[0].route; // old versions had no polyline field
  const restored=E.decode(E.encode(s));
  assert.equal(restored.crews[0].route,undefined);
  E.tick(restored,42);
  assert.equal(restored.calls[0].status,'done');
});

test('Weather is deterministic and does not depend on real clock or random seed', () => {
  const snapshot=Array.from({length:28},(_,i)=>R.weatherForDay(i+1));
  assert.deepEqual(snapshot,Array.from({length:28},(_,i)=>R.weatherForDay(i+1)));
  assert.throws(()=>R.weatherForDay(0),/день/);
});
