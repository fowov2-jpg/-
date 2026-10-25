// Keep small saves readable. Large portfolios use a lossless table of house
// fields and interned history texts, so primary + backup fit Web Storage.
const PREFIX='UD8P1:',MAX_LENGTH=8_000_000;
const FIELDS=['id','region','trust','water','electric','structure','rate','since','outages','waterMinutes','electricMinutes','prevention'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const storedVersion=record=>record.startsWith(PREFIX)?8:JSON.parse(record).version;
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
 return PREFIX+JSON.stringify({state,texts});
}
export function storedJSON(record){
 if(typeof record!=='string'||!record.startsWith(PREFIX))return record;
 const check=v=>{if(!v)throw Error('Таблица компании повреждена');};
 check(record.length<=MAX_LENGTH);
 const {state,texts}=JSON.parse(record.slice(PREFIX.length));
 check(state?.version===8&&Array.isArray(state.operations?.houses)&&state.operations.houses.length<=1980&&Array.isArray(texts)&&texts.length<=23760&&texts.every(t=>typeof t==='string'&&t.length<=2000));
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
