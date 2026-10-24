import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/campaign-engine.js';
import {shiftSummary,trainingCost} from '../web/company-reports.js';

test('Shift report reconciles actual cash across more transactions than the ledger can hold',()=>{
 const s=E.fresh();E.start(s);const opening=s.money;
 for(let i=0;i<100;i++){E.log(s,1000,'Работа');E.log(s,-200,'Материалы');}
 E.tick(s,E.SHIFT);const r=shiftSummary(s);
 assert.equal(s.ledger.length,60);assert.equal(r.income,100000);
 assert.equal(r.costs,20000+E.expenses(s));assert.equal(r.net,s.money-opening);
 assert.equal(r.openingMoney+r.income-r.costs,r.closingMoney);
 assert.deepEqual(shiftSummary(E.decode(E.encode(s))),r);
 E.nextDay(s);assert.equal(shiftSummary(s).partial,true);E.start(s);
 assert.equal(shiftSummary(s).income,0);assert.equal(shiftSummary(s).costs,0);
});
test('Older campaign saves have explicitly partial reports without fabricated completion counts',()=>{
 const s=E.fresh();E.start(s);delete s.shift;E.log(s,18000,'Работа');
 const r=shiftSummary(E.decode(E.encode(s)));assert.equal(r.partial,true);assert.equal(r.completed,null);assert.equal(r.income,18000);
});
test('Training charges once and improves actual repair time; busy staff cannot train',()=>{
 const s=E.fresh(),p=s.employees[0],cr=s.crews[0],m=E.catalog(s).find(m=>m.service===0),before=E.repairTime(s,m,cr),money=s.money;
 E.train(s,p.id);assert.equal(p.level,3);assert.equal(s.money,money-24000);assert.ok(E.repairTime(s,m,cr)<before);
 while(p.level<5)E.train(s,p.id);const raw=E.encode(s);assert.throws(()=>E.train(s,p.id));assert.equal(E.encode(s),raw);
 const active=E.fresh();E.start(active);active.minute=477;const call=active.calls[0],crew=active.crews.find(cr=>cr.service===E.task(active,call).service);
 E.dispatch(active,call.mission,crew.id);E.tick(active,3);E.nextDay(active);assert.equal(crew.status,'travel');
 const pending=E.encode(active);assert.throws(()=>E.train(active,crew.members[0]),/выезде/);assert.equal(E.encode(active),pending);
 assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Dismissal cannot remove an assigned specialist; available staff can be rehired',()=>{
 const s=E.fresh(),raw=E.encode(s);assert.throws(()=>E.dismiss(s,0),/освободите/);assert.equal(E.encode(s),raw);
 E.disband(s,0);E.dismiss(s,0);assert.equal(s.employees.length,5);E.hire(s,0);assert.equal(s.employees.length,6);assert.doesNotThrow(()=>E.decode(E.encode(s)));
});
test('Malformed shift counters cannot replace a valid save',()=>{
 const s=E.fresh();E.start(s);s.shift.income=-1;assert.throws(()=>E.decode(E.encode(s)));
});
