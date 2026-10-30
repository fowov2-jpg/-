import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import * as D from '../web/dispatch.js';

test('Queue prioritizes approaching and missed deadlines without mutating state', () => {
  const s = E.fresh(); E.start(s);
  const before = E.encode(s);
  assert.equal(D.queue(s)[0].priority, 3);
  assert.equal(D.counts(s).new, 3);
  assert.equal(E.encode(s), before);
  E.tick(s, 51);
  assert.equal(D.deadline(s, s.calls[0]).level, 'critical');
  assert.equal(D.deadline(s, s.calls[0]).remaining, 14);
  E.tick(s, 15);
  assert.equal(D.deadline(s, s.calls[0]).level, 'overdue');
  assert.ok(D.queue(s, 'overdue').some(c => c.id === 1));
});

test('Filters distinguish waiting, assigned and completed calls', () => {
  const s = E.fresh(); E.start(s);
  E.dispatch(s, 1, 0);
  assert.equal(D.counts(s).new, 2);
  assert.equal(D.counts(s).assigned, 1);
  assert.deepEqual(D.queue(s, 'assigned').map(c => c.id), [1]);
  assert.equal(D.queue(s, 'new').length, 2);
  E.tick(s, 46);
  assert.equal(D.counts(s).done, 1);
  assert.equal(D.queue(s, 'done')[0].id, 1);
  assert.equal(D.counts(s).active, s.calls.filter(c=>c.status!=='done').length);
  assert.throws(() => D.queue(s, 'unknown'), /фильтр/);
});

test('Crew eligibility matches simulation constraints and gives travel estimate', () => {
  const s = E.fresh(); E.start(s);
  const c = s.calls[0];
  let o = D.crewOption(s, c, s.crews[0]);
  assert.equal(o.available, true);
  assert.equal(o.arrival, 10);
  assert.equal(o.total, 46);
  assert.equal(D.crewOption(s, c, s.crews[1]).reason, 'Другая специализация');
  E.question(s, c.id);
  assert.equal(D.crewOption(s, c, s.crews[0]).total, 42);
  s.crews[0].fuel = 7;
  assert.match(D.crewOption(s, c, s.crews[0]).reason, /топлива/);
  s.crews[0].fuel = 100; s.crews[0].condition = 19;
  assert.match(D.crewOption(s, c, s.crews[0]).reason, /ТО/);
  s.crews[0].condition = 100; s.crews[0].fatigue = 91;
  assert.match(D.crewOption(s, c, s.crews[0]).reason, /отдых/);
  s.crews[0].fatigue = 0; s.money = 0;
  assert.match(D.crewOption(s, c, s.crews[0]).reason, /денег/);
});

test('A busy crew cannot be suggested for another call', () => {
  const s = E.fresh(); E.start(s); E.dispatch(s, 1, 0);
  const c = E.spawn(s, 0, 2);
  assert.equal(D.crewOption(s, c, s.crews[0]).available, false);
  assert.match(D.crewOption(s, c, s.crews[0]).reason, /занята/);
});

test('Contractor recommendation checks available budget and keeps funds untouched', () => {
  const s = E.fresh(); E.start(s); const c = s.calls[0];
  assert.equal(D.contractorOption(s, c).cost, 18600);
  const money = s.money;
  assert.equal(D.contractorOption(s, c).available, true);
  assert.equal(s.money, money);
  s.money = 1000;
  assert.equal(D.contractorOption(s, c).available, false);
  assert.match(D.contractorOption(s, c).reason, /денег/);
});

test('Completed late calls are not shown as active overdue alerts', () => {
  const s = E.fresh(); E.start(s); E.tick(s, 70);
  E.dispatch(s, 1, 0); E.tick(s, 60);
  assert.equal(s.calls[0].status, 'done');
  assert.equal(D.deadline(s, s.calls[0]).level, 'done');
  assert.match(D.deadline(s, s.calls[0]).label, /просрочкой/);
  assert.equal(D.queue(s, 'overdue').some(c => c.id === 1), false);
});

test('Selectors keep working on a version 1 save and over a day boundary', () => {
  const s = E.fresh(); E.start(s); E.tick(s, 480); E.nextDay(s);
  const restored = E.decode(E.encode(s));
  assert.equal(D.counts(restored).active, restored.calls.length);
  assert.equal(D.deadline(restored, restored.calls[0]).level, 'overdue');
  const snapshot = E.encode(restored);
  D.queue(restored, 'all'); D.crewOption(restored, restored.calls[0], restored.crews[0]);
  assert.equal(E.encode(restored), snapshot);
});
