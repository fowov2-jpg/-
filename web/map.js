import * as T from './vendor/three/three.module.min.js';
import {CITY_HOMES,DEPOT,DISTRICTS} from './content.js';
import {COLORS,TYPES} from './engine.js';
import {WORLD,ROAD_X,ROAD_Y,route,onRoute,stopAt} from './roads.js';
export {route} from './roads.js';
const contexts=new WeakMap(),pos=(x,y,h=0)=>new T.Vector3((x-500)/4,h,(y-850)/4);
const deterministic=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const plain=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.92,...extra});
function mesh(geometry,material,parent,x,y,z){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,x,y,z,material){return mesh(new T.BoxGeometry(w,h,d),material,parent,x,y,z);}
function canvasTexture(width,height,paint){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;paint(canvas.getContext('2d'));const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;}
function facade(color,floors,columns,seed){return canvasTexture(1024,512,c=>{
 c.fillStyle=color;c.fillRect(0,0,1024,512);
 for(let j=0;j<5500;j++){const n=deterministic(seed+j);c.fillStyle=n>.6?'#ffffff13':'#0000000e';c.fillRect(deterministic(j+77)*1024,deterministic(j+32)*512,2,1);}
 const sx=1024/columns,sy=512/floors;
 for(let row=0;row<floors;row++)for(let col=0;col<columns;col++){
  const x=col*sx+sx*.2,y=row*sy+sy*.21,w=sx*.57,h=sy*.55,lit=deterministic(row*columns+col+seed)>.86;
  c.fillStyle='#3b3f3c';c.fillRect(x-4,y-4,w+8,h+10);c.fillStyle=lit?'#d6ba83':'#3e5b65';c.fillRect(x,y,w,h);c.fillStyle=lit?'#f5d18b':'#253f4c';c.fillRect(x+4,y+4,w*.4,h*.87);
  c.fillStyle='#d4d0bd';c.fillRect(x+w*.48,y,4,h);c.fillRect(x,y+h*.37,w,3);c.fillRect(x-5,y+h,w+10,7);
  if((col+row)%5===0){c.fillStyle='#abac9d';c.fillRect(x+5,y+h+13,w*.7,12);c.fillStyle='#6e817d';c.fillRect(x+8,y+h+15,w*.6,6);}
 }
 for(let row=1;row<floors;row++){c.fillStyle='#43483e20';c.fillRect(0,row*sy-1,1024,2);}
 });}
function buildApartment(scene,home,interactive,roofParts){
 const p=pos(home.x,home.y),w=38+(home.id%3)*2,d=14,level=home.floors*3.1,wallColors=['#d5c0a3','#ceb9a2','#c6c6b7','#c6b7a4'];
 const front=new T.MeshStandardMaterial({map:facade(wallColors[home.id%4],home.floors,10,home.id*51),roughness:1});
 const side=new T.MeshStandardMaterial({map:facade(wallColors[home.id%4],home.floors,3,home.id*71),roughness:1});
 const body=mesh(new T.BoxGeometry(w,level,d),[side,side,plain('#858c81'),plain('#777b71'),front,front],scene,p.x,level/2,p.z);body.userData.home=home.id;interactive.push(body);
 const roof=plain('#666e67'),pitch=2.6,half=d/2+.7,slant=Math.hypot(half,pitch);
 for(const sign of [-1,1]){const panel=mesh(new T.PlaneGeometry(w+1.5,slant),roof,scene,p.x,level+pitch/2+.2,p.z+sign*half/2);panel.rotation.x=-Math.PI/2+sign*Math.atan2(pitch,half);panel.material.side=T.DoubleSide;}
 box(scene,w+.9,.65,d+.6,p.x,level+.1,p.z,plain('#888d7d'));
 const gableShape=new T.Shape();gableShape.moveTo(-half,0);gableShape.lineTo(0,pitch);gableShape.lineTo(half,0);gableShape.closePath();
 for(const sign of [-1,1]){const gable=mesh(new T.ShapeGeometry(gableShape),plain('#c3bba7',{side:T.DoubleSide}),scene,p.x+sign*(w/2+.1),level+.2,p.z);gable.rotation.y=Math.PI/2;}

 for(let j=0;j<4;j++)roofParts.push({p:[p.x-w*.35+j*w*.23,level+1.6,p.z+(j%2?2:-2)],scale:[1.8,2,1.4]});
 const entrance=plain('#a29680'),door=plain('#354840');
 for(let j=-1;j<=1;j++){box(scene,3.1,3.4,.65,p.x+j*w*.28,1.7,p.z+d/2+.35,entrance);box(scene,1.4,2.5,.7,p.x+j*w*.28,1.25,p.z+d/2+.75,door);box(scene,3.8,.28,2.5,p.x+j*w*.28,3.3,p.z+d/2+1.2,plain('#7b8378'));}
 return {body,level,width:w,depth:d};
}
function instanced(scene,geometry,material,items,cast=true){const m=new T.InstancedMesh(geometry,material,items.length),dummy=new T.Object3D();for(let i=0;i<items.length;i++){const item=items[i];dummy.position.set(...item.p);dummy.scale.set(...(item.scale||[1,1,1]));dummy.rotation.set(0,item.angle||0,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(item.color)m.setColorAt(i,new T.Color(item.color));}m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m;}
function buildRoads(scene){
 const asphalt=plain('#777d77'),walk=plain('#b5b4a3'),mark=plain('#dfdfcb');
 for(const x of ROAD_X){const p=pos(x,875);box(scene,12,.1,350,p.x,.02,p.z,walk);box(scene,8.5,.12,350,p.x,.1,p.z,asphalt);}
 for(const y of ROAD_Y){const p=pos(500,y);box(scene,220,.1,12,p.x,.03,p.z,walk);box(scene,220,.12,8.5,p.x,.11,p.z,asphalt);}
 const stripes=[];
 for(const x of ROAD_X)for(let y=150;y<1600;y+=29)if(!ROAD_Y.some(ry=>Math.abs(y-ry)<38)){const p=pos(x,y);stripes.push({p:[p.x,.2,p.z],scale:[.12,.025,2.4]});}
 for(const y of ROAD_Y)for(let x=70;x<950;x+=29)if(!ROAD_X.some(rx=>Math.abs(x-rx)<38)){const p=pos(x,y);stripes.push({p:[p.x,.21,p.z],scale:[2.4,.025,.12]});}
 for(const x of ROAD_X)for(const y of ROAD_Y)for(let j=-3;j<=3;j++)for(const sign of [-1,1]){let p=pos(x+j*4,y+sign*31);stripes.push({p:[p.x,.22,p.z],scale:[.55,.025,2.2]});p=pos(x+sign*31,y+j*4);stripes.push({p:[p.x,.22,p.z],scale:[2.2,.025,.55]});}
 instanced(scene,new T.BoxGeometry(1,1,1),mark,stripes,false);
 for(const home of CITY_HOMES){const p=pos(home.x,home.y),stop=pos(...stopAt(home.id)),center=p.clone().add(stop).multiplyScalar(.5);box(scene,Math.abs(p.x-stop.x)+2,.07,2.5,center.x,.18,center.z,walk);}
}
function buildTrees(scene){
 const trunks=[],leaves=[],palette=['#718d37','#9b9d3b','#b3a53c','#bc8237','#447347','#54835b'];
 for(let j=0;j<650;j++){
  const x=55+deterministic(j+11)*890,y=95+deterministic(j+739)*1490;
  if(ROAD_X.some(v=>Math.abs(v-x)<35)||ROAD_Y.some(v=>Math.abs(v-y)<35)||CITY_HOMES.some(h=>Math.abs(h.x-x)<90&&Math.abs(h.y-y)<48)||Math.abs(x-330)<70&&Math.abs(y-410)<50||Math.abs(x-690)<70&&Math.abs(y-410)<55)continue;
  const p=pos(x,y),size=deterministic(j+92)*.7+.7;trunks.push({p:[p.x,2*size,p.z],scale:[size,size,size]});
  for(let k=0;k<3;k++)leaves.push({p:[p.x+(k-1)*1.1*size,4.1*size+k*.8,p.z+Math.sin(k*2)*size],scale:[size*(1.1-k*.1),size*(1.25-k*.1),size],color:palette[j%palette.length]});
 }
 instanced(scene,new T.CylinderGeometry(.22,.35,4,5),plain('#786246'),trunks);
 instanced(scene,new T.DodecahedronGeometry(2.25,1),plain('#ffffff'),leaves);
}
function buildCourtyards(scene){
 const path=plain('#bbac87'),red=plain('#b84c3d'),green=plain('#507d5b'),metal=plain('#7a8c83'),sand=plain('#c7b77b');
 for(let district=0;district<3;district++){
  const p=pos(330,410+district*450);box(scene,25,.18,18,p.x,.1,p.z,sand);
  for(let j=-1;j<=1;j++){box(scene,.18,4.4,.18,p.x+j*4,2.2,p.z,red);box(scene,3.4,.18,.18,p.x+j*4+1.7,4.4,p.z,red);box(scene,.12,3,.12,p.x+j*4+1.4,2.8,p.z,metal);box(scene,1.6,.15,.6,p.x+j*4+1.4,1.4,p.z,red);}
  const slide=box(scene,1.8,.15,6,p.x+7,1.8,p.z+3,plain('#e1a945'));slide.rotation.x=.5;
  box(scene,2.8,2.5,2.8,p.x+7,1.4,p.z,green);box(scene,3.4,.3,3.4,p.x+7,2.9,p.z,red);
  const q=pos(685,410+district*450);box(scene,29,.15,20,q.x,.12,q.z,green);box(scene,13,.04,19,q.x,.22,q.z,plain('#a55f4b'));
  const field=new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(q.x-13,.3,q.z-9),new T.Vector3(q.x+13,.3,q.z-9),new T.Vector3(q.x+13,.3,q.z+9),new T.Vector3(q.x-13,.3,q.z+9)]),new T.LineBasicMaterial({color:'#e0dcc5'}));scene.add(field);
  for(const sign of [-1,1]){box(scene,28,2,.06,q.x,1.1,q.z+sign*10,plain('#4c6c5a',{transparent:true,opacity:.5}));for(let j=-3;j<=3;j++)box(scene,.1,3.7,.1,q.x+j*4,1.9,q.z+sign*10,metal);}
  for(let j=0;j<4;j++){box(scene,3,.4,.8,p.x-10+j*6,.8,p.z+11,plain('#836943'));box(scene,2.8,.8,.2,p.x-10+j*6,1.25,p.z+11.5,plain('#836943'));}
 }
 const depot=pos(555,600);box(scene,23,5,11,depot.x,2.5,depot.z,plain('#9a9b83'));box(scene,25,.5,13,depot.x,5.3,depot.z,plain('#54685b'));for(let j=-1;j<=1;j++)box(scene,4,3.8,.15,depot.x+j*7,2,depot.z+5.6,plain('#324f4c'));
}
function makeVan(service,civil=false){
 const group=new T.Group(),color=plain(civil?['#bcbfb4','#7c9aa3','#985b4d','#d6d0bc'][service%4]:COLORS[service]),white=plain('#f0eee1'),glass=plain('#23454f',{metalness:.25,roughness:.3}),tire=plain('#27302f');
 box(group,1.8,1.5,civil?3.6:4.6,0,1,0,civil?color:white);box(group,1.75,.7,civil?2:2.8,0,1.8,civil?-.2:-.4,civil?color:white);box(group,1.82,.5,1.1,0,1.75,1.1,glass);
 if(!civil){box(group,1.83,.65,2.9,0,1.2,-.5,color);box(group,1.86,.08,1.4,0,2.3,-.7,white);}
 for(const x of [-.9,.9])for(const z of [-1.3,1.25]){const wheel=mesh(new T.CylinderGeometry(.4,.4,.22,10),tire,group,x,.48,z);wheel.rotation.z=Math.PI/2;}
 box(group,1.5,.15,.1,0,.95,civil?1.82:2.32,plain('#ffe9b3',{emissive:'#846c2d',emissiveIntensity:.3}));return group;
}
function markerTexture(service){return canvasTexture(96,96,c=>{const color=COLORS[service];const gradient=c.createRadialGradient(48,48,16,48,48,47);gradient.addColorStop(0,color);gradient.addColorStop(.55,color+'cc');gradient.addColorStop(1,color+'00');c.fillStyle=gradient;c.fillRect(0,0,96,96);c.fillStyle=color;c.beginPath();c.arc(48,48,25,0,7);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.fillStyle='#fff';c.strokeStyle='#fff';c.lineWidth=4;c.lineCap='round';c.beginPath();if(service===0){c.moveTo(48,30);c.bezierCurveTo(40,42,36,49,37,54);c.bezierCurveTo(39,69,62,67,60,52);c.bezierCurveTo(58,45,52,36,48,30);c.fill();}else if(service===1){c.moveTo(52,29);c.lineTo(34,52);c.lineTo(45,52);c.lineTo(42,68);c.lineTo(62,44);c.lineTo(51,44);c.closePath();c.fill();}else{c.moveTo(36,35);c.lineTo(61,61);c.moveTo(60,35);c.lineTo(35,62);c.moveTo(55,32);c.lineTo(64,41);c.stroke();}});}
function createContext(canvas){
 const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});if(!gl)return {fallback:true};
 const renderer=new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 const scene=new T.Scene();scene.background=new T.Color('#b2c3ac');scene.fog=new T.Fog('#b2c3ac',400,800);
 const camera=new T.OrthographicCamera(-100,100,100,-100,.1,1200),sun=new T.DirectionalLight('#fff1ce',3.2);sun.position.set(-100,180,70);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-230;sun.shadow.camera.right=230;sun.shadow.camera.top=230;sun.shadow.camera.bottom=-230;sun.shadow.camera.near=1;sun.shadow.camera.far=500;sun.shadow.bias=-.0005;sun.shadow.normalBias=.1;scene.add(sun,new T.HemisphereLight('#d9e8ea','#726d4c',2.2));
 const ground=box(scene,420,.2,600,0,-.18,0,plain('#80935b'));ground.castShadow=false;
 buildRoads(scene);buildCourtyards(scene);buildTrees(scene);const interactive=[],buildings=[],roofParts=[];for(const h of CITY_HOMES)buildings.push(buildApartment(scene,h,interactive,roofParts));instanced(scene,new T.BoxGeometry(1,1,1),plain('#8a8c7e'),roofParts);
 const parked=[];for(let j=0;j<80;j++){const x=ROAD_X[j%3]+(j%2?22:-22),y=230+Math.floor(j/3)*48;if(y>1510||ROAD_Y.some(v=>Math.abs(y-v)<40))continue;const p=pos(x,y);parked.push({p:[p.x,.65,p.z],scale:[1.7,1.1,3.7],color:['#d6d6c7','#9aacae','#547f88','#b06f58'][j%4]});}instanced(scene,new T.BoxGeometry(1,1,1),plain('#c6cbc0'),parked);
 const traffic=[];for(let j=0;j<8;j++){const car=makeVan(j,true);scene.add(car);traffic.push({car,path:route(j%12,(j*5+7)%12),offset:j*.13});}
 const pins=CITY_HOMES.map((home,id)=>{const sprite=new T.Sprite(new T.SpriteMaterial({map:markerTexture(0),depthTest:false,depthWrite:false,transparent:true}));sprite.scale.set(13,13,1);sprite.position.copy(pos(home.x,home.y,buildings[id].level+8));sprite.renderOrder=20;scene.add(sprite);return sprite;});
 const textures=[0,1,2].map(markerTexture),raycaster=new T.Raycaster(),cars=new Map();
 let labels=canvas.parentElement.querySelector('.mapLabels');if(!labels){labels=document.createElement('div');labels.className='mapLabels';canvas.after(labels);}
 const labelNodes=CITY_HOMES.map(home=>{const node=document.createElement('button');node.className='mapAddress';node.dataset.action='home';node.dataset.id=home.id;node.textContent=home.name;labels.appendChild(node);return node;});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();labels.dataset.error='true';});canvas.addEventListener('webglcontextrestored',()=>location.reload());
 return {renderer,scene,camera,buildings,pins,textures,raycaster,interactive,cars,traffic,labelNodes,labels,ground};
}
export function loadArtwork(onLoad){queueMicrotask(onLoad);}
export function renderMap(canvas,state,view,{labels=true,motion=true,progress=0,now=0}={}){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;let context=contexts.get(canvas);if(!context){context=createContext(canvas);contexts.set(canvas,context);}if(context.fallback){renderFallback(canvas,state,view,{labels,progress,rect});return;}
 const {renderer,scene,camera,buildings,pins,cars,labelNodes}=context;
 if(canvas.width!==Math.round(rect.width*renderer.getPixelRatio())||canvas.height!==Math.round(rect.height*renderer.getPixelRatio()))renderer.setSize(rect.width,rect.height,false);
 const center=view.focus||[500,view.district===null?850:440+view.district*450],target=pos(...center),span=(view.district===null?430:215)/view.zoom,aspect=rect.width/rect.height,bearing=view.bearing??.65,tilt=view.tilt??1;
 const panScale=span/rect.height;target.x+=(-view.x*Math.cos(bearing)-view.y*Math.sin(bearing))*panScale;target.z+=(view.x*Math.sin(bearing)-view.y*Math.cos(bearing))*panScale;
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(target.x+Math.sin(bearing)*300,target.y+(tilt===1?290:470),target.z+Math.cos(bearing)*300);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 view.project=([x,y],height=0)=>{const p=pos(x,y,height).project(camera);return [(p.x*.5+.5)*rect.width,(-p.y*.5+.5)*rect.height];};view.scale=rect.height/span/4;view.hits=[];view.mode='3d';canvas.dataset.renderer='3d';
 for(const home of state.homes){
  const active=state.calls.filter(c=>c.home===home.id&&c.status!=='done').sort((a,b)=>(a.status==='blocked')-(b.status==='blocked')||b.priority-a.priority),pin=pins[home.id],label=labelNodes[home.id];
  const p=view.project([home.x,home.y],buildings[home.id].level+4);label.hidden=!labels||p[0]<-60||p[0]>rect.width+60||p[1]<0||p[1]>rect.height;label.style.left=p[0]+'px';label.style.top=p[1]+'px';label.classList.toggle('owned',home.active);label.title=home.active?'Доверие '+home.loyalty+'%':'Доступен договор';
  pin.visible=active.length>0;if(pin.visible){const call=active[0];pin.material.map=context.textures[TYPES[call.type][1]];pin.position.y=buildings[home.id].level+12+(motion?Math.sin(now/600)*.35:0);pin.userData.call=call.id;const p=view.project([home.x,home.y],pin.position.y);view.hits.push({point:p,call:call.id,radius:28});}
 }
 const existing=new Set();
 for(const cr of state.crews){existing.add(cr.id);let car=cars.get(cr.id);if(!car){car=makeVan(cr.service);scene.add(car);cars.set(cr.id,car);}const call=state.calls.find(c=>c.id===cr.job),path=cr.status==='travel'?route(cr.home,call.home):route(cr.home,cr.home),location=onRoute(path,cr.status==='travel'?(cr.total-cr.remaining+progress)/cr.total:1),p=pos(...location.point);car.position.copy(p);if(cr.status==='idle'&&cr.home===DEPOT)car.position.x+=(cr.id%4-1.5)*2.5;car.rotation.y=Math.PI/2-location.angle;
 }
 for(const [id,car] of cars)if(!existing.has(id)){scene.remove(car);cars.delete(id);}
 for(const t of context.traffic){const location=onRoute(t.path,(t.offset+(motion?now/100000:0))%1);t.car.position.copy(pos(...location.point));t.car.rotation.y=Math.PI/2-location.angle;}
 const routeKey=state.crews.filter(c=>c.status==='travel').map(c=>c.id+':'+c.home+':'+c.job).join('|');if(context.routeKey!==routeKey){context.routeKey=routeKey;if(context.routes){scene.remove(context.routes);context.routes.children.forEach(line=>{line.geometry.dispose();line.material.dispose();});}context.routes=new T.Group();scene.add(context.routes);
 for(const cr of state.crews.filter(c=>c.status==='travel')){const call=state.calls.find(c=>c.id===cr.job),points=route(cr.home,call.home).map(p=>pos(...p,.38));if(points.length>1){const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:COLORS[cr.service],linewidth:3,depthTest:false}));line.renderOrder=5;context.routes.add(line);}}
 }
 view.pick=p=>{context.raycaster.setFromCamera(new T.Vector2(p[0]/rect.width*2-1,-p[1]/rect.height*2+1),camera);const hit=context.raycaster.intersectObjects(context.interactive)[0];return hit?{home:hit.object.userData.home}:null;};
 renderer.render(scene,camera);
}
function renderFallback(canvas,state,view,{labels,progress,rect}){
 const dpr=Math.min(globalThis.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#7d925c';c.fillRect(0,0,rect.width,rect.height);
 const focus=view.focus||[500,view.district===null?850:440+view.district*450],scale=(view.district===null?rect.height/1700:rect.height/750)*view.zoom;
 view.project=([x,y],z=0)=>[rect.width/2+(x-focus[0])*.7*scale+view.x,rect.height/2+(y-focus[1])*.7*scale-z*scale+view.y];view.hits=[];view.mode='2d';canvas.dataset.renderer='2d';
 c.strokeStyle='#d1ccad';c.lineWidth=26*scale;for(const x of ROAD_X){c.beginPath();c.moveTo(...view.project([x,80]));c.lineTo(...view.project([x,1640]));c.stroke();}for(const y of ROAD_Y){c.beginPath();c.moveTo(...view.project([30,y]));c.lineTo(...view.project([970,y]));c.stroke();}c.strokeStyle='#697772';c.lineWidth=18*scale;for(const x of ROAD_X){c.beginPath();c.moveTo(...view.project([x,80]));c.lineTo(...view.project([x,1640]));c.stroke();}for(const y of ROAD_Y){c.beginPath();c.moveTo(...view.project([30,y]));c.lineTo(...view.project([970,y]));c.stroke();}
 for(const home of state.homes){const p=view.project([home.x,home.y]),w=100*scale,h=42*scale;c.fillStyle='#344d3f77';c.fillRect(p[0]-w/2+7,p[1]-h/2+9,w,h);c.fillStyle=home.active?'#d4bca0':'#a7b4a3';c.fillRect(p[0]-w/2,p[1]-h/2,w,h);c.fillStyle='#6b7c72';c.fillRect(p[0]-w/2,p[1]-h/2,w,9*scale);if(labels){c.font='10px system-ui';c.fillStyle='#0c252add';c.fillRect(p[0]-55,p[1]-h/2-19,110,17);c.fillStyle='#fff';c.textAlign='center';c.fillText(home.name,p[0],p[1]-h/2-7);}view.hits.push({point:p,home:home.id,radius:35});const call=state.calls.find(call=>call.home===home.id&&call.status!=='done');if(call){const q=[p[0],p[1]-h/2-32];c.fillStyle=COLORS[TYPES[call.type][1]];c.beginPath();c.arc(...q,12,0,7);c.fill();view.hits.unshift({point:q,call:call.id,radius:25});}}
 for(const cr of state.crews){const call=state.calls.find(c=>c.id===cr.job),path=cr.status==='travel'?route(cr.home,call.home):route(cr.home,cr.home),p=view.project(onRoute(path,cr.status==='travel'?(cr.total-cr.remaining+progress)/cr.total:1).point);c.fillStyle=COLORS[cr.service];c.fillRect(p[0]-5,p[1]-3,10,6);}
}
