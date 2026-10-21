// Asynchronously load Blender-rendered game assets. If the generated PNGs
// are absent or still downloading, the existing Canvas drawing is the fallback.
const files={
  house_01:'house_01.png',house_02:'house_02.png',house_03:'house_03.png',
  house_04:'house_04.png',van_water:'van_water.png',
  van_electric:'van_electric.png',van_repair:'van_repair.png'
};
const cache=Object.create(null);
const failed=new Set();

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
  const crop=key.startsWith('house_')?[107,35,298,444]:[140,142,254,219];
  ctx.drawImage(img,...crop,x,y,width,height);
  return true;
 }
 return false;
}
