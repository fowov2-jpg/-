import {COLORS,TYPES} from './engine.js';

// Procedural isometric district. Every visible route and incident uses live game state.
const houses=[[2,2],[6,2],[2,6]];
const stops=[[2,4],[6,4],[2,8]];
const neighbors=[
 {x:10,y:2,name:'ул. Садовая, 10'},
 {x:2,y:10,name:'ул. Центральная, 3'},
 {x:6,y:10,name:'ул. Молодёжная, 6'},
 {x:10,y:6,name:'ул. Садовая, 16'}
];
const iso=(x,y,z=0)=>[500+(x-y)*49,100+(x+y)*27-z];
const mix=(a,b,t)=>a+(b-a)*t;
const noise=n=>((Math.sin(n*127.1+78.233)*43758.5453)%1+1)%1;

export function route(from,to){
 const a=stops[from]||[8,8],b=stops[to];
 if(from===to)return [a];
 return [a,[4,a[1]],[4,b[1]],b];
}
export function vehiclePosition(crew,state){
 const start=stops[crew.home]||[8,8];
 if(crew.status!=='travel')return start;
 const call=state.calls.find(c=>c.id===crew.job);
 if(!call)return start;
 const points=route(crew.home,call.home);
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const total=lengths.reduce((a,b)=>a+b,0);
 let remain=total*(1-Math.max(0,Math.min(1,crew.remaining/Math.max(1,crew.total))));
 for(let i=0;i<lengths.length;i++){
  const length=lengths[i];
  if(remain<=length||i===lengths.length-1){
   const t=length?Math.min(1,remain/length):0;
   return [mix(points[i][0],points[i+1][0],t),mix(points[i][1],points[i+1][1],t)];
  }
  remain-=length;
 }
 return points[points.length-1];
}

export function renderMap(canvas,state,view){
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const dpr=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2);
 const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const winter=(Math.floor((state.day-1)/7)%4)===0;
 const sky=ctx.createLinearGradient(0,0,rect.width,rect.height);
 sky.addColorStop(0,winter?'#809aa8':'#6e8b78');
 sky.addColorStop(.6,winter?'#506a72':'#3d685f');
 sky.addColorStop(1,'#172f3b');
 ctx.fillStyle=sky;ctx.fillRect(0,0,rect.width,rect.height);

 // Portrait layouts show a cropped district, rather than shrinking the city into a tiny diamond.
 const scale=Math.max(rect.width/1000,rect.height/1070)*view.zoom;
 const ox=rect.width/2-500*scale+view.x;
 const oy=rect.height/2-440*scale+view.y;
 ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
 view.project=p=>[p[0]*scale+ox,p[1]*scale+oy];
 view.hits=[];
 ctx.lineJoin='round';ctx.lineCap='round';
 const poly=(points,fill,stroke=null,lineWidth=1)=>{
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
 };
 const line=(points,color,lineWidth=2,dash=[])=>{
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
 };
 const tile=(x,y,w,h,fill,stroke=null)=>poly(
  [iso(x,y),iso(x+w,y),iso(x+w,y+h),iso(x,y+h)],fill,stroke
 );
 const dot=(x,y,r,fill)=>{
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
 };
 const lerp=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
 function tag(text,p,tint='#0a2030e8',size=12){
  ctx.save();ctx.font='650 '+size+'px system-ui, sans-serif';
  const tw=Math.ceil(ctx.measureText(text).width),w=tw+20;
  ctx.shadowColor='#04111acf';ctx.shadowBlur=10;ctx.shadowOffsetY=3;
  ctx.fillStyle=tint;ctx.beginPath();ctx.roundRect(p[0]-w/2,p[1]-25,w,24,7);ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#edf9ff';ctx.fillText(text,p[0],p[1]-13);
  ctx.restore();
 }
 function lamp(x,y){
  const p=iso(x,y),top=[p[0],p[1]-31];
  line([p,top],'#47545b',3);
  ctx.save();ctx.shadowBlur=14;ctx.shadowColor='#ffe7a7';
  dot(top[0],top[1],4,'#ffe3a0');ctx.restore();
 }
 function tree(x,y,i){
  const p=iso(x,y),t=noise(i),tall=26+22*t;
  ctx.save();ctx.translate(p[0],p[1]);
  ctx.fillStyle='#091c2390';ctx.beginPath();ctx.ellipse(8,7,19,7,-.3,0,7);ctx.fill();
  ctx.fillStyle='#5a5243';ctx.fillRect(-2,-tall*.55,4,tall*.6);
  const evergreen=i%3===0;
  if(evergreen){
   for(let j=0;j<3;j++){
    const v=tall*(.37+j*.2);
    poly([[-13+j*3,-v+9],[0,-tall-8+j*12],[13-j*3,-v+9]],j===0?'#163d43':j===1?'#28564e':'#35745d');
    if(winter)line([[-9+j*2,-v+6],[0,-tall-7+j*12],[8-j*2,-v+6]],'#dce9e9',2);
   }
  }else{
   for(let j=0;j<5;j++){
    const angle=j*2.4,rad=j%2?10:5,cx=Math.cos(angle)*rad,cy=-tall+Math.sin(angle)*7;
    dot(cx,cy,11+4*noise(j+i*11),['#658b5c','#aa9855','#d5a45d','#4f755a'][i%4]);
    if(winter){dot(cx-3,cy-5,5,'#d7e5e8');}
   }
  }
  ctx.restore();
 }
 function car(x,y,rotation,color,service=false){
  const p=iso(x,y);ctx.save();ctx.translate(p[0],p[1]-5);ctx.rotate(rotation);
  ctx.fillStyle='#04151b9c';ctx.beginPath();ctx.ellipse(5,8,21,9,0,0,7);ctx.fill();
  ctx.fillStyle='#1c2a35';ctx.fillRect(-15,3,8,9);ctx.fillRect(9,3,8,9);
  const g=ctx.createLinearGradient(-22,-10,19,12);
  g.addColorStop(0,'#ffffff');g.addColorStop(.22,color);g.addColorStop(1,'#586873');
  ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-22,-12,43,22,5);ctx.fill();
  ctx.fillStyle='#d7f3fb';ctx.fillRect(-7,-9,15,9);
  ctx.fillStyle=service?'#ecf8fe':'#384958';ctx.fillRect(12,-5,6,6);
  ctx.fillStyle=service?'#e8fdff':'#ffd5a0';ctx.fillRect(-21,-2,3,4);
  ctx.restore();
 }
 function apartment(x,y,i,managed=false){
  const w=2.55,h=1.65,z=managed?105:89;
  const a=iso(x-w/2,y-h/2),b=iso(x+w/2,y-h/2);
  const c=iso(x+w/2,y+h/2),d=iso(x-w/2,y+h/2);
  const up=p=>[p[0],p[1]-z];
  const aa=up(a),bb=up(b),cc=up(c),dd=up(d);
  // Exterior shadow, recessed ground plinth, five-storey masonry facades.
  poly([a,b,c,d].map(p=>[p[0]+12,p[1]+13]),'#10232c77');
  poly([b,c,cc,bb],managed?'#b99b87':'#a5a69c','#52616a',1.2);
  poly([d,c,cc,dd],managed?'#dfc0a3':'#c4b4a1','#66737a',1.2);
  poly([aa,bb,cc,dd],winter?'#91a4a7':'#747f84','#d0d9d2',2);
  // Roof parapets, snow caps and rooftop ventilation shafts.
  line([aa,bb,cc,dd,aa],winter?'#e4eced':'#bdc6bd',3);
  const center=iso(x,y,z);
  poly([[center[0]-11,center[1]-6],[center[0],center[1]-12],[center[0]+14,center[1]-4],[center[0]+2,center[1]+2]],'#566976','#b4bfbe');
  poly([[center[0]+18,center[1]+6],[center[0]+27,center[1]+2],[center[0]+27,center[1]-10],[center[0]+18,center[1]-6]],'#74848a');
  if(winter)line([[center[0]-18,center[1]-14],[center[0]+11,center[1]+2]],'#d8e8e9',2);
  // Brick floor levels and lit windows on both visible facades.
  for(let floor=0;floor<5;floor++){
   const zf=12+floor*(z-24)/5;
   for(let win=1;win<=7;win++){
    const t=win/8,base=lerp(d,c,t),px=base[0],py=base[1]-zf;
    const lit=noise(i*71+floor*31+win*13)>.55;
    poly([[px-5,py-8],[px+2,py-4],[px+2,py+3],[px-5,py-1]],lit?'#ffdf91':'#557283','#354d59',.6);
    if(lit)line([[px-4,py-6],[px,py-4]],'#fff0bf',.9);
   }
   for(let win=1;win<=5;win++){
    const t=win/6,base=lerp(b,c,t),px=base[0],py=base[1]-zf;
    const lit=noise(i*39+floor*17+win*7)>.58;
    poly([[px-3,py-4],[px+4,py-8],[px+4,py-1],[px-3,py+3]],lit?'#f5d698':'#476477','#425465',.6);
   }
  }
  const door=lerp(d,c,.5);
  poly([[door[0]-6,door[1]-17],[door[0]+5,door[1]-11],[door[0]+5,door[1]],[door[0]-6,door[1]-6]],'#283e46','#ffcd81',1);
  if(managed){
   tag(state.homes[i].name,iso(x,y,z+18),undefined,11);
   view.hits.push({point:view.project(iso(x,y,z/2)),home:i});
  }else tag(neighbors[i-3].name,iso(x,y,z+15),undefined,11);
 }
 // A broad living city fills the whole mobile viewport during zoom/pan.
 tile(-8,-8,27,27,winter?'#6b8383':'#6b8b69');
 for(let x=-7;x<18;x++)for(let y=-7;y<18;y++){
  const n=noise(x*71+y*9);
  if(n>.26)tile(x+.08,y+.08,.84,.84,winter?n>.76?'#a5b6b1':'#778c87':n>.6?'#6e916b':'#678364');
 }
 // Pavements, kerbs, carriageways and lane markings.
 for(const t of [-4,0,4,8,12,16]){
  tile(t-.68,-8,1.36,27,'#b7bdba');
  tile(-8,t-.68,27,1.36,'#b7bdba');
  tile(t-.52,-8,1.04,27,'#475663');
  tile(-8,t-.52,27,1.04,'#475663');
  line([iso(t,-8),iso(t,19)],'#dedfc670',2,[13,16]);
  line([iso(-8,t),iso(19,t)],'#dedfc670',2,[13,16]);
  line([iso(t-.53,-8),iso(t-.53,19)],'#909e9c',2);
  line([iso(-8,t-.53),iso(19,t-.53)],'#909e9c',2);
 }
 // Marked crosswalks at a few important intersections.
 for(const [x,y] of [[4,4],[8,4],[4,8],[8,8],[0,4],[12,8]]){
  for(let k=-2;k<=2;k++)tile(x-.5+k*.16,y-.39,.10,.72,'#e5e8e1a6');
 }
 // Courtyards, parking bays and fenced sports facilities.
 tile(4.85,5.2,2.2,1.7,'#b2a991','#637f77');
 tile(5.05,5.32,1.55,1.2,'#58795e');
 line([iso(5.2,5.5),iso(6.25,5.5)],'#c47b50',5);
 line([iso(5.55,5.42),iso(5.55,6.26)],'#2f8395',4);
 const slide=iso(5.9,5.9);line([[slide[0],slide[1]-17],[slide[0]+13,slide[1]-2]],'#ef6b56',7);
 tile(5.1,9.2,2.1,1.7,'#3b725f','#a2afb1');
 line([iso(5.1,9.2),iso(7.2,9.2),iso(7.2,10.9),iso(5.1,10.9),iso(5.1,9.2)],'#d5e3e7',3);
 line([iso(6.15,9.2),iso(6.15,10.9)],'#dfe3b5',2);
 for(let k=0;k<4;k++)car(1+k*.46,4.83,0,['#dde9ed','#adceda','#304454','#b8a5a0'][k]);
 for(let k=0;k<4;k++)car(8.75+k*.5,8.48,.8,['#cbd4da','#435c6a','#e2e1d4','#b45d53'][k]);
 // A consistent seeded scattering gives a stable world between game ticks.
 for(let k=0;k<91;k++){
  const x=-5+noise(k*5+11)*21,y=-5+noise(k*7+17)*21;
  if([0,4,8,12].some(n=>Math.abs(x-n)<.9||Math.abs(y-n)<.9))continue;
  if([...houses,...neighbors.map(n=>[n.x,n.y])].some(h=>Math.abs(x-h[0])<1.7&&Math.abs(y-h[1])<1.2))continue;
  if(x>4.5&&x<7.5&&y>5&&y<11)continue;
  tree(x,y,k);
 }
 for(let k=0;k<19;k++){
  const t=(k*3)%16;
  if(k%2===0)lamp(t+.72,k%4?4.83:8.83);
  else lamp(k%4?4.83:8.83,t+.72);
 }
 const buildings=[
  ...houses.map(([x,y],i)=>({x,y,i,managed:true})),
  ...neighbors.map((n,j)=>({x:n.x,y:n.y,i:j+3,managed:false}))
 ];
 buildings.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 buildings.forEach(b=>apartment(b.x,b.y,b.i,b.managed));
 // Dispatch routes use current job progress; never fabricate an assignment.
 for(const cr of state.crews){
  const travel=cr.status==='travel';
  if(travel){
   const c=state.calls.find(call=>call.id===cr.job);
   if(c){
    const points=route(cr.home,c.home).map(p=>iso(p[0],p[1],4));
    ctx.save();ctx.shadowColor=COLORS[cr.service];ctx.shadowBlur=17;
    line(points,COLORS[cr.service]+'9a',8);
    ctx.restore();line(points,'#122734d0',5);
    line(points,COLORS[cr.service],3,[9,7]);
   }
  }
  const pos=vehiclePosition(cr,state);
  car(pos[0]+cr.id*.17,pos[1]+.11,cr.id===1?.2:-.3,COLORS[cr.service],true);
  if(travel){
   const point=iso(pos[0]+cr.id*.17,pos[1]+.11,25);
   const label=['Сантехники','Электрики','Ремонтники'][cr.service]+' · '+cr.remaining+' мин';
   tag(label,point,'#0b2335ee',12);
  }
 }
 // Large neon incident markers remain touch targets.
 for(let i=0;i<houses.length;i++){
  const calls=state.calls.filter(c=>c.home===i&&c.status!=='done');
  if(!calls.length)continue;
  const c=calls.sort((a,b)=>b.priority-a.priority)[0];
  const type=TYPES[c.type][1],p=iso(houses[i][0],houses[i][1],142),color=COLORS[type];
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=24;
  dot(p[0],p[1],22,color);ctx.restore();
  dot(p[0],p[1],17,'#0b2737');
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p[0],p[1],19,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(['●','ϟ','⚒'][type],p[0],p[1]);
  view.hits.unshift({point:view.project(p),call:c.id});
 }
 ctx.restore();
}
