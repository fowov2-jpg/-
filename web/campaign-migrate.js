import {missions} from './campaign-city.js';
// Source v4 streets were 1536×1024; v5 cuts the duplicated perimeter roads at their centres.
export function migratePoint(point){
 if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('Сохранение кампании повреждено');
 if(point[0]<0||point[0]>61440||point[1]<0||point[1]>32768)throw Error('Сохранение кампании повреждено');
 return point.map((v,i)=>{const oldStep=i===0?1536:1024,newStep=i===0?1416:874,inset=i===0?60:76;
  const tile=Math.floor(v/oldStep);return Math.max(0,tile*newStep+(v-tile*oldStep)-inset);
 });
}
export function migrateV4(s){
 if(!s||s.version!==4)return s;
 if(!Number.isSafeInteger(s.seed)||!Number.isInteger(s.region)||s.region<0||s.region>19||!Array.isArray(s.calls)||!Array.isArray(s.crews))throw Error('Сохранение кампании повреждено');
 const old=missions(s.seed,s.region,1);
 for(const c of s.calls){if(!Number.isInteger(c.mission)||!old[c.mission])throw Error('Сохранение кампании повреждено');c.spec={...old[c.mission]};if(c.path){if(!Array.isArray(c.path))throw Error('Сохранение кампании повреждено');c.path=c.path.map(migratePoint);}}
 for(const cr of s.crews){cr.point=migratePoint(cr.point);cr.angle=-Math.PI/2;}
 s.version=5;s.clock=Math.max(0,(s.day-1)*480+s.minute);return s;
}
