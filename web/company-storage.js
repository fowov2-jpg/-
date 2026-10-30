// Keep small saves readable. Large portfolios use a lossless table of house
// fields and interned history texts, so primary + backup fit Web Storage.
import LZString from './vendor/lz-string.js';
const PREFIX='UD8P1:',TERRITORY_PREFIX='UD9L1:',MAX_LENGTH=40_000_000;
const ARCHIVE_PREFIX='UDA1:';
const FIELDS=['id','region','trust','water','electric','structure','rate','since','outages','waterMinutes','electricMinutes','prevention'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const archiveRecord=raw=>raw.length>180000?ARCHIVE_PREFIX+LZString.compressToUTF16(raw):raw;
export function archiveSource(raw){
 if(typeof raw!=='string'||!raw.startsWith(ARCHIVE_PREFIX))return raw;
 const source=LZString.decompressFromUTF16(raw.slice(ARCHIVE_PREFIX.length));
 if(typeof source!=='string'||source.length>MAX_LENGTH)throw Error('Архив компании повреждён');
 return source;
}
export const storedVersion=record=>record.startsWith(TERRITORY_PREFIX)?9:record.startsWith(PREFIX)?8:JSON.parse(record).version;
export function storageRecord(json){
 if(json.length<=180000)return json;
 if(json.length>MAX_LENGTH)throw Error('Компания слишком велика для сохранения');
 const state=JSON.parse(json),texts=[],indices=new Map();
 const textId=text=>{if(!indices.has(text)){indices.set(text,texts.length);texts.push(text);}return indices.get(text);};
 state.operations.houses=state.operations.houses.map(h=>{
  const extra=Object.fromEntries(Object.entries(h).filter(([key])=>!FIELDS.includes(key)&&key!=='history'));
  const history=h.history.map(e=>{
   const rest=Object.fromEntries(Object.entries(e).filter(([key])=>!['day','text'].includes(key)));
   return Object.keys(rest).length?[e.day,textId(e.text),rest]:[e.day,textId(e.text)];
  });
  return [...FIELDS.map(key=>h[key]),history,extra];
 });
 const table=PREFIX+JSON.stringify({state,texts});
 return state.version===9?TERRITORY_PREFIX+LZString.compressToUTF16(table):table;
}
export function storedJSON(record){
 record=archiveSource(record);
 if(typeof record==='string'&&record.startsWith(TERRITORY_PREFIX)){
  if(record.length>8_000_000)throw Error('Компания слишком велика для сохранения');
  record=LZString.decompressFromUTF16(record.slice(TERRITORY_PREFIX.length));
  if(typeof record!=='string'||!record.startsWith(PREFIX))throw Error('Таблица областей повреждена');
 }
 if(typeof record!=='string'||!record.startsWith(PREFIX))return record;
 const check=v=>{if(!v)throw Error('Таблица компании повреждена');};
 check(record.length<=MAX_LENGTH);
 const {state,texts}=JSON.parse(record.slice(PREFIX.length));
 check([8,9].includes(state?.version)&&Array.isArray(state.operations?.houses)&&state.operations.houses.length<=(state.version===9?19980:1980)&&Array.isArray(texts)&&texts.length<=(state.version===9?239760:23760)&&texts.every(t=>typeof t==='string'&&t.length<=2000));
 state.operations.houses=state.operations.houses.map(row=>{
  check(Array.isArray(row)&&row.length===14&&Array.isArray(row[12])&&row[12].length<=12&&object(row[13]));
  const history=row[12].map(e=>{
   check(Array.isArray(e)&&[2,3].includes(e.length)&&Number.isSafeInteger(e[1])&&e[1]>=0&&e[1]<texts.length&&(e.length===2||object(e[2])));
   return {...e[2],day:e[0],text:texts[e[1]]};
  });
  return {...row[13],...Object.fromEntries(FIELDS.map((key,i)=>[key,row[i]])),history};
 });
 return JSON.stringify(state);
}
