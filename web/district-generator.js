import {CITY_HOMES} from './content.js';

// Every district has a central 1000 x 1500 illustrated tile. Additional tiles
// expand in rings in four directions; artwork is reflected at shared edges.
export const SECTION_WIDTH = 1000;
export const SECTION_HEIGHT = 1500;
export const MAX_HOMES_PER_DISTRICT = 999;
export const HOMES_PER_SECTION = 4;
export const PREVIEW_LEVELS = [4,12,24,48,96,192,384,768,999];
export const DEFAULT_PREVIEW_HOMES = 24;

const integer = value => Number.isSafeInteger(value);
const hash = (seed,index) => {
 let x = (seed ^ Math.imul(index+1,0x9e3779b1)) >>> 0;
 x = Math.imul(x ^ (x>>>16),0x85ebca6b);
 x = Math.imul(x ^ (x>>>13),0xc2b2ae35);
 return (x ^ (x>>>16))>>>0;
};

// Stable, centered order: first left/right, then up/down, then surrounding cells.
// A larger preview NEVER moves the positions or IDs of already generated houses.
const sectionCoordinates = [[0,0]];
const requiredSections = Math.ceil(MAX_HOMES_PER_DISTRICT/HOMES_PER_SECTION);
for(let radius=1;sectionCoordinates.length<requiredSections;radius++){
 const ring=[];
 for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)
  if(Math.max(Math.abs(x),Math.abs(y))===radius)ring.push([x,y]);
 ring.sort((a,b)=>{
  const distance=a=>Math.abs(a[0])+Math.abs(a[1]);
  const priority=a=>a[1]===0?(a[0]<0?0:1):a[0]===0?(a[1]<0?2:3):4;
  return distance(a)-distance(b)||priority(a)-priority(b)||a[1]-b[1]||a[0]-b[0];
 });
 sectionCoordinates.push(...ring.slice(0,requiredSections-sectionCoordinates.length));
}

export function sectionForGroup(group) {
 if(!integer(group)||group<0||group>=requiredSections)throw Error('Неверная секция района');
 return [...sectionCoordinates[group]];
}
export function boundsForHomes(count=DEFAULT_PREVIEW_HOMES) {
 if(!integer(count)||count<4||count>MAX_HOMES_PER_DISTRICT)throw Error('Допустимо от 4 до 999 домов');
 let minTileX=0,maxTileX=0,minTileY=0,maxTileY=0;
 const sections=Math.ceil(count/HOMES_PER_SECTION);
 for(let group=1;group<sections;group++){
  const [x,y]=sectionCoordinates[group];
  minTileX=Math.min(minTileX,x);maxTileX=Math.max(maxTileX,x);
  minTileY=Math.min(minTileY,y);maxTileY=Math.max(maxTileY,y);
 }
 const minX=minTileX*SECTION_WIDTH,maxX=(maxTileX+1)*SECTION_WIDTH;
 const minY=minTileY*SECTION_HEIGHT,maxY=(maxTileY+1)*SECTION_HEIGHT;
 return {minTileX,maxTileX,minTileY,maxTileY,minX,maxX,minY,maxY,
  width:maxX-minX,height:maxY-minY,sections};
}
export function generateDistrictHomes(district,count=DEFAULT_PREVIEW_HOMES,seed=112) {
 if(!integer(district)||district<0||district>2)throw Error('Неизвестный район');
 boundsForHomes(count);
 if(!integer(seed))throw Error('Неверное зерно генерации');
 const original=CITY_HOMES.filter(h=>h.district===district);
 if(original.length!==HOMES_PER_SECTION)throw Error('Ожидалось четыре опорных дома');
 return Array.from({length:count},(_,slot)=>{
  const group=Math.floor(slot/HOMES_PER_SECTION),[column,row]=sectionCoordinates[group];
  const local=slot%HOMES_PER_SECTION;
  const order=group===0?local:(local+(hash(seed+district,group)%HOMES_PER_SECTION))%HOMES_PER_SECTION;
  const base=original[order],flipX=Math.abs(column)%2===1,flipY=Math.abs(row)%2===1;
  const localY=base.y-district*SECTION_HEIGHT;
  const x=column*SECTION_WIDTH+(flipX?SECTION_WIDTH-base.x:base.x);
  const y=district*SECTION_HEIGHT+row*SECTION_HEIGHT+(flipY?SECTION_HEIGHT-localY:localY);
  const variant=hash(seed+district*10007,slot);
  return {id:group===0?base.id:'planned-'+district+'-'+slot,slot,section:group,column,row,
   district,x,y,name:group===0?base.name:'Плановый дом №'+(slot+1),
   floors:group===0?base.floors:4+variant%8,planned:group!==0};
 });
}
