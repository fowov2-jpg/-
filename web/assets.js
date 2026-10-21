// Asynchronously load Blender-rendered game assets. If the generated PNGs
// are absent or still downloading, the existing Canvas drawing is the fallback.
const files={
  house_01:'house_01.png',house_02:'house_02.png',house_03:'house_03.png',
  house_04:'house_04.png',van_water:'van_water.png',
  van_electric:'van_electric.png',van_repair:'van_repair.png',
  tree_green:'tree_green.png',tree_autumn:'tree_autumn.png',tree_pine:'tree_pine.png'
};
const cache=Object.create(null);
const failed=new Set();
const crops=Object.create(null);
function opaqueBounds(img){
 // Find real alpha edges of the 3D asset instead of hardcoding Blender framing.
 try{
  const surface=document.createElement('canvas');
  surface.width=img.naturalWidth;surface.height=img.naturalHeight;
  const g=surface.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,0,0);
  const pixels=g.getImageData(0,0,surface.width,surface.height).data;
  let l=surface.width,t=surface.height,r=0,b=0;
  for(let y=0;y<surface.height;y+=2){
   for(let x=0;x<surface.width;x+=2){
    if(pixels[(y*surface.width+x)*4+3]>30){
     l=Math.min(l,x);t=Math.min(t,y);
     r=Math.max(r,x);b=Math.max(b,y);
    }
   }
  }
  if(r<=l||b<=t)return [0,0,surface.width,surface.height];
  const pad=8;
  const x=Math.max(0,l-pad),y=Math.max(0,t-pad);
  return [x,y,Math.min(surface.width-x,r+pad-x+1),Math.min(surface.height-y,b+pad-y+1)];
 }catch{return [0,0,img.naturalWidth,img.naturalHeight];}
}


export function drawGameSprite(ctx,canvas,key,x,y,width,height){
 if(typeof Image==='undefined'||!files[key]||failed.has(key))return false;
 let img=cache[key];
 if(!img){
  img=new Image();
  cache[key]=img;
  img.onload=()=>{
   if(typeof canvas?.dispatchEvent==='function'&&typeof Event!=='undefined')
    canvas.dispatchEvent(new Event('spritesready'));
  };
  img.onerror=()=>{failed.add(key);};
  img.src='./assets/rendered/'+files[key];
 }
 if(img.complete&&img.naturalWidth>0){
  if(!crops[key])crops[key]=opaqueBounds(img);
  ctx.drawImage(img,...crops[key],x,y,width,height);
  return true;
 }
 return false;
}
