import {COLORS,TYPES} from './engine.js';
import {WORLD,MARKERS,LABELS,route,onRoute} from './roads.js';
export {route} from './roads.js';
let artwork=null,requested=false;
export function loadArtwork(onLoad){
 if(requested)return;requested=true;
 artwork=new Image();artwork.onload=onLoad;artwork.onerror=()=>{artwork=null;onLoad();};artwork.src=new URL('./assets/neighborhood.webp',import.meta.url).href;
}
const titles=['Сантехники','Электрики','Ремонтная бригада'];
export function renderMap(canvas,state,view,{labels=true,motion=true,progress=0,now=0}={}){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(globalThis.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#314432';ctx.fillRect(0,0,rect.width,rect.height);
 const base=Math.max(rect.width/WORLD.width,rect.height/WORLD.height),scale=base*view.zoom;
 const ox=(rect.width-WORLD.width*scale)/2+view.x,oy=(rect.height-WORLD.height*scale)/2+view.y;
 view.project=p=>[p[0]*scale+ox,p[1]*scale+oy];view.scale=scale;view.hits=[];
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 if(artwork?.complete&&artwork.naturalWidth)ctx.drawImage(artwork,0,0,WORLD.width,WORLD.height);
 else {
  ctx.fillStyle='#667755';ctx.fillRect(0,0,1000,1500);
  for(let i=0;i<8;i++){ctx.fillStyle='#bcaa91';ctx.fillRect(80+(i%2)*580,50+Math.floor(i/2)*360,260,210);ctx.fillStyle='#65716c';ctx.fillRect(80+(i%2)*580,50+Math.floor(i/2)*360,260,35);}
  ctx.strokeStyle='#68716c';ctx.lineWidth=85;ctx.beginPath();route(0,3).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
 }
 const shade=ctx.createLinearGradient(0,0,0,1500);shade.addColorStop(0,'#06141c24');shade.addColorStop(.45,'#06141c00');shade.addColorStop(1,'#06141c30');ctx.fillStyle=shade;ctx.fillRect(0,0,1000,1500);ctx.restore();
 const active=state.calls.filter(c=>c.status!=='done');
 function line(path,color){
  ctx.beginPath();path.map(view.project).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);ctx.strokeStyle=color+'44';ctx.lineWidth=10;ctx.shadowColor=color;ctx.shadowBlur=12;ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#fff9';ctx.lineWidth=1.6;ctx.setLineDash([5,6]);ctx.lineDashOffset=motion?-now/100:0;ctx.stroke();ctx.setLineDash([]);
 }
 function label(text,world){
  const p=view.project(world);ctx.font='600 11px system-ui,sans-serif';const width=ctx.measureText(text).width+16,height=24;
  ctx.fillStyle='#081c25e8';ctx.strokeStyle='#d5e5e42b';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p[0]-width/2,p[1]-height/2,width,height,5);ctx.fill();ctx.stroke();ctx.fillStyle='#eaf2ec';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p[0],p[1]);
 }
 if(labels)for(const [name,x,y,id] of LABELS){label(name,[x,y]);if(id!==undefined)view.hits.push({point:view.project([x,y]),home:id,radius:42});}
 for(const cr of state.crews){
  let path=route(cr.home,cr.home),moving=cr.status==='travel';
  if(moving){const call=state.calls.find(c=>c.id===cr.job);path=route(cr.home,call.home);line(path,COLORS[cr.service]);}
  const t=moving?Math.min(1,(cr.total-cr.remaining+progress)/cr.total):1,loc=onRoute(path,t),point=view.project(loc.point);point[0]+=(cr.id-1)*(!moving?13:0);
  drawVan(ctx,point,loc.angle,COLORS[cr.service],cr.id===2);
  if(cr.status!=='idle'){
   const eta=moving?`${cr.remaining} мин`:{diagnosis:'Диагностика',repair:'Ремонт'}[cr.status],text=`${titles[cr.service]} · ${eta}`;
   ctx.font='600 10px system-ui,sans-serif';const width=ctx.measureText(text).width+22;
   ctx.fillStyle='#061c27f2';ctx.strokeStyle=COLORS[cr.service]+'88';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(point[0]+14,point[1]-22,width,25,7);ctx.fill();ctx.stroke();ctx.fillStyle=COLORS[cr.service];ctx.beginPath();ctx.arc(point[0]+21,point[1]-10,2,0,7);ctx.fill();ctx.fillStyle='#eaf4ef';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(text,point[0]+28,point[1]-9);
  }
 }
 for(let home=0;home<3;home++){
  const calls=active.filter(c=>c.home===home).sort((a,b)=>b.priority-a.priority||a.due-b.due);if(!calls.length)continue;
  const c=calls[0],service=TYPES[c.type][1],color=COLORS[service],p=view.project(MARKERS[home]),r=16,pulse=motion?1+Math.sin(now/500)*.1:1;
  ctx.fillStyle=color+'25';ctx.beginPath();ctx.arc(...p,r*2*pulse,0,7);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.shadowBlur=25;ctx.shadowColor=color;
  ctx.beginPath();ctx.moveTo(p[0],p[1]+r);ctx.lineTo(p[0],p[1]+r+25);ctx.stroke();ctx.beginPath();ctx.arc(...p,r,0,7);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#ffffffe6';ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
  ctx.save();ctx.translate(...p);ctx.scale(.85,.85);ctx.fillStyle='#fff';ctx.strokeStyle='#fff';ctx.lineWidth=2.3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  if(service===0){ctx.moveTo(0,-12);ctx.bezierCurveTo(-3,-6,-9,0,-8,5);ctx.bezierCurveTo(-7,14,8,14,8,4);ctx.bezierCurveTo(8,-1,3,-7,0,-12);ctx.fill();}
  else if(service===1){ctx.moveTo(3,-12);ctx.lineTo(-7,2);ctx.lineTo(-1,2);ctx.lineTo(-3,12);ctx.lineTo(8,-3);ctx.lineTo(2,-3);ctx.closePath();ctx.fill();}
  else {ctx.moveTo(-8,9);ctx.lineTo(8,-9);ctx.moveTo(-8,-9);ctx.lineTo(8,9);ctx.moveTo(4,-11);ctx.lineTo(9,-6);ctx.moveTo(-9,-7);ctx.lineTo(-5,-11);ctx.stroke();}
  ctx.restore();
  if(calls.length>1){ctx.fillStyle='#f3f8f4';ctx.beginPath();ctx.arc(p[0]+14,p[1]-12,8,0,7);ctx.fill();ctx.fillStyle='#08212a';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(calls.length,p[0]+14,p[1]-12);}
  view.hits.unshift({point:p,call:c.id,radius:30});
 }
}
function drawVan(ctx,p,angle,color,pickup){
 ctx.save();ctx.translate(...p);ctx.rotate(angle);ctx.fillStyle='#00121a80';ctx.beginPath();ctx.ellipse(2,4,16,9,0,0,7);ctx.fill();ctx.fillStyle='#101e24';for(const x of [-9,9])for(const y of [-8,7])ctx.fillRect(x-2,y,5,3);
 ctx.fillStyle='#fff';ctx.strokeStyle='#08202c';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-16,-8,32,16,4);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillRect(-14,-6,pickup?12:18,12);ctx.fillStyle='#eff5ee';ctx.fillRect(-11,-3,8,6);
 ctx.fillStyle='#183b49';ctx.beginPath();ctx.roundRect(7,-6,6,12,2);ctx.fill();ctx.fillStyle='#fff6b4';ctx.fillRect(14,-6,2,3);ctx.fillRect(14,3,2,3);ctx.restore();
}
