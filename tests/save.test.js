import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../web/engine.js';
import {SAVE_KEY,BACKUP_PREFIX,loadLocal,archiveAndRestart} from '../web/save.js';

function storageOf(entries=[]) {
  const map=new Map(entries);
  return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))};
}

test('Empty local storage starts a new version-two company',()=>{
  const storage=storageOf();
  const loaded=loadLocal(storage);
  assert.equal(loaded.damaged,null);
  assert.equal(loaded.state.version,2);
  assert.equal(storage.getItem(SAVE_KEY),null);
});

test('Readable version-one progress migrates without creating a backup',()=>{
  const game=E.fresh(); game.version=1;
  for(const home of game.homes)delete home.systems;
  game.money=12345;
  const storage=storageOf([[SAVE_KEY,JSON.stringify(game)]]);
  const loaded=loadLocal(storage);
  assert.equal(loaded.damaged,null);
  assert.equal(loaded.state.version,2);
  assert.equal(loaded.state.money,12345);
  assert.equal(loaded.state.homes[0].systems.water,40);
  // Reading does not overwrite the old JSON until the game saves.
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).version,1);
});

test('Corrupted progress remains untouched until archive-and-restart is requested',()=>{
  const damaged='{"version":2,"homes":[';
  const storage=storageOf([[SAVE_KEY,damaged]]);
  const loaded=loadLocal(storage);
  assert.equal(loaded.damaged,damaged);
  assert.equal(storage.getItem(SAVE_KEY),damaged);
  assert.equal(loaded.state.version,2);
  const restarted=archiveAndRestart(storage,loaded.damaged,20261030);
  assert.equal(restarted.backupKey,BACKUP_PREFIX+'20261030');
  assert.equal(storage.getItem(restarted.backupKey),damaged);
  assert.equal(E.decode(storage.getItem(SAVE_KEY)).version,2);
});

test('Failure to create a backup cannot destroy old progress',()=>{
  const damaged='corrupt json';
  const storage=storageOf([[SAVE_KEY,damaged]]);
  const realSet=storage.setItem;
  storage.setItem=(key,value)=>{
    if(key.startsWith(BACKUP_PREFIX))throw Error('QuotaExceededError');
    return realSet(key,value);
  };
  assert.throws(()=>archiveAndRestart(storage,damaged,1),/QuotaExceededError/);
  assert.equal(storage.getItem(SAVE_KEY),damaged);
});

test('Existing archive keys cannot be overwritten and missing raw data is rejected',()=>{
  const damaged='x';
  const storage=storageOf([[SAVE_KEY,damaged],[BACKUP_PREFIX+'7','old backup']]);
  assert.throws(()=>archiveAndRestart(storage,damaged,7),/уже существует/);
  assert.equal(storage.getItem(BACKUP_PREFIX+'7'),'old backup');
  assert.equal(storage.getItem(SAVE_KEY),damaged);
  assert.throws(()=>archiveAndRestart(storage,null,10),/Нет данных/);
});
