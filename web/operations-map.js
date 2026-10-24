import {district, districtOrigin, TW, TH, DW, DH, ROAD_X, ROAD_Y} from './campaign-city.js';
import {SCENARIOS} from './operations-content.js';
import {currentHouses, assignmentFor} from './shift-operations.js';
import {FLEET_ART, FLEET_IMAGE} from './fleet-art.js';
import {TrafficController, drawTrafficCar} from './city-traffic.js';
import {VEHICLE_MODELS} from './content.js';
import {drivingPose,equipmentState,drawRig,drawBasicVehicle,drawVehicleLights,drawWorksite} from './vehicle-motion.js';

const COLORS=['#79bddb','#e8bf70','#8cc9a4'];
const fleet=typeof Image==='undefined'?null:new Image();
if(fleet)fleet.src=new URL(FLEET_IMAGE,import.meta.url).href;
const backgrounds=new WeakMap(),trafficController=new TrafficController();
const intersect=(a,b,gap=4)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;

function serviceGlyph(ctx,service,x,y,size=10) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/10,size/10);ctx.beginPath();ctx.lineWidth=1.8;ctx.lineJoin='round';ctx.lineCap='round';
  if(service===0){ctx.moveTo(0,-8);ctx.bezierCurveTo(-3,-3,-6,0,-6,3);ctx.arc(0,3,6,Math.PI,0,true);ctx.bezierCurveTo(6,0,3,-3,0,-8);}
  else if(service===1){ctx.moveTo(2,-9);ctx.lineTo(-5,2);ctx.lineTo(0,2);ctx.lineTo(-2,9);ctx.lineTo(6,-2);ctx.lineTo(1,-2);ctx.closePath();}
  else{ctx.arc(-2,-4,3,0,Math.PI*2);ctx.moveTo(-1,-1);ctx.lineTo(3,7);ctx.moveTo(0,7);ctx.lineTo(6,5);}
  ctx.stroke();ctx.restore();
}

function backdrop(canvas,ctx,s,view,w,h,dpr,project) {
  const key=[s.seed,s.region,w,h,dpr,view.x,view.y,view.scale].join(':');
  let cache=backgrounds.get(canvas);
  if(cache?.key===key){ctx.drawImage(cache.canvas,0,0,w,h);return;}
  const layer=cache?.canvas??document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;
  const c=layer.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#17232b';c.fillRect(0,0,w,h);
  const scale=view.scale,ox=districtOrigin(s.region)[0],oy=districtOrigin(s.region)[1];
  const minX=view.x-w/2/scale,maxX=view.x+w/2/scale,minY=view.y-h/2/scale,maxY=view.y+h/2/scale;
  // The operational layer uses the same home coordinates and road axes as the
  // routing engine. Service and incident symbols remain legible at every zoom.
  const firstCol=Math.max(0,Math.floor((minX-ox)/TW)),lastCol=Math.min(7,Math.floor((maxX-ox)/TW));
  const firstRow=Math.max(0,Math.floor((minY-oy)/TH)),lastRow=Math.min(7,Math.floor((maxY-oy)/TH));
  for(let row=firstRow;row<=lastRow;row++)for(let col=firstCol;col<=lastCol;col++){
    const p=project([ox+col*TW,oy+row*TH]);
    c.fillStyle=(row+col)%3===0?'#1d302e':'#202d35';c.fillRect(p[0]+10*scale,p[1]+10*scale,(TW-20)*scale,(TH-20)*scale);
    c.fillStyle='#263b33';
    for(let i=0;i<5;i++){const q=project([ox+col*TW+320+i*39,oy+row*TH+320+(i%2)*33]);c.beginPath();c.arc(q[0],q[1],Math.max(2,21*scale),0,Math.PI*2);c.fill();}
  }
  c.lineCap='round';
  function roads(stroke,width){c.strokeStyle=stroke;c.lineWidth=Math.max(1,width*scale);c.beginPath();
    for(let col=firstCol;col<=lastCol;col++)for(const x of ROAD_X){const a=project([ox+col*TW+x,oy]),b=project([ox+col*TW+x,oy+DH]);c.moveTo(...a);c.lineTo(...b);}
    for(let row=firstRow;row<=lastRow;row++)for(const y of ROAD_Y){const a=project([ox,oy+row*TH+y]),b=project([ox+DW,oy+row*TH+y]);c.moveTo(...a);c.lineTo(...b);}
    c.stroke();}
  roads('#101c24',61);roads('#3a4b55',43);roads('#42545e',2);
  for(const home of district(s.seed,s.region).homes){
    const p=project([home.x,home.y]);if(p[0]<-60||p[1]<-60||p[0]>w+60||p[1]>h+60)continue;
    const bw=(home.floors>8?96:144)*scale,bh=(home.floors>8?90:60)*scale;
    c.fillStyle='#101b2355';c.fillRect(p[0]-bw/2+3,p[1]-bh/2+4,bw,bh);
    c.fillStyle=home.floors>8?'#394851':'#31414b';c.strokeStyle='#4b5a6255';c.lineWidth=.8;
    c.beginPath();c.roundRect(p[0]-bw/2,p[1]-bh/2,bw,bh,Math.min(2,bh/6));c.fill();c.stroke();
    c.strokeStyle='#53616b55';c.beginPath();c.moveTo(p[0]-bw/2+4,p[1]);c.lineTo(p[0]+bw/2-4,p[1]);c.stroke();
  }
  if(scale>.13){
    c.font='500 10px system-ui';c.fillStyle='#a3b2ba80';c.textAlign='center';
    for(let row=firstRow;row<=lastRow;row++){
      const p=project([ox+708,oy+row*TH+434]);
      if(p[1]>30&&p[1]<h-30){c.fillText(row%2?'ЛЕСНАЯ УЛИЦА':'САДОВАЯ УЛИЦА',p[0]+120*scale,p[1]-8);}
    }
  }
  const center=project([ox+TW+708,oy+TH+434]);
  c.fillStyle='#8999a27a';c.font='600 9px system-ui';c.textAlign='left';c.fillText('УК «УЮТ»',center[0]+15,center[1]+14);
  c.strokeStyle='#99b2be80';c.lineWidth=1.4;c.strokeRect(center[0]-7,center[1]-7,14,14);
  backgrounds.set(canvas,{key,canvas:layer});ctx.drawImage(layer,0,0,w,h);
}

function placeMarker(point,width,height,occupied,bounds) {
  const [px,py]=point,{left,right,top,bottom}=bounds;
  const candidate=(x,y)=>({x:Math.max(left,Math.min(right-width,x)),y:Math.max(top,Math.min(bottom-height,y)),w:width,h:height});
  const positions=[[px-width/2,py-height/2]];
  for(let ring=1;ring<=5;ring++)for(let i=0;i<12;i++)positions.push([px-width/2+Math.cos(i*Math.PI/6)*ring*38,py-height/2+Math.sin(i*Math.PI/6)*ring*32]);
  const boxes=positions.map(([x,y])=>candidate(x,y));
  let chosen=boxes.find(a=>!occupied.some(b=>intersect(a,b)));
  if(!chosen){for(let y=top;y<=bottom-height&&!chosen;y+=height+5)for(let x=left;x<=right-width;x+=width+5){const box=candidate(x,y);if(!occupied.some(b=>intersect(box,b))){chosen=box;break;}}}
  chosen??=boxes[0];
  occupied.push(chosen);return chosen;
}

export function renderOperations(canvas,s,view,{selected=null,selectedCrew=null,motion=true,progress=0,traffic=true,equipment=true,annotationBottom=null,annotationTop=144}={}) {
  const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
  const dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  view.scale=Math.max(.07,Math.min(1.2,view.scale));
  const origin=districtOrigin(s.region);view.x=Math.max(origin[0]-500,Math.min(origin[0]+DW+500,view.x));view.y=Math.max(origin[1]-500,Math.min(origin[1]+DH+500,view.y));
  const project=p=>[(p[0]-view.x)*view.scale+w/2,(p[1]-view.y)*view.scale+h/2];
  view.hits=[];backdrop(canvas,ctx,s,view,w,h,dpr,project);
  const clock=s.clock+(motion?progress:0),tiles=[];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)tiles.push([Math.round(origin[0]/TW)+col,Math.round(origin[1]/TH)+row]);
  const cars=motion&&traffic?trafficController.frame(s.seed,tiles,clock,[]).filter(car=>{const p=project(car.point);return p[0]>0&&p[1]>0&&p[0]<w&&p[1]<h;}).slice(0,32):[];
  ctx.globalAlpha=.5;for(const car of cars)drawTrafficCar(ctx,project(car.point),car.angle,view.scale*.8,car.color,false);ctx.globalAlpha=1;
  if(s.minute<90||s.minute>390){
    const a=project([origin[0]+TW+708,origin[1]+TH+340]),b=project([origin[0]+TW+708,origin[1]+TH+510]);
    ctx.strokeStyle='#d7ad6360';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.setLineDash([]);
  }
  for(const home of currentHouses(s)){
    const p=project([district(s.seed,s.region).homes[home.id].x,district(s.seed,s.region).homes[home.id].y]);
    if(p[0]<-40||p[1]<-40||p[0]>w+40||p[1]>h+40)continue;
    ctx.fillStyle=home.outages.water||home.outages.electric?'#bf895d33':'#8cbdb022';ctx.strokeStyle=home.outages.water||home.outages.electric?'#d5a073a0':'#8bbbae70';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(p[0]-22,p[1]-17,44,34,4);ctx.fill();ctx.stroke();
    if(!s.calls.some(c=>c.home===home.id))view.hits.push({kind:'home',id:home.id,x:p[0]-22,y:p[1]-22,w:44,h:44});
    ctx.fillStyle='#b9cec6';ctx.font='600 9px system-ui';ctx.textAlign='center';ctx.fillText(`${Math.floor(home.id/16)+1}к${home.id%16+1}`,p[0],p[1]+29);
  }
  const selectedCall=s.calls.find(c=>c.mission===selected);
  const drawRoute=(path,color,returning=false)=>{
    ctx.strokeStyle='#101c24b8';ctx.lineWidth=6;ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(...project(p)):ctx.moveTo(...project(p)));ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=2.5;if(returning)ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
  };
  for(const c of s.calls)for(const a of c.assignments)if(c===selectedCall||a.crew===selectedCrew)drawRoute(a.path,COLORS[a.service]+'c0');
  const selectedCr=s.crews.find(cr=>cr.id===selectedCrew);
  if(selectedCr?.returnTrip)drawRoute(selectedCr.returnTrip.path,COLORS[selectedCr.service]+'90',true);
  const occupied=[], bounds={left:10,right:w-10,top:Math.min(h-90,annotationTop),bottom:Math.max(Math.min(h-145,annotationBottom??h-145),Math.min(h-90,annotationTop)+48)};
  const connect=(point,box,color)=>{
    const x=box.x+box.w/2,y=box.y+box.h/2;
    if(Math.hypot(x-point[0],y-point[1])>23){ctx.strokeStyle=color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...point);ctx.lineTo(x,y);ctx.stroke();}
  };
  // Selected incidents are laid out first. Labels move aside with a leader line,
  // while the actual object and every route retain their world coordinates.
  const cramped=selectedCall&&bounds.bottom-bounds.top<100;
  const calls=s.calls.filter(c=>!cramped||c===selectedCall).sort((a,b)=>Number(b.mission===selected)-Number(a.mission===selected)||SCENARIOS[b.kind].priority-SCENARIOS[a.kind].priority);
  for(const c of calls){
    const home=district(s.seed,s.region).homes[c.home],p=project([home.x,home.y]),d=SCENARIOS[c.kind],picked=c.mission===selected;
    const box=placeMarker(p,42,42,occupied,bounds),x=box.x+21,y=box.y+21,color=c.late?'#ec9f88':COLORS[d.service];
    connect(p,box,color);ctx.fillStyle='#14232bf5';ctx.strokeStyle=picked?'#f0e1bd':color;ctx.lineWidth=picked?2.5:1.7;
    ctx.beginPath();ctx.arc(x,y,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=color;serviceGlyph(ctx,d.service,x,y-1,9);
    if(d.priority===3){ctx.fillStyle=c.late?'#eb947f':'#dfb267';ctx.beginPath();ctx.arc(x+13,y-13,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1b252b';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText('!',x+13,y-10);}
    ctx.fillStyle='#ecf0ee';ctx.font='600 8px system-ui';ctx.textAlign='center';ctx.fillText(String(c.mission+1).padStart(2,'0'),x,y+28);
    view.hits.push({kind:'call',id:c.mission,...box});
  }
  const poses=[],rigs=[];
  for(const cr of s.crews){
    const pair=assignmentFor(s,cr.id),a=pair?.assignment;
    const trip=cr.status==='returning'?cr.returnTrip:a?.status==='travel'?a:null;
    const pose=trip?drivingPose(trip.path,(trip.total-trip.remaining+(motion?progress:0))/trip.total):{point:cr.point,angle:cr.angle};
    poses.push({id:cr.id,point:pose.point,angle:pose.angle});
    const v=s.vehicles.find(v=>v.id===cr.vehicle),sprite=FLEET_ART[v.model],model=VEHICLE_MODELS.find(m=>m.id===v.model);
    const point=project(pose.point),frame=equipmentState(model,a?.status==='repair'?a:null,progress,motion&&equipment);
    rigs.push({id:cr.id,kind:model.kind??'service',...frame});
    if(point[0]>-60&&point[0]<w+60&&point[1]>-60&&point[1]<h+60){
      const length=Math.max(18,Math.min(38,(sprite?.length??54)*view.scale)),width=length*(sprite?sprite.rect[2]/sprite.rect[3]:.47);
      const target=pair?district(s.seed,s.region).homes[pair.call.home]:null,aim=target?Math.atan2(target.y-pose.point[1],target.x-pose.point[0])-pose.angle-Math.PI/2:0;
      ctx.save();ctx.translate(...point);ctx.rotate(pose.angle+Math.PI/2);
      if(frame.phase!=='stowed')drawRig(ctx,model,frame,length,width,motion?clock:0,COLORS[cr.service],aim);
      else if(sprite&&fleet?.complete&&fleet.naturalWidth){const [sx,sy,sw,sh]=sprite.rect;ctx.drawImage(fleet,sx,sy,sw,sh,-width/2,-length/2,width,length);}
      else drawBasicVehicle(ctx,length,width,model.id,COLORS[cr.service]);
      drawVehicleLights(ctx,length,width,motion?clock:0,{braking:pose.braking,turning:pose.turning,working:a?.status==='repair'});
      if(a?.status==='repair')drawWorksite(ctx,length,width,a,cr.service,clock,progress,motion&&equipment,aim);
      ctx.restore();
    }
    if(cramped&&cr.id!==selectedCrew&&!(selectedCall.assignments.length?cr.job===selected:cr.status==='idle'&&s.crews.filter(v=>v.status==='idle').slice(0,3).includes(cr)))continue;
    const p=project(pose.point),box=placeMarker(p,52,38,occupied,bounds),color=COLORS[cr.service],picked=cr.id===selectedCrew||pair?.call.mission===selected;
    connect(p,box,color);ctx.fillStyle=picked?'#30414af5':'#1c2b35f5';ctx.strokeStyle=picked?'#e9d5ae':color+'b0';ctx.lineWidth=picked?2:1.2;
    ctx.beginPath();ctx.roundRect(box.x,box.y,box.w,box.h,5);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.fillRect(box.x,box.y+7,2,24);
    if(sprite&&fleet?.complete&&fleet.naturalWidth){const [sx,sy,sw,sh]=sprite.rect;ctx.drawImage(fleet,sx,sy,sw,sh,box.x+7,box.y+4,25*sw/sh,27);}
    else {ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.strokeRect(box.x+8,box.y+7,10,20);ctx.fillRect(box.x+7,box.y+11,12,2);}
    ctx.fillStyle='#e9efed';ctx.font='700 10px system-ui';ctx.textAlign='left';ctx.fillText('Б'+(cr.id+1),box.x+28,box.y+15);
    ctx.fillStyle=cr.status==='idle'?'#9dd2af':cr.status==='waiting'?'#efbc74':'#8ca0ad';
    ctx.beginPath();ctx.arc(box.x+31,box.y+26,2,0,Math.PI*2);ctx.arc(box.x+39,box.y+26,2,0,Math.PI*2);ctx.fill();
    view.hits.unshift({kind:'crew',id:cr.id,...box});
  }
  const scaleY=h-144;
  ctx.strokeStyle='#a5b3ba90';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(15,scaleY);ctx.lineTo(55,scaleY);ctx.moveTo(15,scaleY-3);ctx.lineTo(15,scaleY+3);ctx.moveTo(55,scaleY-3);ctx.lineTo(55,scaleY+3);ctx.stroke();ctx.fillStyle='#a5b3ba';ctx.font='9px system-ui';ctx.textAlign='left';ctx.fillText(Math.round(40/view.scale)+' м',15,scaleY-6);
  canvas.dataset.renderer='ready';canvas.dataset.operations='1';canvas.dataset.positions='999';canvas.dataset.region=String(s.region);canvas.dataset.tiles=String(tiles.length);canvas.dataset.lod='operational';canvas.dataset.camera=JSON.stringify({x:view.x,y:view.y,scale:view.scale});canvas.dataset.fleet=JSON.stringify(poses);canvas.dataset.trafficCount=String(cars.length);canvas.dataset.traffic=JSON.stringify(cars.slice(0,16).map(c=>({id:c.id,point:c.point,angle:c.angle})));canvas.dataset.equipment=JSON.stringify(rigs);canvas.dataset.motionClock=String(clock);canvas.dataset.markers=JSON.stringify(view.hits.filter(h=>h.kind==='call'||h.kind==='crew'));canvas.dataset.edgeCalls=String(calls.filter(c=>{const p=project([district(s.seed,s.region).homes[c.home].x,district(s.seed,s.region).homes[c.home].y]);return p[0]<0||p[0]>w||p[1]<0||p[1]>h;}).length);
}

export function focusOperations(view,s,width=412,height=800) {
  const homes=currentHouses(s).map(h=>district(s.seed,s.region).homes[h.id]);
  const xs=homes.map(h=>h.x),ys=homes.map(h=>h.y);
  const minX=Math.min(...xs)-150,maxX=Math.max(...xs)+150,minY=Math.min(...ys)-120,maxY=Math.max(...ys)+120;
  const scale=Math.min((width-60)/Math.max(1100,maxX-minX),(height-310)/Math.max(780,maxY-minY),.35);
  view.scale=Math.max(.1,scale);view.x=(minX+maxX)/2;view.y=(minY+maxY)/2+15/view.scale;view.initialized=true;
}
