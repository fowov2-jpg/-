import {CITY_HOMES,DEPOT} from './content.js';
export const WORLD={width:1000,height:1650};
export const MARKERS=CITY_HOMES.map(h=>[h.x,h.y]);
export const LABELS=CITY_HOMES.map(h=>[h.name,h.x,h.y-65,h.id]);
export const ROAD_X=[150,500,850],ROAD_Y=[200,650,1100,1550];
const nodes=[],links=[],pointIndex=new Map();
const add=(x,y)=>{const key=x+','+y;if(!pointIndex.has(key)){pointIndex.set(key,nodes.length);nodes.push([x,y]);}return pointIndex.get(key);};
const stops=CITY_HOMES.map(h=>{const x=ROAD_X.reduce((a,b)=>Math.abs(h.x-a)<Math.abs(h.x-b)?a:b);return add(x,h.y);});
stops[DEPOT]=add(500,650);
for(const x of ROAD_X)for(const y of ROAD_Y)add(x,y);
for(const x of ROAD_X){const points=nodes.map((p,i)=>({p,i})).filter(v=>v.p[0]===x).sort((a,b)=>a.p[1]-b.p[1]);for(let i=1;i<points.length;i++)links.push([points[i-1].i,points[i].i]);}
for(const y of ROAD_Y){const points=nodes.map((p,i)=>({p,i})).filter(v=>v.p[1]===y).sort((a,b)=>a.p[0]-b.p[0]);for(let i=1;i<points.length;i++)links.push([points[i-1].i,points[i].i]);}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const roadSegments=links.map(([a,b])=>[nodes[a],nodes[b]]);
export function stopAt(home){const p=nodes[stops[home]];if(!p)throw Error('Неизвестная точка маршрута');return [...p];}
export function route(from,to){
 const start=stops[from],end=stops[to];if(start===undefined||end===undefined)throw Error('Неизвестная точка маршрута');
 const dist=nodes.map(()=>Infinity),prev=[],pending=new Set(nodes.map((_,i)=>i));dist[start]=0;
 while(pending.size){const u=[...pending].reduce((best,i)=>dist[i]<dist[best]?i:best);pending.delete(u);if(u===end)break;
  for(const [a,b] of links){const v=a===u?b:b===u?a:null;if(v===null||!pending.has(v))continue;const d=dist[u]+distance(nodes[u],nodes[v]);if(d<dist[v]){dist[v]=d;prev[v]=u;}}
 }
 const path=[end];while(path[0]!==start){if(prev[path[0]]===undefined)throw Error('Дорога недоступна');path.unshift(prev[path[0]]);}return path.map(i=>[...nodes[i]]);
}
export function travelTime(from,to,speed=1){const p=route(from,to);return Math.max(3,Math.ceil(p.slice(1).reduce((sum,b,i)=>sum+distance(p[i],b),0)/(95*speed)));}
export function onRoute(path,progress){const lengths=path.slice(1).map((b,i)=>distance(path[i],b));let left=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));for(let i=0;i<lengths.length;i++){if(left<=lengths[i]){const t=lengths[i]?left/lengths[i]:0;return {point:path[i].map((n,j)=>n+(path[i+1][j]-n)*t),angle:Math.atan2(path[i+1][1]-path[i][1],path[i+1][0]-path[i][0])};}left-=lengths[i];}return {point:path.at(-1),angle:0};}
