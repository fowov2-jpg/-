export const SOURCE={width:1536,height:1024,x:60,y:76,widthCrop:1416,heightCrop:874};
export const ADDRESS_COUNT=999,DISTRICT_COUNT=20,TW=1416,TH=874,SIDE=8,DW=TW*SIDE,DH=TH*SIDE;
export const ROAD_X=[0,708,1416],ROAD_Y=[0,434,874];
export function hash(seed,index){let h=(seed^Math.imul(index+1,0x9e3779b1))>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;}
export function districtOrigin(d){const row=Math.floor(d/5),col=row%2?4-d%5:d%5;return [col*DW,row*DH];}
