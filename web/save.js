import {fresh,decode,encode} from './engine.js';

// Keep the historical storage key; the JSON schema is migrated independently.
export const SAVE_KEY='upravdom.v1';
export const BACKUP_PREFIX='upravdom.corrupt.';
export function loadLocal(storage) {
  const raw=storage.getItem(SAVE_KEY);
  if(raw===null)return {state:fresh(),damaged:null};
  try {
    return {state:decode(raw),damaged:null};
  } catch {
    // Never overwrite an unreadable save on the next game tick.
    return {state:fresh(),damaged:raw};
  }
}
export function archiveAndRestart(storage,damaged,token) {
  if(typeof damaged!=='string')throw Error('Нет данных для восстановления');
  if(!Number.isSafeInteger(token)||token<0)throw Error('Некорректный номер архива');
  const key=BACKUP_PREFIX+token;
  if(storage.getItem(key)!==null)throw Error('Резервная копия уже существует');
  storage.setItem(key,damaged); // must succeed before touching primary save
  const game=fresh();
  storage.setItem(SAVE_KEY,encode(game));
  return {state:game,backupKey:key};
}
