import {fresh,encode,decode} from './engine.js';
export const SAVE_KEY='upravdom.v1',BACKUP_KEY='upravdom.backup.v1';
export function loadGame(storage){
 try {
  const raw=storage.getItem(SAVE_KEY);
  if(raw!==null){try{return {state:decode(raw),recovered:false,blocked:false};}catch{/* Try the independent backup. */}}
  const backup=storage.getItem(BACKUP_KEY);
  if(backup!==null){try{return {state:decode(backup),recovered:true,blocked:false};}catch{/* Preserve both damaged records. */}}
  if(raw===null&&backup===null)return {state:fresh(),recovered:false,blocked:false};
 }catch{/* Storage may be denied or unavailable. */}
 return {state:fresh(),recovered:false,blocked:true};
}
export function saveGame(storage,state){
 const next=encode(state);decode(next);
 let backup=next;
 const previous=storage.getItem(SAVE_KEY);
 if(previous!==null){try{decode(previous);backup=previous;}catch{/* Keep the recovered state as backup. */}}
 storage.setItem(BACKUP_KEY,backup);
 storage.setItem(SAVE_KEY,next);
}
export const DEFAULT_SETTINGS={sound:true,motion:true,labels:true};
export function loadSettings(storage){
 try{const v=JSON.parse(storage.getItem('upravdom.settings'));return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k,d])=>[k,typeof v?.[k]==='boolean'?v[k]:d]));}catch{return {...DEFAULT_SETTINGS};}
}
export function saveSettings(storage,settings){storage.setItem('upravdom.settings',JSON.stringify(settings));}
