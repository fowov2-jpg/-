import {COLORS,TYPES} from './engine.js';
import {drawGameSprite} from './assets.js';
import {BUILDINGS,ROADS,COURTYARDS,GARDEN_BEDS,TREES,STREET_PROPS,STOPS,PARKING_BAYS,ENTRANCES,route as districtRoute,crewRoute} from './district.js';
import {drawApartment,drawTree,drawVan,drawStreetFurniture,drawPlayground,drawSportCourt} from './scenery.js';

// Shared geometry determines roads, landmarks and interactive stops.
const houses=BUILDINGS.filter(b=>Number.isInteger(b.managed)).map(b=>[b.x,b.y]);
const stops=STOPS;
const neighbors=BUILDINGS.filter(b=>!Number.isInteger(b.managed));
const iso=(x,y,z=0)=>[500+(x-y)*49,100+(x+y)*27-z];
const mix=(a,b,t)=>a+(b-a)*t;
const noise=n=>((Math.sin(n*127.1+78.233)*43758.5453)%1+1)%1;

export const route=districtRoute;
// Summer/autumn PNG foliage must not override the winter procedural canopy.
export const useFoliageSprite=winter=>!winter;
function bearingFromSegment(a,b){
 if(b[0]>a[0]+.00001)return 'east';
 if(b[0]<a[0]-.00001)return 'west';
 if(b[1]>a[1]+.00001)return 'south';
 return 'north';
}
// The direction and movement are both evaluated from the *same* road polyline.
export function vehiclePose(crew,state){
 const start=crew.home===3?(PARKING_BAYS[crew.id]||PARKING_BAYS[0]):(stops[crew.home]||stops[3]);
 if(crew.status!=='travel')return {point:start,heading:crew.home===2?'south':'east'};
 const call=state.calls.find(c=>c.id===crew.job);
 if(!call)return {point:start,heading:'east'};
 const points=crewRoute(crew,call.home);
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const total=lengths.reduce((n,d)=>n+d,0);
 let travelled=total*(1-Math.max(0,Math.min(1,crew.remaining/Math.max(1,crew.total))));
 for(let i=0;i<lengths.length;i++){
  const distance=lengths[i];
  if(travelled<=distance||i===lengths.length-1){
   const ratio=distance?Math.min(1,travelled/distance):0;
   return {
    point:[mix(points[i][0],points[i+1][0],ratio),mix(points[i][1],points[i+1][1],ratio)],
    heading:bearingFromSegment(points[i],points[i+1])
   };
  }
  travelled-=distance;
 }
 return {point:points.at(-1),heading:'east'};
}
export function vehiclePosition(crew,state){return vehiclePose(crew,state).point;}

export function renderMap(canvas,state,view){
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const dpr=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2);
 const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const winter=(Math.floor((state.day-1)/7)%4)===0;
 const sky=ctx.createLinearGradient(0,0,rect.width,rect.height);
 sky.addColorStop(0,winter?'#809aa8':'#6e8b78');
 sky.addColorStop(.6,winter?'#506a72':'#3d685f');
 sky.addColorStop(1,'#172f3b');
 ctx.fillStyle=sky;ctx.fillRect(0,0,rect.width,rect.height);

 // Portrait layouts show a cropped district, rather than shrinking the city into a tiny diamond.
 const scale=Math.max(rect.width/1000,rect.height/1070)*view.zoom;
 const ox=rect.width/2-500*scale+view.x;
 const oy=rect.height/2-440*scale+view.y;
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 view.project=p=>[p[0]*scale+ox,p[1]*scale+oy];
 view.hits=[];
 ctx.lineJoin='round';ctx.lineCap='round';
 const poly=(points,fill,stroke=null,lineWidth=1)=>{
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
 };
 const line=(points,color,lineWidth=2,dash=[])=>{
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
 };
 const tile=(x,y,w,h,fill,stroke=null)=>poly(
  [iso(x,y),iso(x+w,y),iso(x+w,y+h),iso(x,y+h)],fill,stroke
 );
 const dot=(x,y,r,fill)=>{
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
 };
 const lerp=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
 function tag(text,p,tint='#0a2030e8',size=12){
  ctx.save();ctx.font='650 '+size+'px system-ui, sans-serif';
  const tw=Math.ceil(ctx.measureText(text).width),w=tw+20;
  ctx.shadowColor='#04111acf';ctx.shadowBlur=10;ctx.shadowOffsetY=3;
  ctx.fillStyle=tint;ctx.beginPath();ctx.roundRect(p[0]-w/2,p[1]-25,w,24,7);ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#edf9ff';ctx.fillText(text,p[0],p[1]-13);
  ctx.restore();
 }
 function lamp(x,y){
  const p=iso(x,y),top=[p[0],p[1]-31];
  line([p,top],'#47545b',3);
  ctx.save();ctx.shadowBlur=14;ctx.shadowColor='#ffe7a7';
  dot(top[0],top[1],4,'#ffe3a0');ctx.restore();
 }

 function tree(x,y,i){
  const p=iso(x,y);
  const treeType=i%3===0?'tree_pine':i%3===1?'tree_autumn':'tree_green';
  ctx.save();
  ctx.fillStyle='#091d2660';ctx.beginPath();
  ctx.ellipse(p[0]+9,p[1]+7,21,8,-.25,0,Math.PI*2);ctx.fill();
  ctx.restore();
  if(useFoliageSprite(winter)&&drawGameSprite(ctx,canvas,treeType,p[0]-35,p[1]-82,70,94))return;
  drawTree(ctx,iso,x,y,i,winter);
 }
 function car(x,y,rotation,color,service=false,serviceIndex=0,heading='east'){
  const p=iso(x,y,0);
  const base=['van_water','van_electric','van_repair'][serviceIndex]||'van_water';
  const asset=heading==='east'?base:base+'_'+heading;
  // Ground-contact anchor: PNG tires end at the road coordinate, not mid-air.
  ctx.save();ctx.fillStyle='#071a2399';ctx.beginPath();
  ctx.ellipse(p[0]+4,p[1],24,7,-.17,0,Math.PI*2);ctx.fill();ctx.restore();
  if(service&&drawGameSprite(ctx,canvas,asset,p[0]-37,p[1]-48,74,49))return;
  drawVan(ctx,iso,x,y,rotation,color,service,view.animation||0);
 }
 function apartment(b){
  const {x,y,id:i}=b,managed=Number.isInteger(b.managed);
  const height=managed?119:99+(i%2)*5,p=iso(x,y,0);
  // The footprint is planted inside the authored residential lot.
  ctx.save();ctx.fillStyle='#0b273360';ctx.beginPath();
  ctx.ellipse(p[0]+12,p[1]+5,85,23,-.12,0,Math.PI*2);ctx.fill();ctx.restore();
  const rendered=drawGameSprite(ctx,canvas,'house_0'+((i%4)+1),
    p[0]-112,p[1]-165,224,165);
  if(!rendered)drawApartment(ctx,iso,x,y,i,managed,winter);
  if(managed){
   tag(state.homes[b.managed].name,iso(x,y,height+20),undefined,11);
   view.hits.push({point:view.project(iso(x,y,height*.55)),home:b.managed});
  }else if(i<6)tag(b.name,iso(x,y,height+16),undefined,10);
 }

 // Natural-looking continuous ground, replacing the previous chessboard terrain.
 tile(-8,-8,27,27,winter?'#647d77':'#698765');
 for(let k=0;k<420;k++){
  const gx=-7+noise(k*7+81)*25,gy=-7+noise(k*13+219)*25;
  const p=iso(gx,gy);
  const size=1.8+noise(k*21+6)*5.8;
  const shade=winter?['#9db0a4','#506b67','#839895','#b9c6bd']:
   ['#52795b','#879e6d','#a79868','#3f755c'];
  ctx.save();ctx.globalAlpha=.12+.15*noise(k*9+28);
  ctx.fillStyle=shade[k%shade.length];ctx.beginPath();
  ctx.ellipse(p[0],p[1],size*2,size*.9,.3,0,Math.PI*2);ctx.fill();
  ctx.restore();
 }

 // Designed parcels and streets: no random buildings, parking or vehicles.
 for(const b of BUILDINGS){
  tile(b.x-1.76,b.y-1.29,3.52,2.58,winter?'#8b9a91':'#9a9d8b','#cad3c5');
 }
 for(const p of COURTYARDS){
  tile(p.x-.10,p.y-.10,p.w+.20,p.h+.20,winter?'#97a49c':'#86a186');
 }
 // Small landscaped beds provide visual relief on previously empty lawns.
 // Their geometry is authored in district.js and checked for road clearance.
 for(const [i,bed] of GARDEN_BEDS.entries()){
  const {x,y,w,h}=bed;
  tile(x,y,w,h,winter?'#829188':'#8d9276','#b5b9a0');
  tile(x+.08,y+.08,w-.16,h-.16,winter?'#627b72':'#456d4e');
  const count=Math.max(4,Math.round(w*h*9));
  for(let j=0;j<count;j++){
   const bx=x+.14+(w-.28)*noise(i*43+j*11+7);
   const by=y+.14+(h-.28)*noise(i*37+j*17+19);
   const p=iso(bx,by);
   dot(p[0]+2,p[1]+2,4,'#193a3177');
   dot(p[0],p[1]-2,4.3,winter?'#718d80':['#365d42','#527e4b','#637e42'][j%3]);
   dot(p[0]-2,p[1]-4,2.1,winter?'#a5b5a6':'#85a15d');
   if(j%4===0)dot(p[0]+1,p[1]-5,1.5,winter?'#e7ebe2':'#edbe75');
  }
 }
 // A sparse road network encloses the blocks rather than cutting through them.
 for(const r of ROADS){
  const x=r.axis==='x'?r.at-.72:r.from;
  const y=r.axis==='y'?r.at-.72:r.from;
  const w=r.axis==='x'?1.44:r.to-r.from;
  const h=r.axis==='y'?1.44:r.to-r.from;
  tile(x,y,w,h,'#aab5ae');
  const ax=r.axis==='x'?r.at-.60:r.from;
  const ay=r.axis==='y'?r.at-.60:r.from;
  tile(ax,ay,r.axis==='x'?1.20:r.to-r.from,r.axis==='y'?1.20:r.to-r.from,'#354957');
  const a=r.axis==='x'?[iso(r.at,r.from),iso(r.at,r.to)]:
                      [iso(r.from,r.at),iso(r.to,r.at)];
  line(a,'#e5e5d6a2',2.2,[15,22]);
 }
 // Three signed pull-in spaces keep vans separated from the travel lanes.
 tile(4.00,7.20,4.15,.66,'#65757a','#b6bfb3');
 for(let slot=0;slot<4;slot++){
  const bx=4.10+slot*1.03;
  line([iso(bx,7.22),iso(bx,7.83)],'#efeddfa8',2.2);
 }
 // Each managed entrance has a pedestrian connector ending at the curb
 // used by its service vehicle; walking paths may not jump to another street.
 for(const access of ENTRANCES){
  line([iso(...access.door),iso(...access.curb)],'#a1afa4',14);
  line([iso(...access.door),iso(...access.curb)],'#e8dfc9',7);
 }
 // Actual road crossings, not zebra markings through courtyards.
 for(const [x,y,axis] of [[0,8,'x'],[8,8,'y'],[0,0,'x'],[8,0,'y']]){
  for(let n=-2;n<=2;n++){
   if(axis==='x')tile(x-.51+n*.2,y-.41,.12,.82,'#dde8e0b3');
   else tile(x-.41,y-.51+n*.2,.82,.12,'#dde8e0b3');
  }
 }
 // Controlled depth order makes trees, courtyards and building facades agree.
 // Route light stays on asphalt beneath real-world buildings and canopies.
 for(const cr of state.crews){
  if(cr.status!=='travel')continue;
  const job=state.calls.find(call=>call.id===cr.job);
  if(!job)continue;
  const points=crewRoute(cr,job.home).map(p=>iso(p[0],p[1],3));
  ctx.save();ctx.shadowColor=COLORS[cr.service];ctx.shadowBlur=14;
  line(points,COLORS[cr.service]+'9a',8);ctx.restore();
  line(points,'#112534c8',4);
  ctx.lineDashOffset=-(view.animation||0)*15;
  line(points,COLORS[cr.service],2.8,[9,7]);ctx.lineDashOffset=0;
 }
 // Every vehicle shares the same painter's-order pass as houses and trees.
 // A van behind a house cannot be rendered on that house's roof.
 const crewLabels=[];
 const scene=[
  ...BUILDINGS.map(b=>({depth:b.x+b.y,draw:()=>apartment(b)})),
  ...TREES.map(([x,y],i)=>({depth:x+y,draw:()=>tree(x,y,i)})),
  ...STREET_PROPS.map(([x,y],i)=>({depth:x+y,draw:()=>drawStreetFurniture(ctx,iso,x,y,i,winter)})),
  ...COURTYARDS.map(c=>({depth:c.x+c.y+.8,draw:()=>
    c.kind==='playground'?drawPlayground(ctx,iso,c.x,c.y,winter):
      drawSportCourt(ctx,iso,c.x,c.y,winter)}))
 ];
 for(const cr of state.crews){
  const pose=vehiclePose(cr,state);
  const [vx,vy]=pose.point;
  scene.push({depth:vx+vy+.05,draw:()=>
   car(vx,vy,0,COLORS[cr.service],true,cr.service,pose.heading)});
  if(cr.status==='travel'){
   crewLabels.push({point:iso(vx,vy,42),
    label:['Сантехники','Электрики','Ремонтники'][cr.service]+' · '+cr.remaining+' мин'});
  }
 }
 scene.sort((a,b)=>a.depth-b.depth);
 scene.forEach(o=>o.draw());
 for(const [x,y] of [[.83,1.0],[7.15,1.1],[.83,7.0],[7.15,7.1],
   [9,7.1],[13.8,7.1],[1.0,9.0],[7.1,12.3]])lamp(x,y);
 crewLabels.forEach(c=>tag(c.label,c.point,'#0b2335ee',12));
 // Large neon incident markers remain touch targets.
 for(let i=0;i<houses.length;i++){
  const calls=state.calls.filter(c=>c.home===i&&c.status!=='done');
  if(!calls.length)continue;
  const c=calls.sort((a,b)=>b.priority-a.priority)[0];
  const type=TYPES[c.type][1],p=iso(houses[i][0],houses[i][1],142),color=COLORS[type];
  const pulse=(view.animation||0),glow=1+Math.sin(pulse*2.8+i*1.5)*.13;
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=22+7*glow;
  dot(p[0],p[1],22*glow,color);ctx.restore();
  dot(p[0],p[1],17,'#0b2737');
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p[0],p[1],19,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(['●','ϟ','⚒'][type],p[0],p[1]);
  view.hits.unshift({point:view.project(p),call:c.id});
 }
 // Low-opacity weather particles, purely visual: never alter simulation state.
 if(winter){
  const animation=view.animation||0;
  ctx.save();
  for(let k=0;k<42;k++){
   const px=(noise(k*17+3)*1120+animation*(4+k%3))%1120;
   const py=(noise(k*21+9)*1020+animation*(8+k%5))%1020;
   ctx.globalAlpha=.16+.22*noise(k+13);
   dot(px,py,k%4===0?2:1,'#ecf7ff');
  }
  ctx.restore();
 }
 ctx.restore();
}
