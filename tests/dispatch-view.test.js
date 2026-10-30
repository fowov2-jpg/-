import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {dispatcherTop, dispatcherList, dispatcherDialog} from '../web/dispatch-view.js';

const ui = {
  icon: name => '<svg data-icon="' + name + '"></svg>',
  button: (action, label, extra = '', cls = '') =>
    '<button data-action="' + action + '" ' + extra + ' class="' + cls + '">' + label + '</button>',
  status: {new:'Ожидает назначения', travel:'В пути', diagnosis:'Диагностика', repair:'Ремонт', done:'Выполнено'},
  pill: c => '<span>Приоритет ' + c.priority + '</span>',
  rub: n => n.toLocaleString('ru-RU') + ' ₽',
  shell: (title, body) => '<div><h2>' + title + '</h2>' + body + '</div>'
};

test('Map dispatcher summarizes queue and links to calls tab', () => {
  const s = E.fresh();
  assert.match(dispatcherTop(s, ui), /Район готов к работе/);
  E.start(s);
  const html = dispatcherTop(s, ui);
  assert.match(html, /Ожидают: <b>3<\/b>/);
  assert.match(html, /data-tab="calls"/);
  assert.match(html, /data-action="call"/);
  assert.match(html, /Прорыв трубы/);
});

test('Queue cards show filters, deadlines and large open action', () => {
  const s = E.fresh(); E.start(s);
  let html = dispatcherList(s, 'new', ui);
  assert.match(html, /Без бригады · 3/);
  assert.match(html, /До срока 65 мин/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-action="call"/);
  E.tick(s, 66);
  html = dispatcherList(s, 'overdue', ui);
  assert.match(html, /Срок превышен/);
  assert.match(html, /urgency-overdue/);
});

test('Assignment card explains disabled crews, ETA and shortage of money', () => {
  const s = E.fresh(); E.start(s);
  let html = dispatcherDialog(s, s.calls[0], ui);
  assert.match(html, /Прибытие ~10 мин/);
  assert.match(html, /завершение ~46 мин/);
  assert.match(html, /Другая специализация/);
  assert.match(html, /disabled/);
  assert.match(html, /Подрядчик/);
  s.money = 0;
  html = dispatcherDialog(s, s.calls[0], ui);
  assert.match(html, /Недостаточно денег на материалы/);
  assert.match(html, /Недостаточно денег для подрядчика/);
});

test('Completed application does not offer another dispatch', () => {
  const s = E.fresh(); E.start(s); E.dispatch(s, 1, 0); E.tick(s, 46);
  const html = dispatcherDialog(s, s.calls[0], ui);
  assert.match(html, /Выполнено в срок/);
  assert.doesNotMatch(html, /data-action="dispatch"/);
  assert.doesNotMatch(html, /data-action="outsource"/);
});
