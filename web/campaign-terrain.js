import {SOURCE,TW,TH} from './city-layout.js';
export function drawTerrain(ctx,images,city,index,x,y,width,height){
 const layout=city.layouts[index];
 const draw=(kind,sx,sy,sw,sh,dx,dy,dw,dh)=>{const im=images[kind];if(!im?.complete||!im.naturalWidth){ctx.fillStyle='#49644b';ctx.fillRect(dx,dy,dw,dh);return;}ctx.drawImage(im,sx*im.naturalWidth/SOURCE.width,sy*im.naturalHeight/SOURCE.height,sw*im.naturalWidth/SOURCE.width,sh*im.naturalHeight/SOURCE.height,dx,dy,dw+.25,dh+.25);};
 if(layout.river){ctx.save();if(layout.river.flip){ctx.translate(x+width,y);ctx.scale(-1,1);draw(layout.kind,SOURCE.x,SOURCE.y,TW,TH,0,0,width,height);}else draw(layout.kind,SOURCE.x,SOURCE.y,TW,TH,x,y,width,height);ctx.restore();return;}
 for(let q=0;q<4;q++){const col=q%2,row=Math.floor(q/2),localY=row*434,h=row?440:434;draw(layout.quarters[q],SOURCE.x+col*708,SOURCE.y+localY,708,h,x+col*width/2,y+localY/TH*height,width/2,h/TH*height);}
}
export function terrainKey(city){return city.layouts.map(l=>l.river?`${l.kind}:${Number(l.river.flip)}`:l.quarters.join('.')).join('|');}
