import {COLORS,TYPES} from './engine.js';
import {CITY_HOMES,DEPOT} from './content.js';
import {SECTION_WIDTH,DEFAULT_PREVIEW_HOMES,boundsForHomes,generateDistrictHomes} from './district-generator.js';
import {WORLD,DISTRICT_HEIGHT,MARKERS,route,onRoute,isTransfer} from './roads.js';
export {route} from './roads.js';
const art=[],contexts=new WeakMap(),plans=new Map();let atlas=null,requested=false;
const sources=['neighborhood.webp','central.webp','riverside.webp'];
export function loadArtwork(onLoad){
 if(requested)return;requested=true;
 sources.forEach((name,d)=>{const image=new Image();art[d]=image;image.onload=onLoad;image.onerror=()=>{if(d){art[d]=art[0];onLoad();}};image.src=new URL('./assets/'+name,import.meta.url).href;});
 atlas=new Image();atlas.onload=onLoad;atlas.src=new URL('./assets/fleet-atlas.webp',import.meta.url).href;
}
const titles=['Сантехники','Электрики','Ремонтная бригада'],modelRows={van:0,express:1,truck:2};
const addressPoints=[[225,235],[670,365],[820,860],[135,570]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Clamp the camera to the entire horizontal district, not just one picture.
export function cameraFor(width,height,view){
 const bounds=boundsForHomes(view.plannedHomes??DEFAULT_PREVIEW_HOMES);
 const scale=Math.max(width/WORLD.width,height/WORLD.height)*clamp(view.zoom,1,2.7),district=view.district??0;
 const center=view.focus?[view.focus[0],view.focus[1]-district*DISTRICT_HEIGHT]:[500,750];
 const initialX=width/2-center[0]*scale,initialY=height/2-center[1]*scale;
 const x=clamp(initialX+view.x,width-bounds.maxX*scale,-bounds.minX*scale),y=clamp(initialY+view.y,height-WORLD.height*scale,0);
 view.x=x-initialX;view.y=y-initialY;view.zoom=clamp(view.zoom,1,2.7);
 return {scale,x,y,district,left:x+bounds.minX*scale,top:y,right:x+bounds.maxX*scale,
  bottom:y+WORLD.height*scale,...bounds};
}
function plannedHomes(district,count){
 const key=district+':'+count;
 if(!plans.has(key))plans.set(key,generateDistrictHomes(district,count));
 return plans.get(key);
}
function contextFor(canvas){
 let result=contexts.get(canvas);if(result)return result;
 const labels=document.createElement('div');labels.className='mapLabels';canvas.after(labels);
 const nodes=CITY_HOMES.map(home=>{const node=document.createElement('button');node.className='mapAddress';node.dataset.action='home';node.dataset.id=home.id;node.textContent=home.name;labels.appendChild(node);return node;});
 result={ctx:canvas.getContext('2d'),nodes};contexts.set(canvas,result);return result;
}
function parkingPoint(state,vehicleId){
 const bay=Math.max(0,state.vehicles.findIndex(v=>v.id===vehicleId)),point=route(DEPOT,DEPOT)[0];
 point[0]+=(bay%3-1)*72;point[1]+=-100+Math.floor(bay/3)*50+(bay%3-1)*28;return point;
}
export function vehiclePose(state,cr,progress=0){
 const call=state.calls.find(c=>c.id===cr.job),moving=cr.status==='travel'&&call,path=moving?route(cr.home,call.home):route(cr.home,cr.home);
 if(moving&&cr.home===DEPOT)path.unshift(parkingPoint(state,cr.vehicle));
 const loc=onRoute(path,moving?(cr.total-cr.remaining+progress)/cr.total:1),vehicle=state.vehicles.find(v=>v.id===cr.vehicle);
 const last=call||state.calls.filter(c=>c.crew===cr.id&&c.status==='done').at(-1);
 if(!moving&&last?.origin!==undefined){const arrival=route(last.origin,cr.home);if(arrival.length>1)loc.angle=onRoute(arrival,1).angle;}
 if(cr.status==='idle'&&cr.home===DEPOT){loc.point=parkingPoint(state,cr.vehicle);loc.angle=-2.55;}
 return {...loc,path,moving:!!moving,model:vehicle.model};
}
export function renderMap(canvas,state,view,{labels=true,motion=true,progress=0,now=0}={}){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(globalThis.devicePixelRatio||1,2),{ctx,nodes}=contextFor(canvas);if(!ctx)return;
 if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
 const camera=cameraFor(rect.width,rect.height,view),{scale,x:ox,y:oy,district}=camera,offset=district*DISTRICT_HEIGHT;
 view.project=p=>[p[0]*scale+ox,(p[1]-offset)*scale+oy];view.scale=scale;view.hits=[];view.pick=null;view.mode='illustrated';canvas.dataset.coverage=JSON.stringify(camera);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
 const picture=art[district]?.complete&&art[district].naturalWidth?art[district]:art[0];
 if(picture?.complete&&picture.naturalWidth){
  // Mirror alternate sections: neighboring WebP edge pixels line up without seams.
  // Only visible sections are painted; a 999-home district never allocates a giant bitmap.
  const first=Math.max(camera.minTile,Math.floor(-ox/(SECTION_WIDTH*scale))-1);
  const last=Math.min(camera.maxTile,Math.floor((rect.width-ox)/(SECTION_WIDTH*scale))+1);
  const w=SECTION_WIDTH*scale,h=WORLD.height*scale;
  for(let tile=first;tile<=last;tile++){
   const left=ox+tile*w;
   if(Math.abs(tile)%2){
    ctx.save();ctx.translate(left+w,0);ctx.scale(-1,1);ctx.drawImage(picture,0,oy,w,h);ctx.restore();
   }else ctx.drawImage(picture,left,oy,w,h);
  }
  canvas.dataset.renderer='illustrated';
 }else{canvas.dataset.renderer='loading';ctx.fillStyle='#0b242b';ctx.fillRect(0,0,rect.width,rect.height);}
 canvas.dataset.plannedHomes=String(view.plannedHomes??DEFAULT_PREVIEW_HOMES);
 canvas.dataset.vehicles=atlas?.complete&&atlas.naturalWidth?'ready':'loading';
 function visible(p,margin=70){return p[0]>-margin&&p[0]<rect.width+margin&&p[1]>-margin&&p[1]<rect.height+margin;}
 function local(p){return p[1]>=offset&&p[1]<=offset+WORLD.height;}
 function line(path,color){
  for(let j=1;j<path.length;j++){
   if(!local(path[j-1])||!local(path[j])||isTransfer(path[j-1],path[j]))continue;
   const a=view.project(path[j-1]),b=view.project(path[j]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);ctx.strokeStyle=color+'45';ctx.lineWidth=8;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle=color;ctx.lineWidth=2.6;ctx.stroke();ctx.strokeStyle='#fffbdc';ctx.lineWidth=1.1;ctx.setLineDash([4,5]);ctx.lineDashOffset=motion?-now/110:0;ctx.stroke();ctx.setLineDash([]);
  }
 }
 for(const cr of state.crews){
  const call=state.calls.find(c=>c.id===cr.job);if(cr.status==='travel'&&call)line(route(cr.home,call.home),COLORS[cr.service]);
 }
 for(const home of state.homes){
  const node=nodes[home.id],belongs=home.district===district,p=view.project([addressPoints[home.id%4][0],addressPoints[home.id%4][1]+offset]);
  node.hidden=!labels||!belongs||!visible(p,0);const half=(node.offsetWidth||110)/2+6;node.style.left=clamp(p[0],half,rect.width-half)+'px';node.style.top=clamp(p[1],15,rect.height-15)+'px';node.classList.toggle('owned',home.active);node.title=home.active?'Доверие жителей '+home.loyalty+'%':'Новый договор';
  if(belongs&&visible(view.project(MARKERS[home.id]),45))view.hits.push({point:view.project(MARKERS[home.id]),home:home.id,radius:40});
 }
 // Preview-only houses are distinct from gameplay contracts and cannot be clicked.
 if(labels){
  ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const home of plannedHomes(district,view.plannedHomes??DEFAULT_PREVIEW_HOMES)){
   if(!home.planned)continue;
   const p=view.project([home.x,home.y]);if(!visible(p,40))continue;
   const label='План №'+(home.slot+1),w=ctx.measureText(label).width+14;
   ctx.fillStyle='#09242edb';ctx.strokeStyle='#d6bf82bb';ctx.lineWidth=1;
   ctx.beginPath();ctx.roundRect(p[0]-w/2,p[1]-12,w,24,5);ctx.fill();ctx.stroke();
   ctx.fillStyle='#f7dfaa';ctx.fillText(label,p[0],p[1]);
  }
 }
 const poses=[],captionBoxes=[];
 const obstacles=state.calls.filter(c=>c.status!=='done'&&state.homes[c.home].district===district).map(c=>{const p=view.project(MARKERS[c.home]);return {x:p[0]-30,y:p[1]-30,w:60,h:70};});
 for(const n of canvas.parentElement.querySelectorAll('#mapTop,.zoom button,#mapBottom,.mapAddress:not([hidden])')){const r=n.getBoundingClientRect();if(r.width&&r.height)obstacles.push({x:r.left-rect.left,y:r.top-rect.top,w:r.width,h:r.height});}
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 for(const cr of state.crews){
  const loc=vehiclePose(state,cr,progress),moving=loc.moving;poses.push({id:cr.id,point:loc.point,angle:loc.angle,transfer:!!loc.transfer});if(loc.transfer||!local(loc.point))continue;
  const point=view.project(loc.point);if(!visible(point))continue;
  const row=modelRows[loc.model]??0,angle=loc.angle;
  drawVehicle(ctx,point,angle,row,scale,COLORS[cr.service]);
  if(cr.status!=='idle'){
   const eta=moving?cr.remaining+' мин':cr.status==='diagnosis'?'Диагностика':'Ремонт',text=titles[cr.service]+' · '+eta;
   ctx.font='600 10px system-ui';const w=ctx.measureText(text).width+20;
   const candidates=[-46,28,-78,60,-110,92].flatMap(dy=>[16,-w-16,-w/2].map(dx=>({x:clamp(point[0]+dx,5,rect.width-w-5),y:clamp(point[1]+dy,8,rect.height-30),w,h:24})));
   const box=candidates.reduce((best,next)=>obstacles.reduce((n,o)=>n+overlap(next,o),0)<obstacles.reduce((n,o)=>n+overlap(best,o),0)?next:best),lx=box.x,ly=box.y;obstacles.push({...box,x:lx-3,y:ly-3,w:w+6,h:30});captionBoxes.push(box);
   ctx.fillStyle='#061e28f2';ctx.strokeStyle=COLORS[cr.service]+'aa';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(lx,ly,w,24,6);ctx.fill();ctx.stroke();ctx.fillStyle=COLORS[cr.service];ctx.beginPath();ctx.arc(lx+7,ly+12,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eff5ef';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,lx+14,ly+12);
  }
 }
 canvas.dataset.fleet=JSON.stringify(poses);canvas.dataset.captions=JSON.stringify(captionBoxes);
 const active=state.calls.filter(c=>c.status!=='done');
 for(const home of CITY_HOMES.filter(h=>h.district===district)){
  const calls=active.filter(c=>c.home===home.id).sort((a,b)=>(a.status==='blocked')-(b.status==='blocked')||b.priority-a.priority||a.due-b.due);if(!calls.length)continue;
  const c=calls[0],service=TYPES[c.type][1],color=COLORS[service],p=view.project(MARKERS[home.id]),r=15,pulse=motion?1+Math.sin(now/500)*.1:1;if(!visible(p,25))continue;
  ctx.fillStyle=color+'25';ctx.beginPath();ctx.arc(...p,r*1.8*pulse,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.shadowBlur=18;ctx.shadowColor=color;ctx.beginPath();ctx.moveTo(p[0],p[1]+r);ctx.lineTo(p[0],p[1]+r+19);ctx.stroke();ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#ffffffe6';ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
  ctx.save();ctx.translate(...p);ctx.scale(.85,.85);ctx.fillStyle='#fff';ctx.strokeStyle='#fff';ctx.lineWidth=2.3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  if(service===0){ctx.moveTo(0,-12);ctx.bezierCurveTo(-3,-6,-9,0,-8,5);ctx.bezierCurveTo(-7,14,8,14,8,4);ctx.bezierCurveTo(8,-1,3,-7,0,-12);ctx.fill();}
  else if(service===1){ctx.moveTo(3,-12);ctx.lineTo(-7,2);ctx.lineTo(-1,2);ctx.lineTo(-3,12);ctx.lineTo(8,-3);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();}
  else {ctx.moveTo(-8,9);ctx.lineTo(8,-9);ctx.moveTo(-8,-9);ctx.lineTo(8,9);ctx.moveTo(4,-11);ctx.lineTo(9,-6);ctx.moveTo(-9,-7);ctx.lineTo(-5,-11);ctx.stroke();}
  ctx.restore();
  if(calls.length>1){ctx.fillStyle='#f3f8f4';ctx.beginPath();ctx.arc(p[0]+14,p[1]-12,8,0,7);ctx.fill();ctx.fillStyle='#08212a';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(calls.length,p[0]+14,p[1]-12);}
  view.hits.unshift({point:p,call:c.id,radius:28});
 }
}
function drawVehicle(ctx,p,angle,row,scale,color){
 if(!atlas?.complete||!atlas.naturalWidth)return;
 const direction=angle>=0?(angle<Math.PI/2?0:1):(angle< -Math.PI/2?2:3),w=atlas.naturalWidth/4,h=atlas.naturalHeight/3,drawW=clamp(82*scale,30,86),drawH=drawW*h/w;
 ctx.drawImage(atlas,direction*w,row*h,w,h,p[0]-drawW/2,p[1]-drawH/2,drawW,drawH);
 ctx.fillStyle=color;ctx.strokeStyle='#eaf4ef';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(p[0],p[1]-drawH*.1,2.2,0,Math.PI*2);ctx.fill();ctx.stroke();
}
