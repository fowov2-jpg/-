// Detailed hand-authored 2.5D game scenery. No remote assets or runtime dependencies.
// Shapes use the same isometric projection as map.js.
const rand=n=>{const v=Math.sin(n*127.1+78.233)*43758.5453;return v-Math.floor(v)};
const rgb=(a,b,t)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);
 const ch=s=>[(s>>16)&255,(s>>8)&255,s&255];
 const p=ch(x),q=ch(y);return '#'+p.map((c,i)=>Math.round(c+(q[i]-c)*t).toString(16).padStart(2,'0')).join('');};
const poly=(ctx,p,fill,stroke,width=1)=>{
 ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
};
const seg=(ctx,p,stroke,width=1)=>{
 ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
 ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
};
const mix=(a,b,t)=>a+(b-a)*t;
const at=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const point=(p,dy)=>[p[0],p[1]+dy];
function oval(ctx,p,rx,ry,fill){
 ctx.beginPath();ctx.ellipse(p[0],p[1],rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
}
function windowPanel(ctx,p,side,lit,big=false){
 const sx=side===0?1:-1,ww=big?10:8,hh=12;
 const glass=lit?'#f9dba0':'#284956';
 const shape=[[p[0]-ww*.5,p[1]-hh],[p[0]+ww*.5,p[1]-hh+side*2],[p[0]+ww*.5,p[1]+side*2],[p[0]-ww*.5,p[1]]];
 poly(ctx,shape,'#4e6063','#3f4f51',1.8);
 const inside=shape.map(q=>at(q,p,.16));
 poly(ctx,inside,glass);
 poly(ctx,[inside[0],inside[1],at(inside[1],inside[2],.4),at(inside[0],inside[3],.4)],
   lit?'#fff2bc':'#3d6477');
 seg(ctx,[at(inside[0],inside[1],.5),at(inside[3],inside[2],.5)],lit?'#aa8556':'#76909b',.8);
 seg(ctx,[point(shape[3],1),point(shape[2],1)],'#e2d8bd',1.2);
 if(lit){ctx.save();ctx.globalAlpha=.12;poly(ctx,[
  point(shape[3],1),point(shape[2],1),point(shape[2],11),point(shape[3],11)
 ],'#f7b05c');ctx.restore();}
}
function balcony(ctx,p,side,seed){
 const d=side?[-5,2]:[0,5],r=side?[-6,0]:[7,4];
 const a=[p[0]-8,p[1]-3],b=[p[0]+7,p[1]+3],c=[b[0]+d[0],b[1]+d[1]],e=[a[0]+d[0],a[1]+d[1]];
 poly(ctx,[a,b,c,e],'#b7b6ad','#536068',1);
 seg(ctx,[point(e,-6),point(c,-6)],'#dbded5',2);
 for(let n=0;n<5;n++){
  const q=at(e,c,n/4);seg(ctx,[point(q,-6),q],'#e6e0cc',1.2);
 }
 poly(ctx,[point(e,-5),point(c,-5),point(c,-4),point(e,-4)],'#65777d');
 if(rand(seed)>.7)seg(ctx,[[p[0]-2,p[1]-14],[p[0]+4,p[1]-16]],'#c3a36b',2);
}
function roofVent(ctx,p,seed){
 const w=8+rand(seed)*7, h=7+rand(seed+11)*4;
 const x=p[0],y=p[1];
 poly(ctx,[[x-w,y-3],[x,y-8],[x+w,y-4],[x,y+1]],'#a7aeb0','#e2e5e1');
 poly(ctx,[[x-w,y-3],[x,y+1],[x,y+1+h],[x-w,y-3+h]],'#647780');
 poly(ctx,[[x,y+1],[x+w,y-4],[x+w,y-4+h],[x,y+1+h]],'#78888d');
 seg(ctx,[[x-w-2,y-4],[x,y-9],[x+w+1,y-5]],'#e2eeef',2);
}

export function drawApartment(ctx,iso,x,y,index,managed,winter=false){
 const width=2.45+(index%3===1?.2:0),depth=1.8;
 const z=managed?119:99+(index%2)*5;
 const base=[iso(x-width/2,y-depth/2),iso(x+width/2,y-depth/2),
  iso(x+width/2,y+depth/2),iso(x-width/2,y+depth/2)];
 const [a,b,c,d]=base, up=p=>point(p,-z);
 const [aa,bb,cc,dd]=base.map(up);
 const palette=[
  ['#d5aa92','#e7c3a6','#778a92'],['#c4a08c','#dec0a4','#6b797e'],
  ['#bbb7a6','#dbcfb6','#717b83'],['#b5a2a0','#d7b7ad','#717d87'],
  ['#c8ae90','#dac5a7','#758a8d'],['#b3afad','#d0c8bf','#778487'],
  ['#beac95','#dcc1a6','#768a93']
 ][index%7];
 const [left,right,roof]=palette;
 // 3D footprint and cast shadow reinforce depth.
 poly(ctx,base.map(p=>[p[0]+18,p[1]+15]),'#08192266');
 poly(ctx,[b,c,cc,bb],left,'#4b5c64',1.3);
 poly(ctx,[d,c,cc,dd],right,'#61747a',1.3);
 // Edge strips and horizontal masonry separators.
 for(let floor=1;floor<5;floor++){
  const dz=-z*floor/5;
  seg(ctx,[point(d,dz),point(c,dz)],'#f5e0c055',1.5);
  seg(ctx,[point(b,dz),point(c,dz)],'#754d3b50',1.4);
 }
 for(let n=1;n<8;n++){
  const p=at(d,c,n/8);seg(ctx,[point(p,-4),point(p,-z+5)],'#8b776b2c',1);
 }
 // Room windows with inset shadow, reflected sky and lit interiors.
 for(let floor=0;floor<5;floor++){
  const zf=12+(z-22)*floor/5;
  for(let col=1;col<=7;col++){
   const p=point(at(d,c,col/8),-zf);
   const lit=rand(101+index*91+floor*13+col*23)>.53;
   windowPanel(ctx,p,0,lit);
   if(col===2||col===5){
    if(floor===1||floor===3)balcony(ctx,point(p,3),0,101+index*7+floor+col);
   }
  }
  for(let col=1;col<=5;col++){
   const p=point(at(b,c,col/6),-zf);
   const lit=rand(911+index*61+floor*27+col*9)>.56;
   windowPanel(ctx,p,1,lit);
   if(col===3&&floor%2===0)balcony(ctx,point(p,3),1,16+floor+index);
  }
 }
 // Entrances, rooflets, steps and door lamps.
 const entrance=at(d,c,.52);
 poly(ctx,[[entrance[0]-8,entrance[1]-18],[entrance[0]+7,entrance[1]-10],
   [entrance[0]+7,entrance[1]-1],[entrance[0]-8,entrance[1]-9]],'#314650','#ded6ba',1.2);
 poly(ctx,[[entrance[0]-11,entrance[1]-20],[entrance[0]+9,entrance[1]-10],
   [entrance[0]+15,entrance[1]-14],[entrance[0]-5,entrance[1]-25]],'#6d7a7d','#eee9d8',1.2);
 for(let t=0;t<3;t++)seg(ctx,[[entrance[0]-14+t*2,entrance[1]+t*2],
  [entrance[0]+12+t*2,entrance[1]+13+t*2]],'#a9a9a5',2);
 ctx.save();ctx.shadowBlur=10;ctx.shadowColor='#ffdb94';oval(ctx,point(entrance,-19),2.8,3,'#ffda91');ctx.restore();
 // Rooftop has no featureless slab: textured panels, parapets, ducts and snow.
 const roofFill=ctx.createLinearGradient(aa[0],aa[1],cc[0],cc[1]);
 roofFill.addColorStop(0,winter?'#b5c5c8':rgb(roof,'#b4bec3',.4));
 roofFill.addColorStop(1,winter?'#7f949c':roof);
 poly(ctx,[aa,bb,cc,dd],roofFill,'#e0e4dc',2);
 seg(ctx,[aa,bb,cc,dd,aa],winter?'#eaf3f5':'#c5c9c6',3);
 for(let k=0;k<9;k++){
  const t=(k+1)/11;
  const p=at(at(aa,dd,t),at(bb,cc,t),.12);
  const q=at(at(aa,dd,t),at(bb,cc,t),.86);
  seg(ctx,[p,q],winter?'#d9e7e766':'#4f666855',1);
 }
 roofVent(ctx,iso(x-.52,y-.2,z),index*17+4);
 roofVent(ctx,iso(x+.4,y+.18,z),index*23+11);
 roofVent(ctx,iso(x+.1,y-.45,z),index*13+5);
 if(winter){
  for(let k=0;k<8;k++){
   const p=at(at(aa,dd,rand(k*7+index)),at(bb,cc,rand(k*7+index)),.3+.35*rand(k+index));
   oval(ctx,p,7+rand(k*41+index)*7,1.2,'#e8f1f2b0');
  }
 }
 // Brick facade wash, window line shadow and antenna details.
 const leftTop=at(bb,cc,.8);
 seg(ctx,[leftTop,point(leftTop,-10)],'#374e57',1.4);
 oval(ctx,point(leftTop,-10),1.7,1.2,'#a2b8bd');
 return {z,center:iso(x,y,z)};
}

export function drawTree(ctx,iso,x,y,index,winter=false){
 const p=iso(x,y),t=rand(index*17+5);
 const height=34+22*t,conifer=index%3===0;
 ctx.save();
 oval(ctx,[p[0]+10,p[1]+6],15+height*.2,7,'#09202970');
 seg(ctx,[p,point(p,-height*.65)],'#493e38',4.2);
 if(conifer){
  for(let i=0;i<4;i++){
   const dy=height*.3+i*height*.17,half=23-i*4;
   const top=point(p,-height-6+i*12);
   poly(ctx,[[p[0]-half,p[1]-dy+4],top,[p[0]+half,p[1]-dy+4]],
     ['#254a45','#285b4d','#387d65','#50856b'][i]);
   if(winter){
    seg(ctx,[[p[0]-half+3,p[1]-dy],[top[0],top[1]+2],
     [p[0]+half-5,p[1]-dy]],'#dbeaf0',2.7);
   }
  }
 }else{
  const color=['#7a9763','#b4a057','#dc944a','#5d8364','#d3a751'][index%5];
  for(let i=0;i<10;i++){
   const angle=i*2.399,r=4+Math.sqrt(i)*5,cx=p[0]+Math.cos(angle)*r,
    cy=p[1]-height+Math.sin(angle)*r*.58;
   const size=10+8*rand(index*23+i);
   oval(ctx,[cx+2,cy+4],size,size*.65,'#1a493a');
   oval(ctx,[cx,cy],size,size*.7,rgb(color,'#3b694e',rand(i+index)*.45));
   if(winter)oval(ctx,[cx-2,cy-size*.3],size*.72,size*.16,'#ecf5f6a8');
  }
 }
 ctx.restore();
}

export function drawVan(ctx,iso,x,y,angle,color,service=false,time=0){
 const p=iso(x,y,3);
 ctx.save();ctx.translate(p[0],p[1]-3+Math.sin(time*2.4+angle)*(service?1:.2));
 ctx.rotate(angle);
 oval(ctx,[6,11],27,9,'#091b2699');
 for(const n of [-16,15]){
  oval(ctx,[n,8],7,5,'#172933');
  oval(ctx,[n,8],3,2,'#e2e8dd');
 }
 const grad=ctx.createLinearGradient(-25,-15,25,14);
 grad.addColorStop(0,'#f8fbfc');grad.addColorStop(.52,service?'#e6f2ef':color);
 grad.addColorStop(1,service?color:'#6a868d');
 poly(ctx,[[-24,-11],[13,-11],[27,2],[22,12],[-25,10]],grad,'#244451',1.6);
 poly(ctx,[[-8,-17],[11,-17],[20,-9],[-9,-9]],'#edf4ef','#3f6472',1.2);
 poly(ctx,[[12,-15],[22,-7],[23,-1],[12,-5]],'#68b3c2');
 poly(ctx,[[-24,-12],[-13,-15],[-10,-10],[-24,-7]],'#f5fbfa');
 // Department stripe, door handle, emergency beacons and headlights.
 seg(ctx,[[-21,2],[21,5]],color,4);
 seg(ctx,[[-4,-8],[-4,7]],'#587582',1);
 seg(ctx,[[4,-1],[8,0]],'#3c5861',1.6);
 oval(ctx,[25,4],2,3,'#fff0bd');
 oval(ctx,[-25,2],2,2,'#ee4445');
 if(service){
  poly(ctx,[[-2,-21],[12,-21],[11,-17],[-3,-17]],'#eff7fb','#517186');
  poly(ctx,[[0,-22],[5,-22],[5,-20],[0,-20]],'#ff6570');
  poly(ctx,[[6,-22],[11,-22],[11,-20],[6,-20]],'#6bc7ff');
 }
 ctx.restore();
}

export function drawStreetFurniture(ctx,iso,x,y,index,winter=false){
 const p=iso(x,y),kind=index%4;
 if(kind===0){
  // Park bench with angled slats and legs.
  poly(ctx,[[p[0]-12,p[1]-10],[p[0]+8,p[1]+1],[p[0]+8,p[1]+6],[p[0]-12,p[1]-5]],'#956d51');
  for(let k=0;k<3;k++)seg(ctx,[[p[0]-12,p[1]-10+k*3],[p[0]+8,p[1]+1+k*3]],'#d8af7f',1.5);
  seg(ctx,[[p[0]-9,p[1]],[p[0]-9,p[1]+7]],'#364c53',2.5);
  seg(ctx,[[p[0]+5,p[1]+7],[p[0]+5,p[1]+13]],'#364c53',2.5);
 }else if(kind===1){
  // Wheelie bin and small utility enclosure.
  poly(ctx,[[p[0]-9,p[1]-10],[p[0]+2,p[1]-15],[p[0]+13,p[1]-10],[p[0]+2,p[1]-5]],'#3b6c63','#97b3ac',1);
  poly(ctx,[[p[0]-9,p[1]-10],[p[0]+2,p[1]-5],[p[0]+2,p[1]+5],[p[0]-9,p[1]]],'#335c58');
  poly(ctx,[[p[0]+2,p[1]-5],[p[0]+13,p[1]-10],[p[0]+13,p[1]],[p[0]+2,p[1]+5]],'#29524e');
 }else if(kind===2){
  // Yellow bollard and reflective cap.
  seg(ctx,[point(p,0),point(p,-14)],'#5b574a',4);
  seg(ctx,[point(p,-14),point(p,-18)],'#ffca68',5);
 }else{
  // Flower bed / low shrub.
  oval(ctx,[p[0]+5,p[1]+3],14,5,'#375043');
  for(let n=0;n<5;n++){
   const off=n*4-8;
   oval(ctx,[p[0]+off,p[1]-1-rand(n+index)*5],4.5,4,'#4e815b');
   if(!winter)oval(ctx,[p[0]+off,p[1]-4-rand(n+index)*5],1.6,1.6,'#e6ae6a');
  }
 }
}


// Gameworld art for parks: playground, swings, courts, fences and ground painting.
export function drawPlayground(ctx,iso,x=4.85,y=5.2,winter=false){
 const tile=(x,y,w,h,color,stroke)=>{
  poly(ctx,[iso(x,y),iso(x+w,y),iso(x+w,y+h),iso(x,y+h)],color,stroke);
 };
 const p=(u,v,z=0)=>iso(x+u,y+v,z);
 const stroke=(pts,color,width=2)=>seg(ctx,pts,color,width);
 tile(x,y,2.55,2.25,'#9e9a81','#cfcbac');
 tile(x+.11,y+.11,2.3,2.03,winter?'#bcaf97':'#caac89');
 tile(x+.31,y+.37,1.96,1.5,'#ba865b');
 tile(x+.53,y+.55,1.5,1.1,'#73a06e');
 // Fence traces the perimeter with 3D vertical poles.
 for(const [[ax,ay],[bx,by]] of [
  [[.08,.08],[2.46,.08]],[[2.46,.08],[2.46,2.16]],
  [[2.46,2.16],[.08,2.16]],[[.08,2.16],[.08,.08]]
 ]){
  stroke([p(ax,ay,0),p(bx,by,0)],'#314a4a',2);
  stroke([p(ax,ay,23),p(bx,by,23)],'#aebbb7',2.4);
  for(let t=0;t<=1;t+=.16){
   const xx=mix(ax,bx,t),yy=mix(ay,by,t);
   stroke([p(xx,yy,0),p(xx,yy,25)],'#e0dfc9',1.6);
  }
 }
 // Slide tower: platform legs, guardrails, red chute and roof.
 const base=p(1.19,1.12,0),platform=p(1.19,1.12,36);
 for(const [u,v] of [[1.01,.98],[1.35,.98],[1.01,1.25],[1.35,1.25]]){
  stroke([p(u,v,0),p(u,v,35)],'#316b68',3.6);
 }
 poly(ctx,[p(.92,.85,34),p(1.44,.85,34),p(1.44,1.39,34),p(.92,1.39,34)],'#edb76b','#f7e9af',1.2);
 poly(ctx,[p(.87,.84,57),p(1.47,.84,57),p(1.43,1.40,57),p(.91,1.4,57)],'#b74340','#fa996f');
 stroke([p(1.18,1.41,36),p(1.82,1.58,3)],'#ff614d',10);
 stroke([p(1.18,1.43,36),p(1.8,1.59,5)],'#efb26f',2);
 for(let j=0;j<4;j++)stroke([p(.84+j*.1,.98+j*.08,3+j*8),p(.84+j*.1,1.3+j*.08,3+j*8)],'#d9b779',2);
 // Swing set, actually suspended and triangulated in 3D.
 for(const t of [.20,.72]){
  stroke([p(.18,t,0),p(.45,t+.1,35)],'#ff7c4d',3.5);
  stroke([p(.70,t,0),p(.45,t+.1,35)],'#ff7c4d',3.5);
 }
 stroke([p(.45,.3,35),p(.45,.82,35)],'#ffc965',3);
 for(const t of [.4,.65]){
  stroke([p(.45,t,31),p(.45,t,8)],'#d9d9c6',1);
  stroke([p(.47,t,31),p(.47,t,8)],'#d9d9c6',1);
  stroke([p(.43,t,8),p(.55,t,8)],'#447e6e',4);
 }
 // Benches, sandbox and small leaf piles.
 poly(ctx,[p(1.7,.23),p(2.19,.23),p(2.19,.68),p(1.7,.68)],'#d5c28a','#876e4c',2.2);
 poly(ctx,[p(1.79,.3),p(2.10,.3),p(2.10,.58),p(1.79,.58)],'#eac589');
 for(let k=0;k<8;k++){
  const dx=rand(k*19+5)*2.25,dy=rand(k*21+7)*2.04;
  const q=p(dx,dy);oval(ctx,q,2.5,1.7,winter?'#d3e5e2':k%2?'#d6aa5a':'#768b50');
 }
}
export function drawSportCourt(ctx,iso,x=5.1,y=9.2,winter=false){
 const p=(u,v,z=0)=>iso(x+u,y+v,z);
 poly(ctx,[p(0,0),p(2.6,0),p(2.6,2.1),p(0,2.1)],'#405e58','#b3b3ac',2);
 poly(ctx,[p(.12,.12),p(2.48,.12),p(2.48,1.98),p(.12,1.98)],'#9b5855');
 poly(ctx,[p(.42,.36),p(2.20,.36),p(2.20,1.78),p(.42,1.78)],'#507f65','#ceddc4',1.5);
 seg(ctx,[p(1.30,.36),p(1.30,1.78)],'#f1f0db',1.5);
 for(const x0 of [.73,1.89]){
  ctx.beginPath();const q=p(x0,1.07);ctx.ellipse(q[0],q[1],11,6,0,0,Math.PI*2);
  ctx.strokeStyle='#f3f2df';ctx.lineWidth=1.4;ctx.stroke();
  seg(ctx,[p(x0,.93),p(x0,1.22)],'#e6e4cd',1.2);
 }
 // Transparent wire fence reads as a 3D structure.
 for(const [[ax,ay],[bx,by]] of [
  [[0,0],[2.6,0]],[[2.6,0],[2.6,2.1]],[[2.6,2.1],[0,2.1]],[[0,2.1],[0,0]]
 ]){
  seg(ctx,[p(ax,ay,32),p(bx,by,32)],'#d4dfdc',2.2);
  seg(ctx,[p(ax,ay,0),p(bx,by,0)],'#2e5257',2.1);
  for(let t=0;t<=1;t+=.125){
   const xx=mix(ax,bx,t),yy=mix(ay,by,t);
   seg(ctx,[p(xx,yy,0),p(xx,yy,33)],'#b5d0cc88',1);
  }
 }
 for(const u of [.14,2.46]){
  seg(ctx,[p(u,1.05,0),p(u,1.05,30)],'#4e5f68',2.3);
  const ring=p(u,1.05,25);
  poly(ctx,[[ring[0]-6,ring[1]-3],[ring[0]+5,ring[1]],[ring[0]+5,ring[1]+7],[ring[0]-6,ring[1]+4]],'#e7e9e3','#899ca2',1);
 }
}
