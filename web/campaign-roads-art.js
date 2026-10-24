import {TW,TH,DW,DH,ROAD_X,ROAD_Y} from './campaign-city.js';
import {bridgeSites} from './city-geography.js';
export function roadAxes(origin,step,size,offsets){const set=new Set();for(let i=0;i<8;i++)for(const p of offsets)set.add(origin+i*step+p);return [...set].filter(v=>v>=origin&&v<=origin+size);}
export function drawRoads(ctx,project,origin,scale,width,height,seed=112){
 const xs=roadAxes(origin[0],TW,DW,ROAD_X),ys=roadAxes(origin[1],TH,DH,ROAD_Y);
 const line=(a,b)=>{const p=project(a),q=project(b);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.lineCap='butt';ctx.setLineDash([]);ctx.strokeStyle='#b2aea0';ctx.lineWidth=52*scale;ctx.stroke();ctx.strokeStyle='#585f60';ctx.lineWidth=46*scale;ctx.stroke();ctx.strokeStyle='#dddcc7';ctx.lineWidth=Math.max(.3,1*scale);ctx.setLineDash([10*scale,12*scale]);ctx.stroke();ctx.setLineDash([]);};
 for(const x of xs){const p=project([x,0]);if(p[0]>-40&&p[0]<width+40)line([x,origin[1]],[x,origin[1]+DH]);}
 for(const y of ys){const p=project([0,y]);if(p[1]>-40&&p[1]<height+40)line([origin[0],y],[origin[0]+DW,y]);}
 if(scale<.12)return;
 for(const x of xs)for(const y of ys){const p=project([x,y]);if(p[0]<-40||p[0]>width+40||p[1]<-40||p[1]>height+40)continue;
  ctx.fillStyle='#585f60';ctx.fillRect(p[0]-23*scale,p[1]-23*scale,46*scale,46*scale);ctx.fillStyle='#e7e6d7';
  for(let i=-16;i<=16;i+=5)for(const sign of [-1,1]){ctx.fillRect(p[0]+i*scale,p[1]+sign*29*scale,3*scale,8*scale);ctx.fillRect(p[0]+sign*29*scale,p[1]+i*scale,8*scale,3*scale);}
 }
 for(const bridge of bridgeSites(seed,origin)){
  const p=project([bridge.x,bridge.y]),length=bridge.length*scale;if(p[0]<-length||p[0]>width+length||p[1]<-length||p[1]>height+length)continue;
  ctx.save();ctx.translate(...p);ctx.rotate(bridge.angle);ctx.fillStyle='#303d4180';ctx.fillRect(-length/2,-28*scale,length,60*scale);ctx.fillStyle='#687174';ctx.fillRect(-length/2,-25*scale,length,50*scale);
  ctx.strokeStyle='#d8dfd6';ctx.lineWidth=Math.max(.7,2*scale);for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-length/2,side*27*scale);ctx.lineTo(length/2,side*27*scale);ctx.stroke();for(let x=-length/2;x<=length/2;x+=15*scale){ctx.fillStyle='#d3d8cf';ctx.fillRect(x,side*27*scale-2*scale,2*scale,4*scale);}}
  ctx.strokeStyle='#e3e0c7';ctx.lineWidth=Math.max(.4,scale);ctx.setLineDash([10*scale,12*scale]);ctx.beginPath();ctx.moveTo(-length/2,0);ctx.lineTo(length/2,0);ctx.stroke();ctx.setLineDash([]);ctx.restore();
 }
}
