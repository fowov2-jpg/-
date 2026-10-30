import {COLORS,TYPES} from './engine.js';
import {deadline,queue} from './dispatch.js';
import {ROAD_STOPS,routePlan} from './routing.js';
const houses=[[2,2],[6,2],[2,6]],stops=ROAD_STOPS;
const iso=(x,y,z=0)=>[500+(x-y)*49,100+(x+y)*27-z];
export function route(from,to){return routePlan(from,to).points;}
export function renderMap(canvas,state,view){
 const dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#213d39';ctx.fillRect(0,0,rect.width,rect.height);
 const base=Math.min(rect.width/850,rect.height/700),scale=base*view.zoom;
 const ox=rect.width/2-500*scale+view.x,oy=rect.height/2-385*scale+view.y;
 ctx.translate(ox,oy);ctx.scale(scale,scale);view.project=(p)=>[p[0]*scale+ox,p[1]*scale+oy];view.hits=[];
 function poly(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
 function ground(x,y,w,h,color){poly([iso(x,y),iso(x+w,y),iso(x+w,y+h),iso(x,y+h)],color);}
 function line(points,color,width=2,dash=[]){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
 ground(-1,-1,12,12,'#657a50');
 for(let x=-1;x<11;x++)for(let y=-1;y<11;y++)ground(x+.05,y+.05,.9,.9,(x+y)%3?'#667d50':'#71885b');
 for(const t of [0,4,8]){ground(t-.45,-1,.9,12,'#a9ae9c');ground(-1,t-.45,12,.9,'#a9ae9c');ground(t-.32,-1,.64,12,'#49565b');ground(-1,t-.32,12,.64,'#49565b');line([iso(t,-1),iso(t,11)],'#a8b1a6',1,[8,10]);line([iso(-1,t),iso(11,t)],'#a8b1a6',1,[8,10]);}
 for(let k=0;k<60;k++){let x=((k*37)%107)/10-.5,y=((k*61)%107)/10-.5;if([0,4,8].some(n=>Math.abs(x-n)<.65||Math.abs(y-n)<.65)||houses.some(h=>Math.abs(x-h[0])<1.4&&Math.abs(y-h[1])<1.2))continue;const p=iso(x,y);ctx.fillStyle='#456442';ctx.beginPath();ctx.ellipse(p[0]+7,p[1]+2,15,7,0,0,7);ctx.fill();line([p,[p[0],p[1]-23]],'#5c5540',4);for(let j=0;j<3;j++){ctx.fillStyle=['#315d46','#467955','#69935a'][j];ctx.beginPath();ctx.arc(p[0]+(j-1)*4,p[1]-23-j*5,12-j*2,0,7);ctx.fill();}}
 function building(x,y,owned,index){const w=1.8,h=1.25,z=owned?79:55;const a=iso(x-w/2,y-h/2),b=iso(x+w/2,y-h/2),c=iso(x+w/2,y+h/2),d=iso(x-w/2,y+h/2);const top=p=>[p[0],p[1]-z];poly([a,b,c,d], '#38463f');poly([b,c,top(c),top(b)],owned?'#ad9278':'#84948d');poly([d,c,top(c),top(d)],owned?'#d6b69a':'#a0aaa0');poly([top(a),top(b),top(c),top(d)],'#8d9995','#c0c8b7');
 for(let floor=0;floor<(owned?4:3);floor++)for(let win=1;win<=5;win++){const t=win/6,px=d[0]+(c[0]-d[0])*t,py=d[1]+(c[1]-d[1])*t-14-floor*17;poly([[px-4,py-7],[px+3,py-3],[px+3,py+5],[px-4,py+1]],(floor+win)%4===0?'#f5d48c':'#476575');}
 for(let floor=0;floor<4;floor++)for(let win=1;win<=3;win++){const t=win/4,px=b[0]+(c[0]-b[0])*t,py=b[1]+(c[1]-b[1])*t-14-floor*17;poly([[px-3,py-4],[px+3,py-7],[px+3,py+1],[px-3,py+4]],'#3a5968');}
 const roof=iso(x,y,z+2);poly([[roof[0]-15,roof[1]-7],[roof[0]+15,roof[1]+4],[roof[0]+15,roof[1]-7],[roof[0]-15,roof[1]-18]],'#71807e');
 if(owned){const p=iso(x,y,z+22);label(state.homes[index].name,p,'#0b202bdc',11);view.hits.push({point:view.project(iso(x,y,z/2)),home:index});}}
 function label(text,p,bg,size=12){ctx.font=`600 ${size}px sans-serif`;const width=ctx.measureText(text).width+18;ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(p[0]-width/2,p[1]-14,width,24,6);ctx.fill();ctx.fillStyle='#f0f6ef';ctx.textAlign='center';ctx.fillText(text,p[0],p[1]+2);}
 [[10,2],[2,10],[6,10],[10,6]].forEach(([x,y])=>building(x,y,false));houses.forEach(([x,y],i)=>building(x,y,true,i));
 ground(5,5,1.5,1.8,'#426f62');line([iso(5,5),iso(6.5,5),iso(6.5,6.8),iso(5,6.8),iso(5,5)],'#c4d3a8',2);label('УК «Уют» · гараж',iso(8,8,-28),'#0b202be0');
 for(const cr of state.crews){let pos=stops[cr.home];if(cr.status==='travel'){const c=state.calls.find(c=>c.id===cr.job);if(!c)continue;const r=Array.isArray(cr.route)&&cr.route.length?cr.route:routePlan(cr.home,c.home,{day:state.day,minute:state.minute}).points,segments=r.slice(1).map((p,i)=>Math.hypot(p[0]-r[i][0],p[1]-r[i][1])),total=segments.reduce((a,b)=>a+b,0);line(r.map(p=>iso(...p)),COLORS[cr.service],3,[8,5]);let distance=(1-cr.remaining/cr.total)*total;for(let i=0;i<segments.length;i++){if(distance<=segments[i]||i===segments.length-1){const t=segments[i]?distance/segments[i]:0;pos=[r[i][0]+(r[i+1][0]-r[i][0])*t,r[i][1]+(r[i+1][1]-r[i][1])*t];break;}distance-=segments[i];}}
 const p=iso(...pos);ctx.save();ctx.translate(p[0]+cr.id*8,p[1]);ctx.fillStyle=COLORS[cr.service];ctx.beginPath();ctx.roundRect(-13,-9,26,15,4);ctx.fill();ctx.fillStyle='#12303f';ctx.fillRect(3,-7,7,10);ctx.fillStyle='#e4e8e2';ctx.fillRect(-10,-5,10,6);ctx.restore();}
 for(let i=0;i<3;i++){const calls=state.calls.filter(c=>c.home===i&&c.status!=='done');if(!calls.length)continue;const c=queue(state).find(item=>item.home===i),p=iso(...houses[i],125);const urgency=deadline(state,c).level;ctx.shadowBlur=16;ctx.shadowColor=COLORS[TYPES[c.type][1]];ctx.fillStyle=COLORS[TYPES[c.type][1]];ctx.beginPath();ctx.arc(...p,19,0,7);ctx.fill();ctx.shadowBlur=0;if(urgency==='critical'||urgency==='overdue'){ctx.strokeStyle=urgency==='overdue'?'#ffdddd':'#ffd78b';ctx.lineWidth=5;ctx.beginPath();ctx.arc(...p,23,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#071b24';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText(['В','Э','Р'][TYPES[c.type][1]],p[0],p[1]+7);view.hits.unshift({point:view.project(p),call:c.id});}
}
