import {TW,TH,DW,DH,hash,districtOrigin} from './city-layout.js';
export const THEME_NAMES=['Пятиэтажки','Девятиэтажки','Башни','Смешанный квартал','Депо и мастерские','Промышленная зона','Зелёные дворы','Кирпичная застройка','Набережная','Излучина'];
export const RIVER_WIDTH=160;
export function riverColumns(seed){return [6+hash(seed,71)%2,20+hash(seed,93)%2];}
function side(seed,col,row){return hash(seed+col*431,Math.floor(row/3)+951)%2;}
function rawRiver(seed,col,row){
 if(!riverColumns(seed).includes(col)||row<0||row>=32)return null;
 const north=side(seed,col,row),south=side(seed,col,row+1),kind=north===south?8:9,flip=north===1;
 const n=kind===8?372:463,s=kind===8?469:1040;
 return {kind,flip,north:flip?TW-n:n,south:flip?TW-s:s};
}
export function riverTile(seed,col,row){
 const own=rawRiver(seed,col,row);if(!own)return null;
 const above=rawRiver(seed,col,row-1),below=rawRiver(seed,col,row+1);
 return {...own,north:above?(above.south+own.north)/2:own.north,south:below?(below.north+own.south)/2:own.south};
}
const profiles={
 8:[[0,372],[104,393],[164,391],[224,453],[294,468],[354,440],[494,417],[574,480],[674,528],[774,516],[834,478],[874,469]],
 9:[[0,463],[104,527],[164,591],[224,636],[294,864],[354,965],[494,1028],[574,1074],[674,1108],[774,1078],[834,1054],[874,1040]]
};
export function riverCenter(river,y){
 const points=profiles[river.kind],v=Math.max(0,Math.min(TH,y));let x=points.at(-1)[1];
 for(let i=1;i<points.length;i++)if(v<=points[i][0]){const [ay,ax]=points[i-1],[by,bx]=points[i],t=(v-ay)/(by-ay);x=ax+(bx-ax)*t;break;}
 if(river.flip)x=TW-x;
 // The joins occur beneath a widened, shared bridge deck; both sides use the same port.
 if(v<24){const actual=river.flip?TW-points[0][1]:points[0][1];x=river.north+(actual-river.north)*v/24;}
 if(v>TH-24){const actual=river.flip?TW-points.at(-1)[1]:points.at(-1)[1];x=actual+(river.south-actual)*(v-(TH-24))/24;}
 return x;
}
export function isWater(seed,x,y,padding=0){
 const col=Math.floor(x/TW),row=Math.floor(y/TH),river=riverTile(seed,col,row);return !!river&&Math.abs(x-col*TW-riverCenter(river,y-row*TH))<RIVER_WIDTH/2+padding;
}
export function zoneAt(seed,qx,qy){
 const x=(qx+.5)/80,y=(qy+.5)/64,noise=hash(seed,Math.floor(qx/5)+Math.floor(qy/5)*97),detail=hash(seed+732,qx+qy*83),nearWater=riverColumns(seed).some(c=>Math.abs(qx/2-c-.5)<1.3);
 let choices;
 if((x>.74&&y>.28)||(y>.82&&x>.25))choices=nearWater?[5,4,4,5,7]:[4,4,5,4,7];
 else if(Math.hypot((x-.47)*1.1,y-.44)<.22)choices=[2,2,3,1,3];
 else if(nearWater)choices=[6,7,0,3,6];
 else if(noise%4===0)choices=[7,7,0,1,7];
 else if(noise%4===1)choices=[1,1,3,7,1];
 else choices=[6,6,0,7,6];
 return choices[detail%choices.length];
}
export function tileDesign(seed,d,index){
 const origin=districtOrigin(d),col=origin[0]/TW+index%8,row=origin[1]/TH+Math.floor(index/8),river=riverTile(seed,col,row);
 if(river)return {kind:river.kind,quarters:[river.kind,river.kind,river.kind,river.kind],river,col,row};
 const quarters=Array.from({length:4},(_,q)=>zoneAt(seed,col*2+q%2,row*2+Math.floor(q/2)));
 return {kind:quarters[0],quarters,river:null,col,row};
}
export function bridgeSites(seed,origin){
 const bridges=[],startRow=Math.round(origin[1]/TH),startCol=Math.round(origin[0]/TW);
 for(const col of riverColumns(seed)){if(col<startCol||col>=startCol+8)continue;
  for(let row=startRow;row<startRow+8;row++){
   const river=riverTile(seed,col,row);
   for(const localY of [0,434,874])bridges.push({x:col*TW+riverCenter(river,localY),y:row*TH+localY,angle:0,length:320});
   if(river.kind===9){let previous=riverCenter(river,0)-708;for(let y=8;y<=TH;y+=8){const current=riverCenter(river,y)-708;if(previous*current<0){bridges.push({x:col*TW+708,y:row*TH+y-4,angle:Math.PI/2,length:125});break;}previous=current;}}
  }
 }
 return bridges;
}
