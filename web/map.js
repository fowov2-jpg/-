import {COLORS,TYPES} from './engine.js';
import {CITY_HOMES,DEPOT} from './content.js';
import {WORLD,DISTRICT_HEIGHT,MARKERS,route,onRoute,isTransfer} from './roads.js';
export {route} from './roads.js';
const art=[],contexts=new WeakMap();let atlas=null,requested=false;
const sources=['neighborhood.webp','central.webp','riverside.webp'];
export function loadArtwork(onLoad){
 if(requested)return;requested=true;
 sources.forEach((name,d)=>{const image=new Image();art[d]=image;image.onload=onLoad;image.onerror=()=>{if(d){art[d]=art[0];onLoad();}};image.src=new URL('./assets/'+name,import.meta.url).href;});
 atlas=new Image();atlas.onload=onLoad;atlas.src=new URL('./assets/fleet-atlas.webp',import.meta.url).href;
}
const titles=['Сантехники','Электрики','Ремонтная бригада'],modelRows={van:0,express:1,truck:2};
const addressPoints=[[225,235],[730,365],[820,860],[135,570]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Cover the viewport at every zoom, including drags beyond the edges and focus near a corner.
export function cameraFor(width,height,view){
 const scale=Math.max(width/WORLD.width,height/WORLD.height)*clamp(view.zoom,1,2.7),district=view.district??0;
 const center=view.focus?[view.focus[0],view.focus[1]-district*DISTRICT_HEIGHT]:[500,750];
 const initialX=width/2-center[0]*scale,initialY=height/2-center[1]*scale;
 const x=clamp(initialX+view.x,width-WORLD.width*scale,0),y=clamp(initialY+view.y,height-WORLD.height*scale,0);
 view.x=x-initialX;view.y=y-initialY;view.zoom=clamp(view.zoom,1,2.7);
 return {scale,x,y,district,left:x,top:y,right:x+WORLD.width*scale,bottom:y+WORLD.height*scale};
}
function contextFor(canvas){
 let result=contexts.get(canvas);if(result)return result;
 const labels=document.createElement('div');labels.className='mapLabels';canvas.after(labels);
 const nodes=CITY_HOMES.map(home=>{const node=document.createElement('button');node.className='mapAddress';node.dataset.action='home';node.dataset.id=home.id;node.textContent=home.name;labels.appendChild(node);return node;});
 result={ctx:canvas.getContext('2d'),nodes};contexts.set(canvas,result);return result;
}
export function renderMap(canvas,state,view,{labels=true,motion=true,progress=0,now=0}={}){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(globalThis.devicePixelRatio||1,2),{ctx,nodes}=contextFor(canvas);if(!ctx)return;
 if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
 const camera=cameraFor(rect.width,rect.height,view),{scale,x:ox,y:oy,district}=camera,offset=district*DISTRICT_HEIGHT;
 view.project=p=>[p[0]*scale+ox,(p[1]-offset)*scale+oy];view.scale=scale;view.hits=[];view.pick=null;view.mode='illustrated';canvas.dataset.coverage=JSON.stringify(camera);
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
 const picture=art[district]?.complete&&art[district].naturalWidth?art[district]:art[0];
 if(picture?.complete&&picture.naturalWidth){ctx.drawImage(picture,ox,oy,WORLD.width*scale,WORLD.height*scale);canvas.dataset.renderer='illustrated';}else{canvas.dataset.renderer='loading';ctx.fillStyle='#0b242b';ctx.fillRect(0,0,rect.width,rect.height);}
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
  if(belongs)view.hits.push({point:view.project(MARKERS[home.id]),home:home.id,radius:40});
 }
 // Idle vehicles occupy separate spaces at the depot, rather than a stack of rectangles.
 const parked=state.crews.filter(c=>c.status==='idle'&&c.home===DEPOT);
 for(const cr of state.crews){
  const call=state.calls.find(c=>c.id===cr.job),moving=cr.status==='travel'&&call;
  const path=moving?route(cr.home,call.home):route(cr.home,cr.home),loc=onRoute(path,moving?(cr.total-cr.remaining+progress)/cr.total:1);
  if(loc.transfer||!local(loc.point))continue;
  const point=view.project(loc.point);if(!visible(point))continue;
  if(cr.status==='idle'&&cr.home===DEPOT){const index=parked.indexOf(cr);point[0]+=(index%3-1)*72*scale;point[1]+=(Math.floor(index/3)*80+(index%3-1)*36)*scale;}
  const vehicle=state.vehicles.find(v=>v.id===cr.vehicle),row=modelRows[vehicle?.model]??0,angle=moving?loc.angle:(cr.home===DEPOT?-2.55:.7);
  drawVehicle(ctx,point,angle,row,scale,COLORS[cr.service]);
  if(cr.status!=='idle'){
   const eta=moving?cr.remaining+' мин':cr.status==='diagnosis'?'Диагностика':'Ремонт',text=titles[cr.service]+' · '+eta;
   ctx.font='600 10px system-ui';const w=ctx.measureText(text).width+20,lx=clamp(point[0]+16,5,rect.width-w-5),ly=clamp(point[1]-27,8,rect.height-30);
   ctx.fillStyle='#061e28f2';ctx.strokeStyle=COLORS[cr.service]+'aa';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(lx,ly,w,24,6);ctx.fill();ctx.stroke();ctx.fillStyle=COLORS[cr.service];ctx.beginPath();ctx.arc(lx+7,ly+12,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eff5ef';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,lx+14,ly+12);
  }
 }
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
