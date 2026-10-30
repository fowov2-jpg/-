import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import * as B from '../web/buildings.js';
import {homeCard,homeDialog,systemRows} from '../web/buildings-view.js';

const copy = x => structuredClone(x);

test('New company has five independently tracked, bounded systems per building',()=>{
  const s=E.fresh();
  assert.equal(s.version,2);
  assert.equal(s.homes.length,3);
  assert.deepEqual(Object.keys(s.homes[0].systems),B.SYSTEM_KEYS);
  assert.equal(s.homes[0].wear,40);
  for(const home of s.homes)for(const key of B.SYSTEM_KEYS)
    assert.equal(home.systems[key],home.wear);
  assert.equal(B.systemForType(0),'water');
  assert.equal(B.systemForType(5),'heating');
  assert.equal(B.systemForType(7),'power');
  assert.equal(B.systemForType(14),'roof');
  assert.equal(B.systemForType(17),'grounds');
});

test('Version-one save migrates scalar wear without resetting money, calls, crews or routes',()=>{
  const s=E.fresh(); E.start(s); E.dispatch(s,1,0); E.tick(s,3);
  const old=copy(s); old.version=1;
  for(const home of old.homes)delete home.systems;
  const loaded=E.decode(JSON.stringify(old));
  assert.equal(loaded.version,2);
  assert.equal(loaded.money,old.money);
  assert.deepEqual(loaded.calls,old.calls);
  assert.deepEqual(loaded.crews,old.crews);
  for(let i=0;i<loaded.homes.length;i++)for(const key of B.SYSTEM_KEYS)
    assert.equal(loaded.homes[i].systems[key],old.homes[i].wear);
  const next=E.decode(E.encode(loaded));
  E.tick(next,50); E.tick(loaded,50);
  assert.deepEqual(next,loaded);
});

test('Damaged modern building data is rejected instead of silently repaired',()=>{
  const s=E.fresh(); delete s.homes[0].systems;
  assert.throws(()=>E.decode(E.encode(s)),/Отсутствует состояние дома/);
  s.homes[0].systems=B.initialSystems(30);
  s.homes[0].systems.power=NaN;
  assert.throws(()=>E.decode(E.encode(s)),/Некорректное состояние системы/);
  s.homes[0].systems.power=110;
  assert.throws(()=>E.decode(E.encode(s)),/Некорректное состояние системы/);
  assert.throws(()=>B.systemForType(999),/Неизвестный/);
});

test('Targeted prevention modifies only one system and charges exactly once',()=>{
  const s=E.fresh(),before=s.money;
  E.prevent(s,0,'roof');
  assert.equal(s.money,before-8000);
  assert.equal(s.homes[0].systems.roof,20);
  assert.equal(s.homes[0].systems.water,40);
  assert.equal(s.homes[0].wear,36);
  const last=s.money;
  assert.throws(()=>E.prevent(s,0,'invalid'),/Неизвестная система/);
  assert.equal(s.money,last);
  E.start(s);
  assert.throws(()=>E.prevent(s,0,'roof'),/перед сменой/);
  assert.equal(s.money,last);
});

test('Legacy full-home prevention still reduces each subsystem by 15',()=>{
  const s=E.fresh();
  E.prevent(s,0);
  assert.equal(s.homes[0].wear,25);
  assert.ok(B.SYSTEM_KEYS.every(key=>s.homes[0].systems[key]===25));
  assert.equal(s.money,3000000-12000);
  s.money=0;
  const before=E.encode(s);
  assert.throws(()=>E.prevent(s,1,'power'),/Недостаточно средств/);
  assert.equal(E.encode(s),before);
});

test('Water repair reduces water wear only, while lateness increases affected system only',()=>{
  const s=E.fresh();E.start(s);E.question(s,1);E.dispatch(s,1,0);
  E.tick(s,42);
  assert.equal(s.calls[0].status,'done');
  assert.equal(s.homes[0].systems.water,30);
  assert.equal(s.homes[0].systems.heating,40);
  assert.equal(s.homes[0].wear,38);
  const roofCall=E.spawn(s,14,0);
  E.tick(s,66);
  assert.equal(roofCall.late,true);
  assert.equal(s.homes[0].systems.roof,52);
  assert.equal(s.homes[0].systems.water,30);
  const roofWear=s.homes[0].systems.roof;
  E.tick(s,10);
  assert.equal(s.homes[0].systems.roof,roofWear);
});

test('Daily deterioration depends on deterministic weather and cannot exceed 100',()=>{
  const s=E.fresh(); E.start(s); E.tick(s,480);
  const before=copy(s.homes[0].systems);
  E.nextDay(s); // day 2 is frost
  const after=s.homes[0].systems;
  assert.equal(after.water,Math.min(100,before.water+2));
  assert.equal(after.heating,Math.min(100,before.heating+4));
  assert.equal(after.grounds,Math.min(100,before.grounds+3));
  assert.equal(after.power,Math.min(100,before.power+1));
  assert.equal(after.roof,Math.min(100,before.roof+1));
  const h=s.homes[1];
  for(const key of B.SYSTEM_KEYS)h.systems[key]=99;
  B.applyDailyWear(h,{kind:'rain'});
  assert.ok(B.SYSTEM_KEYS.every(key=>h.systems[key]===100));
  assert.equal(h.wear,100);
});

test('Poor roofing attracts more roofing incidents than healthy properties',()=>{
  const s=E.fresh();
  for(const h of s.homes){h.systems.roof=0;B.syncWear(h);}
  s.homes[2].systems.roof=100;B.syncWear(s.homes[2]);
  let badRoofCalls=0;
  for(let i=0;i<1000;i++)if(E.spawn(s,14).home===2)badRoofCalls++;
  assert.ok(badRoofCalls>650, 'risk weighted property choice: '+badRoofCalls);
});

test('Building cards show separate systems and actionable maintenance controls',()=>{
  const s=E.fresh();
  const ui={
    button:(action,body,extra='',cls='')=>'<button data-action="'+action+'" '+extra+' class="'+cls+'">'+body+'</button>',
    shell:(title,body)=>'<h2>'+title+'</h2>'+body,
    rub:n=>n.toLocaleString('ru-RU')+' ₽'
  };
  const card=homeCard(s.homes[0],ui.button);
  assert.match(card,/Водоснабжение/);
  assert.match(card,/Отопление/);
  assert.match(card,/Кровля и фасад/);
  const dialog=homeDialog(s.homes[0],'prep',s.money,ui);
  assert.match(dialog,/data-system="water"/);
  assert.match(dialog,/data-system="roof"/);
  assert.match(dialog,/Общая профилактика/);
  assert.equal((systemRows(s.homes[0]).match(/class="building-system"/g)||[]).length,5);
  const unavailable=homeDialog(s.homes[0],'active',s.money,ui);
  assert.match(unavailable,/Доступно только в подготовке/);
  assert.match(unavailable,/disabled/);
});
