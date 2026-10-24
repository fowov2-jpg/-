import {ART,DW,DH,TW,TH,SIDE,district,districtOrigin,DISTRICT_NAMES} from './campaign-city.js';
import {FLEET_ART,FLEET_IMAGE} from './fleet-art.js';
import {VEHICLE_MODELS} from './content.js';
import {drawRoads} from './campaign-roads-art.js';
import {drivingPose,equipmentState,drawRig,drawVehicleLights,drawWorksite,drawBasicVehicle} from './vehicle-motion.js';
import {TrafficController,drawTrafficCar} from './city-traffic.js';
import {drawTerrain,terrainKey} from './campaign-terrain.js';
const trafficController=new TrafficController();
const thumbnails=new Map();
const images=[],fleet=new Image();fleet.src=new URL(FLEET_IMAGE,import.meta.url).href;
export function loadArt(redraw){for(let i=0;i<ART.length;i++){const im=new Image();images[i]=im;im.onload=()=>{thumbnails.clear();redraw();};im.onerror=redraw;im.src=new URL('./assets/districts/'+ART[i],import.meta.url).href;}fleet.onload=redraw;}
function thumbnail(city){
 if(!images.every(i=>i.complete&&i.naturalWidth))return null;
 const key=terrainKey(city);if(thumbnails.has(key))return thumbnails.get(key);
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.ceil(320*DH/DW);const ctx=canvas.getContext('2d'),scale=320/DW;
 for(let row=0;row<SIDE;row++)for(let col=0;col<SIDE;col++)drawTerrain(ctx,images,city,row*SIDE+col,col*TW*scale,row*TH*scale,TW*scale,TH*scale);
 drawRoads(ctx,p=>[p[0]*scale,p[1]*scale],[0,0],scale,canvas.width,canvas.height,city.seed);if(thumbnails.size>=40)thumbnails.delete(thumbnails.keys().next().value);thumbnails.set(key,canvas);return canvas;
}
export function focusDistrict(view,d,width=412,height=650,overview=false){const o=districtOrigin(d);view.x=o[0]+(overview?DW/2:708);view.y=o[1]+(overview?DH/2:434);view.scale=overview?Math.min(width/DW,height/DH)*.9:Math.min(width/TW,height/TH)*1.2;}
export function screenPoint(view,width,height,p){return [(p[0]-view.x)*view.scale+width/2,(p[1]-view.y)*view.scale+height/2];}
export function render(canvas,s,view,{selected=null,selectedCrew=null,labels=true,motion=true,progress=0,traffic=true,equipment=true}={}){
 const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;const dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#071b22';ctx.fillRect(0,0,w,h);view.hits=[];
 view.scale=Math.max(.004,Math.min(1.5,view.scale));view.x=Math.max(-TW,Math.min(DW*5+TW,view.x));view.y=Math.max(-TH,Math.min(DH*4+TH,view.y));
 if(view.scale>.05){const halfW=w/(2*view.scale),halfH=h/(2*view.scale);view.x=Math.max(halfW,Math.min(DW*5-halfW,view.x));view.y=Math.max(halfH,Math.min(DH*4-halfH,view.y));}
 const project=p=>screenPoint(view,w,h,p),visible=(x,y,width,height)=>x+width>=0&&y+height>=0&&x<=w&&y<=h;
 let tileCount=0;const trafficTiles=[],clock=(s.clock??0)+progress,rigs=[],fleetPoses=[];
 for(let d=0;d<20;d++){
  const origin=districtOrigin(d),p=project(origin),rw=DW*view.scale,rh=DH*view.scale;if(!visible(...p,rw,rh))continue;
  {
   const city=district(s.seed,d),thumb=view.scale<.025?thumbnail(city):null;
   if(thumb)ctx.drawImage(thumb,...p,rw,rh);else{
   for(let row=0;row<SIDE;row++)for(let col=0;col<SIDE;col++){
    const x=origin[0]+col*TW,y=origin[1]+row*TH,pos=project([x,y]),ww=TW*view.scale,hh=TH*view.scale;if(!visible(...pos,ww,hh))continue;
    drawTerrain(ctx,images,city,row*SIDE+col,...pos,ww,hh);
    tileCount++;if(d<=s.region&&view.scale>.12)trafficTiles.push([Math.round(origin[0]/TW)+col,Math.round(origin[1]/TH)+row]);
   }
   ctx.save();ctx.beginPath();ctx.rect(...p,rw,rh);ctx.clip();drawRoads(ctx,project,origin,view.scale,w,h,s.seed);ctx.restore();
   }
   if(d>s.region){ctx.fillStyle='#061b24bd';ctx.fillRect(...p,rw,rh);}
   if(d<s.region){ctx.fillStyle='#103a2b35';ctx.fillRect(...p,rw,rh);}
  }
  ctx.strokeStyle=d>s.region?'#55717b55':d===s.region?(view.scale<.07?'#48dba6':'#48dba630'):'#8cc99d55';ctx.lineWidth=1.5;ctx.strokeRect(...p,rw,rh);
  if(view.scale<.07||d>s.region){const c=project([origin[0]+DW/2,origin[1]+DH/2]),font=Math.max(7,Math.min(13,rw/10));ctx.save();ctx.beginPath();ctx.rect(p[0]+1,p[1]+1,rw-2,rh-2);ctx.clip();ctx.textAlign='center';ctx.font=`600 ${font}px system-ui`;ctx.fillStyle=d>s.region?'#a4b7bc':'#ecf5eb';ctx.fillText((d>s.region?'🔒 ':d<s.region?'✓ ':'')+DISTRICT_NAMES[d],...c);ctx.font=`${Math.max(7,font-1)}px system-ui`;ctx.fillText(d>s.region?'Закрыт':d<s.region?'999 / 999':s.done.length+' / 999',c[0],c[1]+font+6);ctx.restore();view.hits.push({kind:'district',id:d,x:p[0],y:p[1],w:rw,h:rh});}
 }
 const ambient=[],blockers=s.crews.filter(cr=>['diagnosis','repair'].includes(cr.status)).map(cr=>[cr.point[0]-Math.sin(cr.angle??0)*8,cr.point[1]+Math.cos(cr.angle??0)*8]);
 if(motion&&traffic&&view.scale>.12)for(const car of trafficController.frame(s.seed,trafficTiles,clock,blockers)){const p=project(car.point);if(!visible(p[0]-15,p[1]-15,30,30))continue;ambient.push({...car,screen:p});}
 ambient.sort((a,b)=>Math.hypot(a.screen[0]-w/2,a.screen[1]-h/2)-Math.hypot(b.screen[0]-w/2,b.screen[1]-h/2));
 for(const car of ambient.slice(0,128))drawTrafficCar(ctx,car.screen,car.angle,view.scale,car.color,car.stopped);
 canvas.dataset.traffic=JSON.stringify(ambient.slice(0,16).map(c=>({id:c.id,point:c.point,angle:c.angle,stopped:c.stopped})));canvas.dataset.trafficCount=String(Math.min(ambient.length,128));
 if(view.scale>.07){
  if(labels)for(let d=0;d<s.region;d++){
   const origin=districtOrigin(d),pos=project(origin);if(!visible(...pos,DW*view.scale,DH*view.scale))continue;
   for(const home of district(s.seed,d).homes){const p=project([home.x,home.y]);if(!visible(p[0]-7,p[1]-7,14,14))continue;ctx.fillStyle='#38e9a2';ctx.beginPath();ctx.arc(...p,2,0,Math.PI*2);ctx.fill();view.hits.push({kind:'archiveHome',district:d,id:home.id,x:p[0]-9,y:p[1]-9,w:18,h:18});}
  }
  const city=district(s.seed,s.region),done=new Set(s.done),issued=new Set(s.calls.map(c=>c.mission));
  if(labels)for(const home of city.homes){const p=project([home.x,home.y]);if(!visible(p[0]-7,p[1]-7,14,14))continue;ctx.fillStyle=done.has(home.id)?'#38e9a2':issued.has(home.id)?'#ffcd64':'#f4f0de85';ctx.beginPath();ctx.arc(...p,done.has(home.id)?2:3,0,Math.PI*2);ctx.fill();view.hits.push({kind:'home',id:home.id,x:p[0]-9,y:p[1]-9,w:18,h:18});if(view.scale>.5){ctx.font='10px system-ui';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(String(home.id+1),p[0],p[1]-9);}}
  for(const c of s.calls){const home=city.homes[c.mission],p=project([home.x,home.y]);if(c.path&&c.crew!==null){ctx.beginPath();c.path.forEach((pt,i)=>{const q=project(pt);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.strokeStyle=c.mission===selected?'#55f2ac':'#5da7ba85';ctx.lineWidth=c.mission===selected?4:2;ctx.stroke();}
   if(!visible(p[0]-20,p[1]-20,40,40))continue;ctx.fillStyle=c.late?'#f77262':c.status==='new'?'#f4b84b':'#45dca0';ctx.strokeStyle='#fcf7df';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(...p,c.mission===selected?15:11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#062128';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.status==='new'?'!':c.status==='travel'?'→':c.status==='diagnosis'?'?':'•',...p);view.hits.unshift({kind:'call',id:c.mission,x:p[0]-22,y:p[1]-22,w:44,h:44});
  }
  const cards=[];
  for(const cr of s.crews){const c=s.calls.find(c=>c.crew===cr.id),v=s.vehicles.find(v=>v.id===cr.vehicle),sprite=FLEET_ART[v.model],model=VEHICLE_MODELS.find(m=>m.id===v.model),pose=cr.status==='returning'&&cr.returnTrip?drivingPose(cr.returnTrip.path,(cr.returnTrip.total-cr.returnTrip.remaining+(motion?progress:0))/cr.returnTrip.total):c?.status==='travel'?drivingPose(c.path,(c.total-c.remaining+(motion?progress:0))/c.total):{point:cr.point,angle:cr.angle??-Math.PI/2},p=project([pose.point[0]-Math.sin(pose.angle)*8,pose.point[1]+Math.cos(pose.angle)*8]);
   if(cr.status==='returning'&&cr.id===selectedCrew&&cr.returnTrip){
    ctx.beginPath();cr.returnTrip.path.forEach((pt,i)=>{const q=project(pt);i?ctx.lineTo(...q):ctx.moveTo(...q);});
    ctx.strokeStyle='#6ebbf0bc';ctx.lineWidth=2.5;ctx.setLineDash([7,5]);ctx.stroke();ctx.setLineDash([]);
   }
   fleetPoses.push({id:cr.id,point:pose.point,angle:pose.angle});if(!visible(p[0]-90,p[1]-90,180,180))continue;
   const frame=equipmentState(model,c,progress,motion&&equipment);rigs.push({id:cr.id,kind:model.kind??'service',...frame});
   ctx.save();ctx.translate(...p);ctx.rotate(pose.angle+Math.PI/2);
   const l=Math.max(18,Math.min(36,(sprite?.length??54)*view.scale)),ww=l*(sprite?sprite.rect[2]/sprite.rect[3]:.47),working=frame.phase!=='stowed'&&frame.phase!=='inspection';
   if(working)drawRig(ctx,model,frame,l,ww,motion?clock:0,['#58bfee','#f4cd62','#61d9a0'][cr.service],c?Math.atan2(city.homes[c.mission].y-pose.point[1],city.homes[c.mission].x-pose.point[0])-pose.angle-Math.PI/2:0);
   else if(sprite&&fleet.complete&&fleet.naturalWidth){const [x,y,sw,sh]=sprite.rect;ctx.drawImage(fleet,x,y,sw,sh,-ww/2,-l/2,ww,l);}else drawBasicVehicle(ctx,l,ww,model.id,['#58bfee','#f4cd62','#61d9a0'][cr.service]);
   drawVehicleLights(ctx,l,ww,motion?clock:0,{braking:pose.braking,turning:pose.turning,working:!!c&&c.status!=='travel'});if(c)drawWorksite(ctx,l,ww,c,cr.service,clock,progress,motion&&equipment,Math.atan2(city.homes[c.mission].y-pose.point[1],city.homes[c.mission].x-pose.point[0])-pose.angle-Math.PI/2);ctx.restore();
   const color=cr.status==='idle'?'#39dca1':'#f4bd62',cw=64,ch=37;
   const candidates=[-48,0,-90,42,-132,84].flatMap(dy=>[14,-78].map(dx=>[dx,dy])).map(([dx,dy])=>({x:Math.max(4,Math.min(w-cw-4,p[0]+dx)),y:Math.max(54,Math.min(h-ch-10,p[1]+dy)),w:cw,h:ch}));
   const box=candidates.find(a=>!cards.some(b=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y))??candidates[0];cards.push(box);
   ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(box.x+cw/2,box.y+ch/2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle='#092530f2';ctx.strokeStyle=c?.mission===selected?'#f5f4df':color;ctx.lineWidth=c?.mission===selected?2.5:1.5;ctx.beginPath();ctx.roundRect(box.x,box.y,cw,ch,6);ctx.fill();ctx.stroke();
   if(sprite&&fleet.complete&&fleet.naturalWidth){const [x,y,sw,sh]=sprite.rect;ctx.drawImage(fleet,x,y,sw,sh,box.x+8,box.y+4,26*sw/sh,26);}else{ctx.save();ctx.translate(box.x+16,box.y+18);drawBasicVehicle(ctx,26,12,model.id,color);ctx.restore();}
   ctx.fillStyle=color;ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('Б'+(cr.id+1),box.x+46,box.y+13);
   for(let i=0;i<cr.members.length;i++){ctx.beginPath();ctx.arc(box.x+41+i*9,box.y+26,2.5,0,Math.PI*2);ctx.fill();}
   view.hits.unshift({kind:'crew',id:cr.id,...box});
  }
 }
 ctx.textBaseline='alphabetic';canvas.dataset.tiles=tileCount;canvas.dataset.lod=view.scale<.025?'district':'street';canvas.dataset.renderer=images.every(i=>i.complete&&i.naturalWidth)?'ready':'loading';canvas.dataset.equipment=JSON.stringify(rigs);canvas.dataset.fleet=JSON.stringify(fleetPoses);canvas.dataset.motionClock=String(clock);canvas.dataset.positions='999';canvas.dataset.region=String(s.region);canvas.dataset.camera=JSON.stringify({x:view.x,y:view.y,scale:view.scale});
}
