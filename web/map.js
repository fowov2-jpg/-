import {COLORS,TYPES} from './engine.js';
import {drawGameSprite} from './assets.js';
import {drawApartment,drawTree,drawVan,drawStreetFurniture,drawPlayground,drawSportCourt} from './scenery.js';

// Procedural isometric district. Every visible route and incident uses live game state.
const houses=[[2,2],[6,2],[2,6]];
const stops=[[2,4],[6,4],[2,8]];
const neighbors=[
 {x:10,y:2,name:'ул. Садовая, 10'},
 {x:2,y:10,name:'ул. Центральная, 3'},
 {x:6,y:10,name:'ул. Молодёжная, 6'},
 {x:10,y:6,name:'ул. Садовая, 16'},
 {x:10,y:10,name:'ул. Центральная, 5'},
 {x:-2,y:2,name:'ул. Садовая, 8'},
 {x:2,y:-2,name:'ул. Садовая, 6'},
 {x:14,y:6,name:'ул. Лесная, 7'}
];
const iso=(x,y,z=0)=>[500+(x-y)*49,100+(x+y)*27-z];
const mix=(a,b,t)=>a+(b-a)*t;
const noise=n=>((Math.sin(n*127.1+78.233)*43758.5453)%1+1)%1;

export function route(from,to){
 const a=stops[from]||[8,8],b=stops[to];
 // A nearby incident still requires a short drive from the depot around the block.
 if(from===to)return [a,[a[0]+1,a[1]],[a[0]+1,a[1]-1.2],[a[0],a[1]-1.2],a];
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

 function tree(x,y,i){drawTree(ctx,iso,x,y,i,winter);}
 function car(x,y,rotation,color,service=false,serviceIndex=0){
  const p=iso(x,y,0);
  const asset=['van_water','van_electric','van_repair'][serviceIndex]||'van_water';
  if(service&&drawGameSprite(ctx,canvas,asset,p[0]-50,p[1]-50,100,67))return;
  drawVan(ctx,iso,x,y,rotation,color,service,view.animation||0);
 }
 function apartment(x,y,i,managed=false){
  const height=managed?119:99+(i%2)*5;
  const p=iso(x,y,0);
  const rendered=drawGameSprite(ctx,canvas,'house_0'+((i%4)+1),
   p[0]-120,p[1]-180,240,196);
  if(!rendered)drawApartment(ctx,iso,x,y,i,managed,winter);
  if(managed){
   tag(state.homes[i].name,iso(x,y,height+20),undefined,11);
   view.hits.push({point:view.project(iso(x,y,height*.56)),home:i});
  }else if(i<7){
   tag(neighbors[i-3].name,iso(x,y,height+22),undefined,11);
  }
 }

 // Natural-looking continuous ground, replacing the previous chessboard terrain.
 tile(-8,-8,27,27,winter?'#647d77':'#698765');
 for(let k=0;k<420;k++){
  const gx=-7+noise(k*7+81)*25,gy=-7+noise(k*13+219)*25;
  const p=iso(gx,gy);
  const size=1.8+noise(k*21+6)*5.8;
  const shade=winter?['#9db0a4','#506b67','#839895','#b9c6bd']:
   ['#52795b','#879e6d','#a79868','#3f755c'];
  ctx.save();ctx.globalAlpha=.12+.15*noise(k*9+28);
  ctx.fillStyle=shade[k%shade.length];ctx.beginPath();
  ctx.ellipse(p[0],p[1],size*2,size*.9,.3,0,Math.PI*2);ctx.fill();
  ctx.restore();
 }
 // Soft landscaped slopes, meandering footpaths, and snow banks.
 for(const [xx,yy,ww,hh] of [
  [1.3,4.9,2.4,2.2],[4.6,5.0,3.1,2.4],[8.7,5.3,2.4,2.1],
  [1.3,8.8,2.2,2.4],[4.8,9.0,2.7,2.3],[8.7,9.0,2.4,2.2]
 ]){
  tile(xx,yy,ww,hh,winter?'#708983':'#6a8f6c');
 }
 // Road and pavement shades are separated to read like actual streets.
 for(const t of [0,4,8,12]){
  tile(t-.78,-8,1.56,27,winter?'#b2bab5':'#a9b5a8');
  tile(-8,t-.78,27,1.56,winter?'#b2bab5':'#a9b5a8');
  tile(t-.59,-8,1.18,27,'#394b57');
  tile(-8,t-.59,27,1.18,'#394b57');
  // Asphalt edge wear, curbs and broken lane markings.
  line([iso(t-.59,-8),iso(t-.59,19)],'#758b8f',2.4);
  line([iso(-8,t-.59),iso(19,t-.59)],'#758b8f',2.4);
  line([iso(t+.59,-8),iso(t+.59,19)],'#233c48',1.5);
  line([iso(-8,t+.59),iso(19,t+.59)],'#233c48',1.5);
  line([iso(t,-8),iso(t,19)],'#e4e0c688',2,[11,17]);
  line([iso(-8,t),iso(19,t)],'#e4e0c688',2,[11,17]);
 }
 // A few irregular garden paths: local courtyards no longer look like grid squares.
 for(const [from,to] of [
  [[1,4.94],[3.4,5.65]],[[5.1,4.97],[6.7,6.62]],
  [[9.2,5.09],[10.8,6.23]],[[1.4,8.86],[3.6,10.1]],
  [[5.1,8.94],[6.7,10.12]],[[9.3,9.1],[10.9,10.3]]
 ]){
  line([iso(...from),iso(...to)],'#aab2a188',7);
  line([iso(...from),iso(...to)],'#d7ceac55',3);
 }
 // Marked crosswalks at a few important intersections.
 for(const [x,y] of [[4,4],[8,4],[4,8],[8,8],[0,4],[12,8]]){
  for(let k=-2;k<=2;k++)tile(x-.5+k*.16,y-.39,.10,.72,'#e5e8e1a6');
 }
 // Small resident parking courts are tucked behind the apartment blocks.
 for(const [px,py] of [[1.15,4.9],[8.72,4.9],[1.15,8.9],[8.7,8.85]]){
  tile(px,py,2.05,.88,'#88948d','#bec2b6');
  for(let slot=0;slot<4;slot++){
   const a=px+.17+slot*.45,b=py+.18;
   line([iso(a,b),iso(a,b+.57)],'#eff1dfa2',1.5);
  }
 }
 // Layered courtyard art replaces the previous abstract line markings.
 drawPlayground(ctx,iso,4.85,5.2,winter);
 drawSportCourt(ctx,iso,5.1,9.2,winter);
 for(let k=0;k<4;k++)car(1+k*.46,4.83,0,['#dde9ed','#adceda','#304454','#b8a5a0'][k]);
 for(let k=0;k<4;k++)car(8.75+k*.5,8.48,.8,['#cbd4da','#435c6a','#e2e1d4','#b45d53'][k]);
 // A consistent seeded scattering gives a stable world between game ticks.
 for(let k=0;k<155;k++){
  const x=-5+noise(k*17+11)*21,y=-5+noise(k*43+17)*21;
  if([0,4,8,12].some(n=>Math.abs(x-n)<.9||Math.abs(y-n)<.9))continue;
  if([...houses,...neighbors.map(n=>[n.x,n.y])].some(h=>Math.abs(x-h[0])<1.7&&Math.abs(y-h[1])<1.2))continue;
  if(x>4.5&&x<7.5&&y>5&&y<11)continue;
  tree(x,y,k);
 }

 // Clusters of substantial trees frame the roads and deepen the courtyards.
 const streetTrees=[
  [1.1,5.0],[1.5,5.4],[3.1,5.15],[3.5,5.55],[5.1,5.02],[7.1,5.05],
  [8.7,5.0],[9.0,6.3],[10.8,5.3],[1.0,9.0],[1.3,10.5],[3.3,9.3],
  [4.9,9.0],[6.9,10.8],[8.8,9.2],[9.0,10.8],[11.0,9.5],
  [1.2,1.0],[3.25,1.1],[5.5,1.0],[7.3,2.2],[9.1,1.1],[11.1,2.0]
 ];
 streetTrees.forEach(([x,y],i)=>{
  if([...houses,...neighbors.map(n=>[n.x,n.y])].some(h=>Math.abs(x-h[0])<1.6&&Math.abs(y-h[1])<1.25))return;
  tree(x,y,220+i);
 });
 for(let k=0;k<19;k++){
  const t=(k*3)%16;
  if(k%2===0)lamp(t+.72,k%4?4.83:8.83);
  else lamp(k%4?4.83:8.83,t+.72);
 }

 // Park benches, bollards, enclosures and planter boxes add a street-level scale.
 for(let k=0;k<37;k++){
  const fx=1.3+noise(k*19+3)*11.4,fy=1.3+noise(k*29+9)*11.4;
  if([0,4,8,12].some(n=>Math.abs(fx-n)<.85||Math.abs(fy-n)<.85))continue;
  if([...houses,...neighbors.map(n=>[n.x,n.y])].some(h=>Math.abs(fx-h[0])<1.65&&Math.abs(fy-h[1])<1.35))continue;
  drawStreetFurniture(ctx,iso,fx,fy,k,winter);
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
    ctx.lineDashOffset=-(view.animation||0)*15;
    line(points,COLORS[cr.service],3,[9,7]);
    ctx.lineDashOffset=0;
   }
  }
  const pos=vehiclePosition(cr,state);
  car(pos[0]+cr.id*.17,pos[1]+.11,cr.id===1?.2:-.3,COLORS[cr.service],true,cr.service);
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
  const pulse=(view.animation||0),glow=1+Math.sin(pulse*2.8+i*1.5)*.13;
  ctx.save();ctx.shadowColor=color;ctx.shadowBlur=22+7*glow;
  dot(p[0],p[1],22*glow,color);ctx.restore();
  dot(p[0],p[1],17,'#0b2737');
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p[0],p[1],19,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(['●','ϟ','⚒'][type],p[0],p[1]);
  view.hits.unshift({point:view.project(p),call:c.id});
 }
 // Low-opacity weather particles, purely visual: never alter simulation state.
 if(winter){
  const animation=view.animation||0;
  ctx.save();
  for(let k=0;k<42;k++){
   const px=(noise(k*17+3)*1120+animation*(4+k%3))%1120;
   const py=(noise(k*21+9)*1020+animation*(8+k%5))%1020;
   ctx.globalAlpha=.16+.22*noise(k+13);
   dot(px,py,k%4===0?2:1,'#ecf7ff');
  }
  ctx.restore();
 }
 ctx.restore();
}
