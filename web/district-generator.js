import {CITY_HOMES} from './content.js';

// The detailed WebP scene is a single 1000 x 1500 section. A mirrored section
// shares the same edge pixels with its neighbor, avoiding open background seams.
export const SECTION_WIDTH = 1000;
export const SECTION_HEIGHT = 1500;
export const MAX_HOMES_PER_DISTRICT = 999;
export const HOMES_PER_SECTION = 4;
export const PREVIEW_LEVELS = [4,12,24,48,96,192,384,768,999];
export const DEFAULT_PREVIEW_HOMES = 12;

const integer = value => Number.isInteger(value) && Number.isSafeInteger(value);
const hash = (seed,index) => {
 let x = (seed ^ Math.imul(index+1,0x9e3779b1)) >>> 0;
 x = Math.imul(x ^ (x>>>16),0x85ebca6b);
 x = Math.imul(x ^ (x>>>13),0xc2b2ae35);
 return (x ^ (x>>>16))>>>0;
};
export function sectionForGroup(group) {
 if(!integer(group)||group<0)throw Error('Неверная секция района');
 return group===0?0:group%2?-(group+1)/2:group/2;
}
export function boundsForHomes(count=DEFAULT_PREVIEW_HOMES) {
 if(!integer(count)||count<4||count>MAX_HOMES_PER_DISTRICT)throw Error('Допустимо от 4 до 999 домов');
 let minTile=0,maxTile=0;
 for(let g=1;g<Math.ceil(count/HOMES_PER_SECTION);g++){
  const tile=sectionForGroup(g);minTile=Math.min(minTile,tile);maxTile=Math.max(maxTile,tile);
 }
 return {minTile,maxTile,minX:minTile*SECTION_WIDTH,maxX:(maxTile+1)*SECTION_WIDTH,
  width:(maxTile-minTile+1)*SECTION_WIDTH,height:SECTION_HEIGHT};
}
export function generateDistrictHomes(district,count=DEFAULT_PREVIEW_HOMES,seed=112) {
 if(!integer(district)||district<0||district>2)throw Error('Неизвестный район');
 boundsForHomes(count);
 if(!integer(seed))throw Error('Неверное зерно генерации');
 const original=CITY_HOMES.filter(h=>h.district===district);
 if(original.length!==HOMES_PER_SECTION)throw Error('Ожидалось четыре опорных дома');
 return Array.from({length:count},(_,slot)=>{
  const group=Math.floor(slot/HOMES_PER_SECTION),tile=sectionForGroup(group);
  const local=slot%HOMES_PER_SECTION;
  // Full sections have four unique anchors; a partial final section is seeded.
  const order=group===0?local:(local+(hash(seed+district,group)%HOMES_PER_SECTION))%HOMES_PER_SECTION;
  const base=original[order],mirror=Math.abs(tile)%2===1;
  const x=tile*SECTION_WIDTH+(mirror?SECTION_WIDTH-base.x:base.x);
  const variant=hash(seed+district*10007,slot);
  return {id:group===0?base.id:'planned-'+district+'-'+slot,slot,section:tile,
   district,x,y:base.y,name:group===0?base.name:'Плановый дом №'+(slot+1),
   floors:group===0?base.floors:4+variant%8,planned:group!==0};
 });
}
