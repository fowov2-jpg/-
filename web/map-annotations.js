// Place incident controls along the unobscured map perimeter with real 44px tap targets.
export function placeEdgeIndicators(items,{width,height,top=134,bottom=height-112,avoid=[]}){
 if(bottom<top||width<54||height<top+27)return [];
 const left=27,right=Math.max(left,width-27),last=Math.max(top,Math.min(height-27,bottom));
 const slots=[];
 const segment=(ax,ay,bx,by)=>{
  const count=Math.max(1,Math.floor(Math.hypot(bx-ax,by-ay)/48));
  for(let i=0;i<=count;i++)slots.push([ax+(bx-ax)*i/count,ay+(by-ay)*i/count]);
 };
 segment(left,top,right,top);segment(right,top,right,last);segment(right,last,left,last);segment(left,last,left,top);
 const placed=[];
 for(const item of items.slice(0,8)){
  const [px,py]=item.point,dx=px-width/2,dy=py-(top+last)/2;
  const factor=Math.max(1,Math.abs(dx)/Math.max(1,(right-left)/2),Math.abs(dy)/Math.max(1,(last-top)/2));
  const preferred=[width/2+dx/factor,(top+last)/2+dy/factor];
  const free=slots.filter(p=>placed.every(q=>Math.hypot(p[0]-q.x,p[1]-q.y)>=46)&&avoid.every(r=>p[0]+24<=r.x||p[0]-24>=r.x+r.w||p[1]+24<=r.y||p[1]-24>=r.y+r.h));
  free.sort((a,b)=>Math.hypot(a[0]-preferred[0],a[1]-preferred[1])-Math.hypot(b[0]-preferred[0],b[1]-preferred[1]));
  if(!free.length)break;
  const [x,y]=free[0];placed.push({...item,x,y,angle:Math.atan2(py-y,px-x)});
 }
 return placed;
}
