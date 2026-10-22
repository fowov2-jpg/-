import {test} from 'node:test';import assert from 'node:assert/strict';import * as E from '../web/engine.js';
test('Exact starting assets',()=>{const s=E.fresh();assert.equal(s.money,3000000);assert.equal(s.homes.length,3);assert.equal(s.crews.length,3);assert.equal(E.TYPES.length,20);});
test('Wrong specialization does not charge money',()=>{const s=E.fresh();E.start(s);assert.throws(()=>E.dispatch(s,1,1));assert.equal(s.money,3000000);});
test('Dispatch reserves resources once, completes and frees crew',()=>{const s=E.fresh();E.start(s);E.question(s,1);E.dispatch(s,1,0);assert.equal(s.money,2993800);assert.throws(()=>E.dispatch(s,1,0));E.tick(s,42);assert.equal(s.calls[0].status,'done');assert.equal(s.crews[0].status,'idle');assert.equal(s.crews[0].xp,10);});
test('Insufficient funds leave call untouched',()=>{const s=E.fresh();E.start(s);s.money=0;assert.throws(()=>E.dispatch(s,1,0));assert.equal(s.calls[0].status,'new');assert.equal(s.crews[0].status,'idle');});
test('Idle preparation cannot advance',()=>{const s=E.fresh();E.tick(s,50);assert.equal(s.minute,0);});
test('Late penalty applied once',()=>{const s=E.fresh();E.start(s);E.tick(s,66);const first=s.ledger.filter(l=>l.label==='Ущерб: Прорыв трубы').length;E.tick(s,5);assert.equal(s.ledger.filter(l=>l.label==='Ущерб: Прорыв трубы').length,first);assert.ok(s.calls[0].late);});
test('Contractor completes without crew and charges full cost',()=>{const s=E.fresh();E.start(s);E.outsource(s,1);assert.equal(s.money,3000000-6200*3);E.tick(s,45);assert.equal(s.calls[0].status,'done');assert.equal(s.crews[0].status,'idle');});
test('End shift is idempotent and unfinished tasks survive',()=>{const s=E.fresh();E.start(s);E.tick(s,480);assert.equal(s.phase,'report');const m=s.money;E.finish(s);assert.equal(s.money,m);const pending=s.report.pending;E.nextDay(s);assert.equal(s.calls.length,pending);assert.equal(s.day,2);assert.equal(s.phase,'prep');});
test('Save reload continuation is deterministic',()=>{const a=E.fresh();E.start(a);E.dispatch(a,1,0);E.tick(a,18);const b=E.decode(E.encode(a));E.tick(a,100);E.tick(b,100);assert.deepEqual(a,b);assert.throws(()=>E.decode('{"version":99}'));});
test('Maintenance and prevention enforce eligibility',()=>{const s=E.fresh();E.prevent(s,0);assert.equal(s.homes[0].wear,25);E.start(s);assert.throws(()=>E.prevent(s,0));E.dispatch(s,1,0);assert.throws(()=>E.maintain(s,0,'service'));});
test('Multiple days do not lose a repair in progress',()=>{const s=E.fresh();E.start(s);s.minute=470;const c=E.spawn(s,0,0);E.dispatch(s,c.id,0);E.tick(s,10);E.nextDay(s);E.start(s);E.tick(s,40);assert.equal(s.calls.find(x=>x.id===c.id).status,'done');});
test('Ten managed shifts reconcile ledger and preserve job references',()=>{const s=E.fresh();for(let day=0;day<10;day++){for(const c of s.crews)if(c.status==='idle')E.maintain(s,c.id,'service');E.start(s);while(s.phase==='active'){for(const c of s.calls.filter(c=>c.status==='new')){const cr=s.crews.find(x=>x.status==='idle'&&x.service===E.TYPES[c.type][1]&&x.fatigue<=90&&x.fuel>=8&&x.condition>=20);if(cr){E.question(s,c.id);E.dispatch(s,c.id,cr.id);}}E.tick(s,1);}const sum=s.ledger.filter(e=>e.day===s.day).reduce((a,e)=>a+e.amount,0);assert.equal(s.report.net,sum);assert.deepEqual(E.decode(E.encode(s)),s);for(const cr of s.crews)if(cr.job!==null)assert.ok(s.calls.find(c=>c.id===cr.job));if(day<9)E.nextDay(s);}});

test('Report includes preparation costs, including after reloading',()=>{
 let s=E.fresh();
 for(let day=0;day<2;day++){
  const opening=s.money;
  E.prevent(s,0);E.maintain(s,0,'service');E.maintain(s,1,'equipment');
  s=E.decode(E.encode(s));E.start(s);E.tick(s,480);
  assert.equal(s.report.net,s.money-opening);
  assert.equal(s.report.net,s.ledger.filter(e=>e.day===s.day).reduce((sum,e)=>sum+e.amount,0));
  E.nextDay(s);
 }
});

test('Reject damaged saves before they reach simulation or rendering',()=>{
 const mutations=[
  s=>{s.crews[0]=null;},s=>{s.homes[0]=null;},s=>{s.calls=[null];},
  s=>{s.crews[0].status='repair';s.crews[0].job=999;},
  s=>{s.crews[0].fuel='100';},s=>{s.crews[0].equipment=0;},
  s=>{s.seed=null;},s=>{s.sequence=0;},s=>{s.opening=null;},
  s=>{s.calls[0].id=s.calls[1].id;},s=>{s.calls[0].status='unknown';},
  s=>{s.calls[0].crew=1;},s=>{s.calls[0].due=null;},
  s=>{s.calls[0].status='repair';s.calls[0].crew=0;},
  s=>{s.phase='report';s.report=null;},s=>{s.ledger=[null];}
 ];
 for(const mutate of mutations){const s=E.fresh();E.start(s);mutate(s);assert.throws(()=>E.decode(E.encode(s)),/Сохранение повреждено/);}
});

test('Saves round-trip at every job stage and across day boundaries',()=>{
 let s=E.fresh();E.start(s);E.dispatch(s,1,0);E.outsource(s,2);
 for(let i=0;i<480;i++){s=E.decode(E.encode(s));E.tick(s);}
 E.nextDay(s);s=E.decode(E.encode(s));E.start(s);
 for(let i=0;i<480;i++){s=E.decode(E.encode(s));E.tick(s);}
 assert.equal(s.phase,'report');
});

