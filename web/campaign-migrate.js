import {missions,district,roadStop,streetRoute,pathLength,DW,DH} from './campaign-city.js';
import {VEHICLE_MODELS} from './content.js';
import {drivingPose} from './vehicle-motion.js';
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
export function migrateV5(s){
 if(!s||s.version!==5)return s;
 if(!Number.isInteger(s.region)||s.region<0||s.region>19||!Array.isArray(s.calls)||!Array.isArray(s.crews)||!Array.isArray(s.vehicles))throw Error('Сохранение кампании повреждено');
 const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=DW*5&&p[1]>=0&&p[1]<=DH*4;
 if(!s.crews.every(cr=>cr&&validPoint(cr.point))||!s.calls.every(c=>c&&(c.status==='new'||Array.isArray(c.path)&&c.path.length>0&&c.path.length<=4&&c.path.every(validPoint))))throw Error('Сохранение кампании повреждено');
 const city=district(s.seed,s.region);
 for(const c of s.calls){
  if(c.status==='new')continue;
  const cr=s.crews.find(cr=>cr.id===c.crew),home=city.homes[c.mission];if(!cr||!home||!Array.isArray(c.path)||!c.path.length)throw Error('Сохранение кампании повреждено');
  const target=roadStop(home);
  if(c.status==='travel'){
   if(!Number.isFinite(c.total)||c.total<=0||!Number.isFinite(c.remaining)||c.remaining<=0||c.remaining>c.total||!c.path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Сохранение кампании повреждено');
   const pose=drivingPose(c.path,1-c.remaining/c.total),model=VEHICLE_MODELS.find(m=>m.id===s.vehicles.find(v=>v.id===cr.vehicle)?.model);if(!model)throw Error('Сохранение кампании повреждено');
   const oldRemaining=c.remaining;cr.point=pose.point;cr.angle=pose.angle;c.path=streetRoute(cr.point,target);c.remaining=c.total=Math.max(3,Math.ceil(pathLength(c.path)/(300*model.speed)));c.due+=Math.max(0,c.remaining-oldRemaining);
  }else{cr.point=target;c.path=[target];}
 }
 s.version=6;return s;
}
