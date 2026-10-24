import {TW,TH,hash,pathPose,pathLength} from './campaign-city.js';
const loops=new Map(),paints=['#d8d8ce','#9dafba','#596a7a','#b67461','#c3ac75','#d4e2e5'];
// Clockwise quarter loops occupy the right lane. Cars have fixed headway and dwell at turns.
function loop(tileX,tileY,quarter){
 const key=tileX+','+tileY+','+quarter;if(loops.has(key))return loops.get(key);
 const x=tileX*TW+(quarter%2)*708,y=tileY*TH+Math.floor(quarter/2)*434;
 const bottom=quarter<2?424:430,corners=[[x+12,y+10],[x+698,y+10],[x+698,y+bottom],[x+12,y+bottom]],radius=12;
 const p=corners.map((corner,i)=>{
  const next=corners[(i+1)%4],after=corners[(i+2)%4],length=Math.hypot(next[0]-corner[0],next[1]-corner[1]),nextLength=Math.hypot(after[0]-next[0],after[1]-next[1]);
  const start=corner.map((v,j)=>v+(next[j]-v)*radius/length),end=next.map((v,j)=>v+(corner[j]-v)*radius/length),exit=next.map((v,j)=>v+(after[j]-v)*radius/nextLength),arc=[end];
  for(let k=1;k<=8;k++){const t=k/8;arc.push(end.map((v,j)=>(1-t)*(1-t)*v+2*(1-t)*t*next[j]+t*t*exit[j]));}
  const stop=end.map((v,j)=>v+(corner[j]-next[j])*24/length);
  return {straight:[start,stop],approach:[stop,end],arc,straightLength:pathLength([start,stop]),approachLength:24,arcLength:pathLength(arc)};
 });loops.set(key,p);return p;
}
function trafficCar(seed,col,row,q,slot,time){
 const path=loop(col,row,q),speed=68+hash(seed+q,col*71+row*109)%18,period=path.reduce((n,p)=>n+(p.straightLength+p.approachLength+p.arcLength)/speed+2,0),key=hash(seed+q*73,col*997+row*37);
 let left=((time+slot*period/2+(key%1000)/1000*period)%period+period)%period,pose=null,stopped=false;
 for(const section of path){const straight=section.straightLength/speed,approach=section.approachLength/speed,turn=section.arcLength/speed;if(left<straight){pose=pathPose(section.straight,left/straight);break;}if(left<straight+2){pose=pathPose(section.straight,1);stopped=true;break;}if(left<straight+2+approach){pose=pathPose(section.approach,(left-straight-2)/approach);break;}if(left<straight+2+approach+turn){pose=pathPose(section.arc,(left-straight-2-approach)/turn);break;}left-=straight+2+approach+turn;}
 pose??=pathPose(path[0].straight,0);return {id:`${col}:${row}:${q}:${slot}`,point:pose.point,angle:pose.angle,stopped,color:paints[(key+slot)%paints.length],col,row,q,slot};
}
export function trafficPoses(seed,col,row,time){return Array.from({length:8},(_,i)=>trafficCar(seed,col,row,Math.floor(i/2),i%2,time));}
export class TrafficController{
 constructor(){this.entries=new Map();}
 frame(seed,tiles,time,blockers=[]){
  const result=[],updates=[];
  for(const [col,row] of tiles)for(let i=0;i<8;i++){
   const q=Math.floor(i/2),slot=i%2,id=`${col}:${row}:${q}:${slot}`,key=seed+':'+id,old=this.entries.get(key),delta=old?time-old.time:0;
   let virtual=time,factor=1;
   if(old&&delta>=0&&delta<=2){
    virtual=old.virtual;const pose=old.pose,targets=[...blockers],other=this.entries.get(seed+`:${col}:${row}:${q}:${1-slot}`);if(other)targets.push(other.pose.point);
    let target=1;for(const p of targets){const dx=p[0]-pose.point[0],dy=p[1]-pose.point[1],ahead=dx*Math.cos(pose.angle)+dy*Math.sin(pose.angle),side=Math.abs(-dx*Math.sin(pose.angle)+dy*Math.cos(pose.angle));if(ahead>0&&ahead<60&&side<13)target=Math.min(target,Math.max(0,(ahead-26)/34));}
    factor=Math.min(target,(old.factor??1)+delta*.7);virtual+=delta*factor;
   }
   const pose=trafficCar(seed,col,row,q,slot,virtual);pose.stopped=pose.stopped||factor<.15;result.push(pose);updates.push([key,{time,virtual,factor,pose}]);
  }
  for(const [k,v] of updates)this.entries.set(k,v);
  if(this.entries.size>4096){const visible=new Set(updates.map(([k])=>k));for(const k of this.entries.keys()){if(!visible.has(k))this.entries.delete(k);if(this.entries.size<=3072)break;}}
  return result;
 }
}
export function drawTrafficCar(ctx,p,angle,scale,color,stopped){
 const l=Math.max(5,Math.min(20,20*scale)),w=l*.47;ctx.save();ctx.translate(...p);ctx.rotate(angle+Math.PI/2);ctx.fillStyle='#172d35';ctx.fillRect(-w*.62,-l*.3,w*1.24,l*.12);ctx.fillRect(-w*.62,l*.2,w*1.24,l*.12);
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-w/2,-l/2,w,l,Math.max(1,w*.2));ctx.fill();ctx.fillStyle='#355363';ctx.fillRect(-w*.34,-l*.23,w*.68,l*.18);ctx.fillRect(-w*.3,l*.22,w*.6,l*.1);ctx.fillStyle=stopped?'#f97960':'#9e5049';ctx.fillRect(-w*.4,l*.4,w*.25,1);ctx.fillRect(w*.15,l*.4,w*.25,1);ctx.restore();
}
