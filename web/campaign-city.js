import {TYPES} from './content-missions.js';
import {SOURCE,ADDRESS_COUNT,DISTRICT_COUNT,TW,TH,SIDE,DW,DH,ROAD_X,ROAD_Y,hash,districtOrigin} from './city-layout.js';
import {tileDesign} from './city-geography.js';
export {SOURCE,ADDRESS_COUNT,DISTRICT_COUNT,TW,TH,SIDE,DW,DH,ROAD_X,ROAD_Y,hash,districtOrigin};
export const ART=['residential.webp','nine.webp','towers.webp','mixed.webp','industrial.webp','factory-land.webp','garden.webp','brick.webp','river-straight.webp','river-bend.webp'];
export const DISTRICT_NAMES=['Северный','Садовый','Центральный','Заречный','Восточный','Промышленный','Берёзовый','Высотный','Солнечный','Вокзальный','Озёрный','Южный','Новый город','Заводской','Лесной','Западный','Парковый','Прибрежный','Академический','Столичный'];
export function tileKind(seed,d,tile){return tileDesign(seed,d,tile).kind;}
// Four address entrances per quarter; multiple entrances may belong to one long slab.
const anchors=[
 [[190,210],[580,190],[190,395],[585,385],[945,190],[1370,210],[980,390],[1310,385],[195,645],[580,665],[200,900],[585,900],[960,645],[1345,635],[960,895],[1350,895]],
 [[190,210],[420,210],[205,420],[665,340],[1020,205],[1300,205],[1030,440],[1300,440],[195,680],[655,680],[340,880],[570,880],[995,665],[1370,680],[960,820],[1200,885]],
 [[215,220],[600,195],[205,435],[650,430],[960,220],[1340,215],[1250,440],[970,425],[215,675],[595,690],[250,880],[630,880],[950,700],[1320,790],[975,880],[1120,640]],
 [[200,220],[340,215],[570,215],[670,365],[1030,200],[1260,200],[915,350],[1200,410],[190,695],[620,700],[300,875],[480,875],[970,650],[1370,715],[1000,875],[1150,820]],
 [[200,225],[380,220],[610,215],[350,410],[980,220],[1190,200],[1350,350],[920,400],[230,675],[460,710],[620,825],[250,870],[1040,650],[1330,700],[1000,870],[1250,900]],
 [[200,200],[400,200],[500,350],[250,400],[900,215],[1000,300],[1300,210],[1350,370],[215,650],[420,650],[240,875],[400,875],[1000,650],[1260,650],[1000,875],[1260,875]]
];
const streets=['Садовая','Лесная','Молодёжная','Строителей','Парковая','Рабочая','Центральная','Зелёная','Солнечная','Школьная','Полевая','Заводская','Новая','Мира','Речная','Северная'];
anchors.push(
 [[200,200],[500,170],[200,350],[550,440],[880,250],[1050,160],[1150,440],[1340,240],[170,650],[400,600],[400,870],[650,680],[900,700],[1170,600],[1260,880],[1350,760]],
 [[200,200],[500,150],[360,400],[650,230],[850,350],[1000,180],[1300,220],[1350,410],[200,620],[350,600],[250,850],[440,860],[900,700],[1100,600],[1350,750],[1100,880]],
 [[170,190],[650,200],[270,400],[680,420],[940,190],[1320,190],[950,350],[1320,350],[180,650],[700,650],[270,850],[690,850],[940,640],[1320,640],[950,850],[1350,850]],
 [[170,190],[430,200],[170,400],[600,420],[1000,180],[1380,180],[1200,410],[1380,420],[200,650],[580,650],[200,840],[600,840],[900,620],[1400,620],[900,820],[1380,820]]
);
const cache=new Map();
export function district(seed,d){
 if(!Number.isInteger(d)||d<0||d>=DISTRICT_COUNT)throw Error('Неизвестный район');
 const key=seed+':'+d;if(cache.has(key))return cache.get(key);
 const origin=districtOrigin(d),layouts=Array.from({length:64},(_,i)=>tileDesign(seed,d,i)),tiles=layouts.map(l=>l.kind);
 const homes=Array.from({length:ADDRESS_COUNT},(_,id)=>{
  const tile=Math.floor(id/16),col=tile%SIDE,row=Math.floor(tile/SIDE),layout=layouts[tile],kind=layout.river?layout.kind:layout.quarters[Math.floor(id%16/4)],a=anchors[kind][id%16];
  const ax=a[0]-SOURCE.x,x=origin[0]+col*TW+(layout.river?.flip?TW-ax:ax),y=origin[1]+row*TH+a[1]-SOURCE.y,j=hash(seed+d*999,id);
  return {id,globalId:d*ADDRESS_COUNT+id,district:d,name:`ул. ${streets[(Math.floor(id/32)+d)%streets.length]}, ${Math.floor(id/16)+1}, корп. ${id%16+1}`,x,y,
   floors:kind===2?16:kind===1?9:kind===4||kind===5?1+j%4:kind===3?[5,9,16][j%3]:kind>=7?[5,9][j%2]:5,kind,tile};
 });
 const result={id:d,seed,name:DISTRICT_NAMES[d],origin,tiles,layouts,homes};cache.set(key,result);return result;
}
function axes(value,step,offsets){const tile=Math.floor(value/step);return offsets.flatMap(o=>[-1,0,1].map(t=>(tile+t)*step+o));}
export function roadStop(home){
 const xs=axes(home.x,TW,ROAD_X),ys=axes(home.y,TH,ROAD_Y);
 const x=xs.reduce((a,b)=>Math.abs(a-home.x)<Math.abs(b-home.x)?a:b),y=ys.reduce((a,b)=>Math.abs(a-home.y)<Math.abs(b-home.y)?a:b);
 return Math.abs(x-home.x)<Math.abs(y-home.y)?[x,home.y]:[home.x,y];
}
function onVertical(p){return ROAD_X.some(x=>Math.abs(((p[0]%TW)+TW)%TW-x)<.001);}
function nearestAxis(v,step,os){return axes(v,step,os).reduce((a,b)=>Math.abs(a-v)<Math.abs(b-v)?a:b);}
export function streetRoute(a,b){
 if(a[0]===b[0]&&a[1]===b[1])return [[...a]];
 let path;
 if(onVertical(a)&&onVertical(b)){const y=nearestAxis((a[1]+b[1])/2,TH,ROAD_Y);path=[a,[a[0],y],[b[0],y],b];}
 else if(!onVertical(a)&&!onVertical(b)){const x=nearestAxis((a[0]+b[0])/2,TW,ROAD_X);path=[a,[x,a[1]],[x,b[1]],b];}
 else if(onVertical(a))path=[a,[a[0],b[1]],b];else path=[a,[b[0],a[1]],b];
 return path.filter((p,i)=>!i||p.some((v,j)=>v!==path[i-1][j])).map(p=>[...p]);
}
export function pathLength(p){return p.slice(1).reduce((s,b,i)=>s+Math.hypot(b[0]-p[i][0],b[1]-p[i][1]),0);}
export function pathPose(path,progress){
 let left=pathLength(path)*Math.max(0,Math.min(1,progress)),angle=-Math.PI/2;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.000001)continue;angle=Math.atan2(b[1]-a[1],b[0]-a[0]);if(left<=l+.000001){const t=Math.min(1,left/l);return {point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],angle};}left-=l;}
 return {point:[...path.at(-1)],angle};
}
export function depot(seed,d){const [x,y]=districtOrigin(d);return [x+708,y+434];}
// Separate curbside positions along the EXISTING vertical district road.
// 708 is a real road axis. No extra painted parking polygons are permitted.
// Cars are placed beside the curb, not on the crossroads or another vehicle.
export function parkingBay(seed,d,slot){
 const [x,y]=depot(seed,d);
 const side=Math.floor(slot/4)%2===0?1:-1;
 const row=slot%4;
 return [x+side*14,y+105+row*119];
}

export function missionOrder(seed,d){const ids=Array.from({length:ADDRESS_COUNT},(_,i)=>i);for(let i=ids.length-1;i>0;i--){const j=hash(seed+d*997,i)%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
const locations=['подвал, секция А','второй подъезд','технический этаж','дворовой фасад','вход со двора','служебная часть здания','первый подъезд'];
export function missions(seed,d,balance=2){const city=district(seed,d);return city.homes.map((home,i)=>{
 const type=(i+hash(seed,d)%20)%20,variant=Math.floor(i/20),scene=TYPES[type],cause=scene.causes[Math.floor(variant/7)%scene.causes.length],place=scene.places?.[variant%7]??locations[variant%7],scope=1+hash(seed+d,i)%6;
 // Heavy pipes, pumps, roofs and stairs grow with district complexity; small service jobs stay viable for compact vans/lifts.
 const quantity=balance===1?Math.min(7,2+scope):2+scope+([0,2,6,12,14,18].includes(type)?Math.floor(d/3):0),materialsCost=quantity*[1400,1100,1800][scene.service];
 const fee=5000+(scene.duration+scope*2)*40+scene.priority*400;
 return {id:d*ADDRESS_COUNT+i,home:i,type,title:`${scene.title} · ${place}`,brief:`${cause}. Место: ${place}. Объём работ (${scene.unit}): ${scope}. ${scene.access[variant%scene.access.length]}`,
  answer:`Осмотр подтвердил: ${cause.toLowerCase()}. ${scene.action}. Контроль результата: ${scene.check}.`,action:scene.action,service:scene.service,priority:scene.priority,
  quantity,duration:scene.duration+scope*2,deadline:[180,120,80][scene.priority-1],reward:balance===1?18000+scope*3200+scene.priority*2500:materialsCost+fee,...(balance===1?{}:{materialsCost,fee}),homeName:home.name};});}
