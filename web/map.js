import {COLORS,TYPES} from './engine.js';
import {CITY_HOMES,DEPOT} from './content.js';
import {WORLD,DISTRICT_HEIGHT,MARKERS,route,onRoute,isTransfer} from './roads.js';
import {TILE_WIDTH,TILE_HEIGHT,GRID_BOUNDS,visibleTiles} from './city-grid.js';
import {FLEET_IMAGE,FLEET_ART} from './fleet-art.js';
export {route} from './roads.js';
const art=[],contexts=new WeakMap();let atlas=null,requested=false;
// The residential source tile was supplied by the owner on October 24.
export function loadArtwork(onLoad){
 if(requested)return;requested=true;
 const picture=new Image();art[0]=art[1]=art[2]=picture;
 picture.onload=onLoad;picture.onerror=onLoad;
 picture.src=new URL('./assets/districts/residential.webp',import.meta.url).href;
 atlas=new Image();atlas.onload=onLoad;atlas.onerror=onLoad;
 atlas.src=new URL(FLEET_IMAGE,import.meta.url).href;
}
const titles=['Сантехники','Электрики','Ремонтная бригада'];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Cover the viewport at every zoom, including drags beyond the edges and focus near a corner.
export function cameraFor(width,height,view){
 const baseScale=Math.max(width/WORLD.width,height/WORLD.height);
 const minZoom=Math.max(.12,width/((GRID_BOUNDS.maxX-GRID_BOUNDS.minX)*baseScale),
  height/((GRID_BOUNDS.maxY-GRID_BOUNDS.minY)*baseScale));
 const zoom=clamp(view.zoom,minZoom,4),scale=baseScale*zoom,district=view.district??0;
 const center=view.focus?[view.focus[0],view.focus[1]-district*DISTRICT_HEIGHT]:[WORLD.width/2,WORLD.height/2];
 const initialX=width/2-center[0]*scale,initialY=height/2-center[1]*scale;
 const x=clamp(initialX+view.x,width-GRID_BOUNDS.maxX*scale,-GRID_BOUNDS.minX*scale);
 const y=clamp(initialY+view.y,height-GRID_BOUNDS.maxY*scale,-GRID_BOUNDS.minY*scale);
 view.x=x-initialX;view.y=y-initialY;view.zoom=zoom;
 return {scale,x,y,district,left:x+GRID_BOUNDS.minX*scale,top:y+GRID_BOUNDS.minY*scale,
  right:x+GRID_BOUNDS.maxX*scale,bottom:y+GRID_BOUNDS.maxY*scale,
  width:(GRID_BOUNDS.maxX-GRID_BOUNDS.minX)*scale,height:(GRID_BOUNDS.maxY-GRID_BOUNDS.minY)*scale};
}
// Keep the location beneath the fingers fixed while scaling or moving the map.
// Coordinates are viewport CSS pixels, independent of WebView devicePixelRatio.
export function transformCamera(width,height,view,fromX,fromY,toX,toY,ratio=1){
 if(!Number.isFinite(ratio)||ratio<=0)throw Error('Неверный масштаб');
 const before=cameraFor(width,height,view);
 const worldX=(fromX-before.x)/before.scale,worldY=(fromY-before.y)/before.scale;
 view.zoom=clamp(view.zoom*ratio,.12,4);
 const center=view.focus?[view.focus[0],view.focus[1]-(view.district??0)*DISTRICT_HEIGHT]:[WORLD.width/2,WORLD.height/2];
 const scale=Math.max(width/WORLD.width,height/WORLD.height)*view.zoom;
 view.x=toX-worldX*scale-(width/2-center[0]*scale);
 view.y=toY-worldY*scale-(height/2-center[1]*scale);
 return cameraFor(width,height,view);
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
  for(const tile of visibleTiles(ox,oy,scale,rect.width,rect.height)){
   ctx.drawImage(picture,ox+tile.col*TILE_WIDTH*scale,oy+tile.row*TILE_HEIGHT*scale,
    TILE_WIDTH*scale+.35,TILE_HEIGHT*scale+.35);
  }
  canvas.dataset.renderer='illustrated';canvas.dataset.mapMode='seamless-8x8';
 }else{canvas.dataset.renderer='loading';ctx.fillStyle='#0b242b';ctx.fillRect(0,0,rect.width,rect.height);}
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
  const node=nodes[home.id],belongs=home.district===district,p=view.project([home.x,home.y-68]);
  node.hidden=!labels||!belongs||!visible(p,0);const half=(node.offsetWidth||110)/2+6;node.style.left=clamp(p[0],half,rect.width-half)+'px';node.style.top=clamp(p[1],15,rect.height-15)+'px';node.classList.toggle('owned',home.active);node.title=home.active?'Доверие жителей '+home.loyalty+'%':'Новый договор';
  if(belongs&&visible(view.project(MARKERS[home.id]),45))view.hits.push({point:view.project(MARKERS[home.id]),home:home.id,radius:40});
 }
 const poses=[],captionBoxes=[];
 const obstacles=state.calls.filter(c=>c.status!=='done'&&state.homes[c.home].district===district).map(c=>{const p=view.project(MARKERS[c.home]);return {x:p[0]-30,y:p[1]-30,w:60,h:70};});
 for(const n of canvas.parentElement.querySelectorAll('#mapTop,.zoom button,#mapBottom,.mapAddress:not([hidden])')){const r=n.getBoundingClientRect();if(r.width&&r.height)obstacles.push({x:r.left-rect.left,y:r.top-rect.top,w:r.width,h:r.height});}
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 for(const cr of state.crews){
  const loc=vehiclePose(state,cr,progress),moving=loc.moving;poses.push({id:cr.id,model:loc.model,point:loc.point,angle:loc.angle,transfer:!!loc.transfer});if(loc.transfer||!local(loc.point))continue;
  const point=view.project(loc.point);if(!visible(point))continue;
  drawVehicle(ctx,point,loc.angle,loc.model,scale,COLORS[cr.service]);
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
export function drawVehicle(ctx,p,angle,model,scale,color){
 const sprite=FLEET_ART[model];
 if(sprite&&atlas?.complete&&atlas.naturalWidth){
  const [sx,sy,sw,sh]=sprite.rect,length=clamp(54*scale,19,44)*sprite.length/54,width=length*sw/sh;
  ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(angle+Math.PI/2);
  ctx.drawImage(atlas,sx,sy,sw,sh,-width/2,-length/2,width,length);
  ctx.fillStyle=color;ctx.strokeStyle='#f0f5ef';ctx.lineWidth=.8;
  ctx.beginPath();ctx.arc(width/2+2,length*.22,2.5,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.restore();return;
 }
 const length=clamp(54*scale,19,44),width=length*.47;
 ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(angle+Math.PI/2);
 ctx.shadowColor='#04182080';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
 ctx.fillStyle='#e5edf0';ctx.strokeStyle='#263944';ctx.lineWidth=1.5;
 ctx.beginPath();ctx.roundRect(-width/2,-length/2,width,length,3);ctx.fill();ctx.stroke();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.fillStyle='#739bb0';ctx.fillRect(-width*.34,-length*.32,width*.68,length*.22);
 ctx.fillStyle=color;ctx.fillRect(-width*.42,-length*.02,width*.84,Math.max(2,length*.16));
 ctx.fillStyle='#172a35';ctx.fillRect(-width*.36,length*.22,width*.72,length*.09);
 ctx.restore();
}
