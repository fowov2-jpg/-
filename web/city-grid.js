// The editor supplied a seamless, unmirrored aerial tile. Keep geometry separate
// from gameplay: only 12 existing contracts are active in the 0.3.2 engine.
export const TILE_WIDTH=1536,TILE_HEIGHT=1024,GRID_SIDE=8,MAX_DISTRICT_HOMES=999;
export const GRID_MIN=-3,GRID_MAX=4,BUILDINGS_PER_TILE=16;
export const GRID_BOUNDS={minX:GRID_MIN*TILE_WIDTH,maxX:(GRID_MAX+1)*TILE_WIDTH,
 minY:GRID_MIN*TILE_HEIGHT,maxY:(GRID_MAX+1)*TILE_HEIGHT};
const anchors=[
 [185,190],[555,190],[185,355],[565,365],
 [955,190],[1330,190],[955,365],[1330,365],
 [185,620],[550,625],[180,800],[565,815],
 [955,620],[1330,620],[955,800],[1330,815]
];
export const seedHash=(seed,id)=>{
 let h=(seed^Math.imul(id+1,0x9e3779b1))>>>0;
 h=Math.imul(h^(h>>>16),0x85ebca6b);
 h=Math.imul(h^(h>>>13),0xc2b2ae35);
 return (h^(h>>>16))>>>0;
};
const order=[];
for(let radius=0;radius<=4;radius++){
 const ring=[];
 for(let row=GRID_MIN;row<=GRID_MAX;row++)for(let col=GRID_MIN;col<=GRID_MAX;col++)
  if(Math.max(Math.abs(col),Math.abs(row))===radius)ring.push({col,row});
 ring.sort((a,b)=>(Math.abs(a.col)+Math.abs(a.row))-(Math.abs(b.col)+Math.abs(b.row))||a.row-b.row||a.col-b.col);
 order.push(...ring);
}
export function districtHomes(district,count=MAX_DISTRICT_HOMES,seed=112){
 if(!Number.isSafeInteger(district)||district<0||district>2)throw Error('Неизвестный район');
 if(!Number.isSafeInteger(count)||count<0||count>MAX_DISTRICT_HOMES)throw Error('Число домов вне диапазона 0–999');
 if(!Number.isSafeInteger(seed))throw Error('Неверное зерно');
 return Array.from({length:count},(_,i)=>{
  const tile=order[Math.floor(i/BUILDINGS_PER_TILE)],anchor=anchors[i%BUILDINGS_PER_TILE],random=seedHash(seed+district*3337,i);
  return {id:'district-'+district+'-home-'+i,district,col:tile.col,row:tile.row,
   x:tile.col*TILE_WIDTH+anchor[0],y:district*TILE_HEIGHT+tile.row*TILE_HEIGHT+anchor[1],floors:4+random%8};
 });
}
export function visibleTiles(x,y,scale,width,height){
 if(!(Number.isFinite(scale)&&scale>0))throw Error('Неверный масштаб');
 const minCol=Math.max(GRID_MIN,Math.floor(-x/(TILE_WIDTH*scale)));
 const maxCol=Math.min(GRID_MAX,Math.floor((width-x)/(TILE_WIDTH*scale)));
 const minRow=Math.max(GRID_MIN,Math.floor(-y/(TILE_HEIGHT*scale)));
 const maxRow=Math.min(GRID_MAX,Math.floor((height-y)/(TILE_HEIGHT*scale)));
 const result=[];
 for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++)result.push({row:row+0,col:col+0});
 return result;
}