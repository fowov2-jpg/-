import {pathLength,pathPose} from './campaign-city.js';
import {rigTimings} from './campaign-balance.js';
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const curves=new WeakMap();
export function drawBasicVehicle(ctx,length,width,model,serviceColor){
 ctx.fillStyle='#172c33';for(const y of [-length*.28,length*.24]){ctx.fillRect(-width*.6,y,width*1.2,3);}
 ctx.fillStyle=model==='express'?'#ccd8df':'#e1e5d9';ctx.beginPath();ctx.roundRect(-width/2,-length/2,width,length,3);ctx.fill();
 ctx.fillStyle='#406171';ctx.fillRect(-width*.35,-length*.32,width*.7,length*.18);ctx.fillStyle=serviceColor;ctx.fillRect(-width*.4,-length*.08,width*.8,3);
 if(model==='truck'){ctx.fillStyle='#526c73';ctx.fillRect(-width*.4,length*.04,width*.8,length*.36);ctx.fillStyle='#c5ae73';ctx.fillRect(-width*.25,length*.14,width*.5,length*.13);}
 else{ctx.strokeStyle='#889a9e';ctx.lineWidth=1;for(const x of [-width*.2,width*.2]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,length*.35);ctx.stroke();}for(let y=1;y<length*.35;y+=4){ctx.beginPath();ctx.moveTo(-width*.2,y);ctx.lineTo(width*.2,y);ctx.stroke();}}
}
export function roundedRoute(path){
 if(curves.has(path))return curves.get(path);if(path.length<3)return path;
 const result=[[...path[0]]];
 for(let i=1;i<path.length-1;i++){
  const a=path[i-1],b=path[i],c=path[i+1],l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]);
  if(l1<.001||l2<.001)continue;
  const radius=Math.min(14,l1/3,l2/3),p=b.map((v,j)=>v+(a[j]-v)*radius/l1),q=b.map((v,j)=>v+(c[j]-v)*radius/l2);result.push(p);
  for(let k=1;k<=8;k++){const t=k/8;result.push(p.map((v,j)=>(1-t)*(1-t)*v+2*(1-t)*t*b[j]+t*t*q[j]));}
 }
 result.push([...path.at(-1)]);curves.set(path,result);return result;
}
export function drivingPose(path,progress){
 const curve=roundedRoute(path),pose=pathPose(curve,progress),distance=pathLength(curve),left=(1-clamp(progress))*distance;
 const turning=path.slice(1,-1).some(p=>Math.hypot(pose.point[0]-p[0],pose.point[1]-p[1])<35);
 return {...pose,braking:left<40,turning};
}
export function equipmentState(model,call,progress=0,motion=true){
 const rig=rigTimings(model);if(!rig.setup||!call||call.status==='new'||call.status==='travel')return {phase:'stowed',deployment:0,cycle:0};
 if(call.status==='diagnosis')return {phase:'inspection',deployment:0,cycle:0};
 const elapsed=Math.max(0,call.total-call.remaining+(motion?progress:0)),setup=Math.min(rig.setup,call.total/3),stow=Math.min(rig.stow,call.total/3);
 if(!motion)return {phase:'working',deployment:1,cycle:0};
 if(elapsed<setup)return {phase:'deploying',deployment:smooth(elapsed/setup),cycle:0};
 if(elapsed>call.total-stow)return {phase:'stowing',deployment:smooth((call.total-elapsed)/stow),cycle:1};
 return {phase:'working',deployment:1,cycle:(elapsed-setup)%6/6};
}
export function drawRig(ctx,model,frame,length,width,clock,serviceColor,aim=0){
 const {deployment:d,cycle,phase}=frame,palettes={'maz-crane':'#cb554a','gaz53-scissor-lift':'#ddd0a7','gaz53-aerial-lift':'#8bb9c4','gaz3307-tipper':'#dddcc9','gazelle-next-aerial-lift':'#89c3d5'},paint=palettes[model.id]??(model.kind==='tipper'?'#e8892b':'#5094b4');
 ctx.save();ctx.scale(length/70,length/70);const w=width*70/length,l=70;
 const axles=['kamaz-crane','maz-crane'].includes(model.id)?[-22,-8,14,25]:['kamaz6520-tipper','maz-tipper'].includes(model.id)?[-22,14,25]:[-22,22];
 ctx.fillStyle='#142b31';for(const y of axles)for(const x of [-w/2-2,w/2-1])ctx.fillRect(x,y,3,9);
 ctx.fillStyle='#536b72';ctx.fillRect(-w/2,-l/2,w,l);ctx.fillStyle=paint;ctx.beginPath();ctx.roundRect(-w/2,-35,w,23,3);ctx.fill();
 ctx.fillStyle='#1d465d';ctx.fillRect(-w*.38,-31,w*.76,7);ctx.fillStyle='#f4e7ad';ctx.fillRect(-w*.38,-35,4,2);ctx.fillRect(w*.38-4,-35,4,2);
 ctx.fillStyle=serviceColor;ctx.fillRect(-w*.4,-18,w*.8,3);
 // Stabilizers deploy before the upper mechanism; they never appear while travelling.
 if(model.kind!=='tipper')for(const y of [-5,23]){ctx.strokeStyle='#b5b6a7';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-w/2-12*d,y);ctx.lineTo(w/2+12*d,y);ctx.stroke();ctx.fillStyle='#2d4246';ctx.fillRect(-w/2-14*d-2,y-3,5,6);ctx.fillRect(w/2+14*d-2,y-3,5,6);}
 if(model.kind==='tipper'){
  const tip=d*(phase==='working'?.72+.18*Math.sin(cycle*Math.PI*2):.72),bed=44*(1-tip*.45),y=32-bed;
  ctx.strokeStyle='#a5b5b1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,25);ctx.lineTo(0,y+5);ctx.stroke();
  ctx.fillStyle='#ae5829';ctx.fillRect(-w*.46,y,w*.92,bed);ctx.fillStyle='#e6a24d';ctx.fillRect(-w*.37,y+3,w*.74,bed-6);ctx.strokeStyle='#834c29';ctx.lineWidth=1;for(let row=y+6;row<30;row+=7){ctx.beginPath();ctx.moveTo(-w*.35,row);ctx.lineTo(w*.35,row);ctx.stroke();}
  ctx.fillStyle='#cfb58a';if(phase==='working')for(let i=0;i<7;i++){const t=(cycle+i/7)%1;ctx.globalAlpha=1-t;ctx.beginPath();ctx.arc((i%3-1)*5,34+t*18,1.3+t*2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 }else{
  ctx.fillStyle=model.id==='maz-crane'?'#b84539':model.id==='kamaz-crane'?'#cbd6d6':'#d0ac41';ctx.fillRect(-w*.4,-8,w*.8,37);ctx.save();ctx.translate(0,12);
  const turn=Math.atan2(Math.sin(aim+Math.PI/2),Math.cos(aim+Math.PI/2)),angle=-Math.PI/2+d*turn+Math.sin(cycle*Math.PI*2)*.035*d;ctx.rotate(angle);
  if(model.id==='gaz53-scissor-lift'){
   const reach=19+d*34;ctx.strokeStyle='#be6550';ctx.lineWidth=2;for(let i=0;i<3;i++){const x=i*reach/3;ctx.beginPath();ctx.moveTo(x,-7);ctx.lineTo(x+reach/3,7);ctx.moveTo(x,7);ctx.lineTo(x+reach/3,-7);ctx.stroke();}ctx.fillStyle='#c6bda4';ctx.fillRect(reach-3,-10,13,20);ctx.strokeStyle='#f6e4b2';ctx.strokeRect(reach-3,-10,13,20);
  }else if(model.kind==='lift'){
   const joint=19+d*10;ctx.strokeStyle=model.id==='gaz53-aerial-lift'?'#e3cb61':'#d8e2dd';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(joint,0);ctx.lineTo(joint+14+d*20,-d*12);ctx.stroke();ctx.fillStyle='#465a60';ctx.beginPath();ctx.arc(joint,0,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#cadbd3';ctx.lineWidth=2;ctx.strokeRect(joint+12+d*20,-d*12-7,12,14);
  }else{
   const reach=32+d*40;ctx.strokeStyle=model.id==='gaz53-ks1571-crane'?'#edcf58':'#d8e1de';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(reach,0);ctx.stroke();ctx.strokeStyle='#9e9f8d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(reach*.45,0);ctx.lineTo(reach,0);ctx.stroke();
   if(model.id.includes('ks1571')||model.id==='maz-crane'){ctx.strokeStyle='#f3e3b0';ctx.lineWidth=.8;for(let x=3;x<reach-5;x+=7){ctx.beginPath();ctx.moveTo(x,-3);ctx.lineTo(x+7,3);ctx.moveTo(x,3);ctx.lineTo(x+7,-3);ctx.stroke();}}
   ctx.strokeStyle='#263b40';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(reach,0);ctx.lineTo(reach,8+d*9+Math.sin(cycle*Math.PI*2)*3);ctx.stroke();ctx.fillStyle='#bd8c52';ctx.fillRect(reach-4,14+d*9+Math.sin(cycle*Math.PI*2)*3,8,8);
  }
  ctx.restore();
 }
 ctx.fillStyle=Math.floor(clock*3)%2?'#ffe28a':'#dca438';ctx.fillRect(-w*.35,-25,4,3);ctx.fillRect(w*.35-4,-25,4,3);ctx.restore();
}
export function drawVehicleLights(ctx,length,width,clock,{braking=false,turning=false,working=false}={}){
 ctx.fillStyle='#fff4c0';ctx.fillRect(-width*.4,-length*.47,Math.max(1,width*.18),2);ctx.fillRect(width*.22,-length*.47,Math.max(1,width*.18),2);
 ctx.fillStyle=braking?'#ff6257':'#a54d43';ctx.fillRect(-width*.4,length*.42,Math.max(1,width*.2),2);ctx.fillRect(width*.2,length*.42,Math.max(1,width*.2),2);
 if((turning||working)&&Math.floor(clock*3)%2){ctx.fillStyle='#ffc55d';ctx.fillRect(-width*.55,-length*.32,2,3);ctx.fillRect(width*.45,-length*.32,2,3);}
}
export function drawWorksite(ctx,length,width,call,service,clock,progress,motion,aim){
 if(!call||!['diagnosis','repair'].includes(call.status))return;
 const elapsed=call.total-call.remaining+(motion?progress:0),trip=call.status==='diagnosis'?0:motion?Math.min(1,elapsed/3,Math.max(0,call.remaining-progress)/3):1;
 const reach=length*.75,dx=Math.cos(aim)*reach,dy=Math.sin(aim)*reach,entry=Math.min(width/2/Math.max(.001,Math.abs(Math.cos(aim))),length/2/Math.max(.001,Math.abs(Math.sin(aim))))+4;
 // Rear doors and a marked safe perimeter make ordinary vans visibly work too.
 ctx.strokeStyle='#c9d8d2';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-width*.45,length*.4);ctx.lineTo(-width*.8,length*.6);ctx.moveTo(width*.45,length*.4);ctx.lineTo(width*.8,length*.6);ctx.stroke();
 for(const side of [-1,1]){const x=side*(width*.8+3),y=length*.58;ctx.fillStyle='#eaa449';ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x-2,y+3);ctx.lineTo(x+2,y+3);ctx.fill();}
 for(let i=0;i<2;i++){
  const distance=entry+(reach-entry)*trip,x=Math.cos(aim)*distance-Math.sin(aim)*(i?3:-3),y=Math.sin(aim)*distance+Math.cos(aim)*(i?3:-3),step=motion&&trip>0&&trip<1?Math.sin(clock*9+i)*1.3:0;
  ctx.strokeStyle='#172f3a';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-1,y);ctx.lineTo(x-1-step,y+4);ctx.moveTo(x+1,y);ctx.lineTo(x+1+step,y+4);ctx.stroke();
  ctx.fillStyle=i?'#e8c455':'#69b8d1';ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ead9aa';ctx.beginPath();ctx.arc(x,y-2.3,1.5,0,Math.PI*2);ctx.fill();
 }
 if(call.status==='repair'&&trip>.9){
  const phase=motion?(clock%2)/2:0;
  if(service===0){ctx.strokeStyle='#78d6ed';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(dx,dy,3+phase*5+i*2,Math.PI*.1,Math.PI*.9);ctx.stroke();}}
  else if(service===1){ctx.strokeStyle='#ffe8a0';ctx.lineWidth=1;for(let i=0;i<4;i++){const a=i*Math.PI/2+phase;ctx.beginPath();ctx.moveTo(dx+Math.cos(a)*4,dy+Math.sin(a)*4);ctx.lineTo(dx+Math.cos(a)*7,dy+Math.sin(a)*7);ctx.stroke();}}
  else{ctx.strokeStyle='#b8c6c1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx+3,dy);ctx.lineTo(dx+7,dy-4-Math.sin(phase*Math.PI*2)*2);ctx.stroke();}
 }
}
