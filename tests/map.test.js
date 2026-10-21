import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {route,vehiclePosition} from '../web/map.js';

test('Road network uses orthogonal service routes',()=>{
 assert.deepEqual(route(0,2),[[2,4],[4,4],[4,8],[2,8]]);
 assert.deepEqual(route(1,1),[[6,4]]);
});
test('Van position uses real dispatch job and progress',()=>{
 const s=E.fresh();E.start(s);
 E.dispatch(s,2,1);
 const cr=s.crews[1];
 assert.deepEqual(vehiclePosition(cr,s),[6,4]);
 E.tick(s,10);
 assert.deepEqual(vehiclePosition(cr,s),[6,4]);
 assert.equal(cr.status,'diagnosis');
});
test('Van interpolates travel path without modifying game state',()=>{
 const s=E.fresh();E.start(s);
 const call=E.spawn(s,1,2);
 E.dispatch(s,call.id,0);
 const cr=s.crews[0],before=JSON.stringify(s);
 assert.deepEqual(vehiclePosition(cr,s),[2,4]);
 cr.remaining=cr.total/2;
 const p=vehiclePosition(cr,s);
 assert.ok(p[0]>=2&&p[0]<=4);
 assert.ok(p[1]>=4&&p[1]<=8);
 assert.equal(s.money,3000000-E.TYPES[1][4]);
 assert.equal(s.calls.find(c=>c.id===call.id).status,'travel');
 assert.notEqual(JSON.stringify(s),before);
});
