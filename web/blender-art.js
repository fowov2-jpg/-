import {ART_SHEETS,BLENDER_MODELS,BLENDER_PROPS} from './blender-manifest.js';

const images={},listeners=new Set();
let started=false;
let rigBlendCanvas;
const tau=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
const shortest=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function loadBlenderArt(redraw){
 if(redraw)listeners.add(redraw);
 if(started)return;started=true;
 for(const [kind,pages] of Object.entries(ART_SHEETS))images[kind]=pages.map(page=>{
  const im=new Image();im.onload=im.onerror=()=>{for(const fn of listeners)fn();};
  im.src=new URL(page.src,import.meta.url).href;return im;
 });
}
export function blenderArtReady(){return started&&Object.entries(ART_SHEETS).every(([kind,pages])=>pages.length&&images[kind]?.every(im=>im.complete&&im.naturalWidth));}
function frameReady(kind,frame){return !!frame&&!!images[kind]?.[frame[0]]?.naturalWidth;}
function drawFrame(ctx,kind,frame,scale,angle=0,alpha=1){
 if(!frameReady(kind,frame)||alpha<=0)return false;
 const [page,x,y,w,h,ox,oy]=frame;ctx.save();ctx.rotate(angle);ctx.globalAlpha*=alpha;
 ctx.drawImage(images[kind][page],x,y,w,h,-ox*scale,-oy*scale,w*scale,h*scale);ctx.restore();return true;
}
function directional(ctx,kind,frames,angle,scale,alpha=1){
 const raw=angle/tau*frames.length,index=Math.round(raw),frame=frames[(index%frames.length+frames.length)%frames.length];
 return drawFrame(ctx,kind,frame,scale,shortest(angle-index*tau/frames.length),alpha);
}
function deploymentFrame(ctx,lower,upper,blend,angle,scale){
 if(!blend||lower===upper)return directional(ctx,'rig',lower,angle,scale);
 if(!rigBlendCanvas){rigBlendCanvas=document.createElement('canvas');rigBlendCanvas.width=rigBlendCanvas.height=256;}
 const buffer=rigBlendCanvas.getContext('2d'),raw=angle/tau*8,index=Math.round(raw),direction=(index%8+8)%8;
 buffer.clearRect(0,0,256,256);buffer.save();buffer.translate(128,128);
 drawFrame(buffer,'rig',lower[direction],1,0,1-blend);
 // Add premultiplied samples before compositing over the chassis. Painting two
 // translucent poses directly would make their shared metal parts see-through.
 buffer.globalCompositeOperation='lighter';drawFrame(buffer,'rig',upper[direction],1,0,blend);buffer.restore();
 ctx.save();ctx.rotate(shortest(angle-index*tau/8));ctx.drawImage(rigBlendCanvas,-128*scale,-128*scale,256*scale,256*scale);ctx.restore();
 return true;
}
function prop(ctx,name,x,y,metresToPixels,angle=0,minimum=0){
 const item=BLENDER_PROPS[name];if(!item)return false;
 ctx.save();ctx.translate(x,y);
 const scale=Math.max(item.view*metresToPixels,minimum)/item.cell;
 const drawn=drawFrame(ctx,'props',item.frame,scale,angle);ctx.restore();return drawn;
}
// The body stays detailed during work. The upper mechanism has its own camera
// origin and deployment poses, so it can aim at a house without rotating the truck.
export function drawBlenderVehicle(ctx,id,frame,length,angle,aim=angle){
 const model=BLENDER_MODELS[id];if(!model||!model.body.every(f=>frameReady('body',f)))return false;
 if(model.rig&&!model.rig.every(row=>row.every(f=>frameReady('rig',f))))return false;
 const heading=angle+Math.PI/2,ppm=length/model.metres,d=clamp(frame.deployment);
 if(model.rig&&model.mechanism!=='tipper'&&d>0){
  ctx.save();ctx.rotate(heading);
  for(const y of [-length*.08,length*.28]){
   ctx.save();ctx.translate(0,y);ctx.scale(.55+.45*d,1);prop(ctx,'stabilizer',0,0,ppm*1.6);ctx.restore();
  }
  ctx.restore();
 }
 directional(ctx,'body',model.body,heading,model.bodyView*ppm/model.bodyCell);
 if(model.rig){
  const turn=['tipper','scissor'].includes(model.mechanism)?0:shortest(aim-angle);
  const direction=heading+d*turn+(frame.phase==='working'&&!['tipper','scissor'].includes(model.mechanism)?Math.sin(frame.cycle*tau)*.018:0);
  const deployment=model.mechanism==='tipper'&&frame.phase==='working'?.98+.02*Math.sin(frame.cycle*tau):d;
  const pose=clamp(deployment)*4,lower=Math.floor(pose),upper=Math.min(4,lower+1),blend=pose-lower;
  ctx.save();ctx.translate(Math.sin(heading)*model.pivot*ppm,-Math.cos(heading)*model.pivot*ppm);
  const scale=model.rigView*ppm/256;
  deploymentFrame(ctx,model.rig[lower],model.rig[upper],blend,direction,scale);
  ctx.restore();
 }
 return true;
}

// ctx uses the vehicle's local frame; site geometry follows the real house bearing.
export function drawBlenderWorksite(ctx,id,length,width,call,service,clock,progress,motion,aim){
 if(!BLENDER_PROPS['worker-0-0']||!frameReady('props',BLENDER_PROPS['worker-0-0'].frame))return false;
 if(!call||!['diagnosis','repair'].includes(call.status))return true;
 const model=BLENDER_MODELS[id],ppm=length/(model?.metres??5.5),elapsed=call.total-call.remaining+(motion?progress:0);
 const trip=call.status==='diagnosis'?0:motion?clamp(Math.min(elapsed/3,(call.remaining-progress)/3)):1;
 const reach=length*.75,entry=width*.65+4,distance=entry+(reach-entry)*trip;
 const dx=Math.cos(aim)*reach,dy=Math.sin(aim)*reach;
 for(const side of [-1,1])prop(ctx,'cone',side*(width*.8+3),length*.58,ppm,0,8);
 prop(ctx,'barrier',width*.9,length*.15,ppm,Math.PI/2,15);
 prop(ctx,'toolbox',-width*.8,length*.45,ppm,0,8);
 if(call.status==='repair'){
  const item=['pump','cable-reel','generator'][service];prop(ctx,item,dx-Math.sin(aim)*7,dy+Math.cos(aim)*7,ppm,aim,11);
  // Flexible hose/cable joins the rendered equipment to the vehicle.
  ctx.beginPath();ctx.moveTo(-width*.45,length*.35);ctx.bezierCurveTo(-width,length*.65,dx-9,dy+8,dx,dy);
  ctx.lineWidth=Math.max(1.1,ppm*.08);ctx.strokeStyle=['#304959','#a18a52','#3f4442'][service];ctx.stroke();
  if(trip>.9){
   const phase=motion?(clock%2)/2:0;
   ctx.save();ctx.translate(dx,dy);ctx.rotate(aim);
   if(service===0){
    ctx.lineWidth=1;ctx.strokeStyle='#91c5d2a0';
    for(let i=0;i<3;i++){ctx.globalAlpha=(1-phase)*.55;ctx.beginPath();ctx.arc(0,0,3+phase*5+i*2,Math.PI*.12,Math.PI*.88);ctx.stroke();}
   }else if(service===1){
    ctx.fillStyle=phase<.45?'#dfddad':'#80b7a2';ctx.beginPath();ctx.arc(-3,3,1.2,0,tau);ctx.fill();
   }else{
    ctx.fillStyle='#b8aa8a';for(let i=0;i<3;i++){const t=(phase+i/3)%1;ctx.globalAlpha=(1-t)*.3;ctx.beginPath();ctx.arc(2+i*2,2-t*5,.7+t,0,tau);ctx.fill();}
   }
   ctx.restore();
  }
 }
 for(let i=0;i<2;i++){
  const x=Math.cos(aim)*distance-Math.sin(aim)*(i?5:-5),y=Math.sin(aim)*distance+Math.cos(aim)*(i?5:-5);
  const step=motion&&trip>0&&trip<1?Math.floor(clock*7+i*2)%4:motion&&call.status==='repair'&&trip>.9?Math.floor(clock*1.5+i*2)%4:0;
  prop(ctx,`worker-${service}-${step}`,x,y,ppm,aim+Math.PI/2,13);
 }
 return true;
}
