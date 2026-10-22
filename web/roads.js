import {CITY_HOMES,DEPOT} from './content.js';
// Street lanes on the seamless top-down tile. Native tile size is 1536×1024.
export const WORLD={width:1536,height:1024};
export const DISTRICT_HEIGHT=WORLD.height;
export const MARKERS=CITY_HOMES.map(h=>[h.x,h.y]);
export const LABELS=CITY_HOMES.map(h=>[h.name,h.x,h.y-58,h.id]);
const localNodes=[[38,48],[760,48],[1498,48],[38,505],[760,505],[1498,505],[38,968],[760,968],[1498,968],
 [38,206],[1498,206],[38,704],[1498,704]];
const localLinks=[[0,1],[1,2],[0,9],[9,3],[3,11],[11,6],[2,10],[10,5],[5,12],[12,8],
 [3,4],[4,5],[6,7],[7,8],[1,4],[4,7]];
const nodes=[],links=[],stops=[],transfers=new Set();
const edge=(a,b)=>a.join(',')+'|'+b.join(',');
for(let d=0;d<3;d++){
 const base=nodes.length,offset=d*DISTRICT_HEIGHT;
 nodes.push(...localNodes.map(([x,y])=>[x,y+offset]));
 links.push(...localLinks.map(([u,v])=>[base+u,base+v]));
 for(const [local,idx] of [[9,0],[10,1],[11,2],[12,3]])stops[d*4+idx]=base+local;
 if(d){const a=base-localNodes.length+7,b=base+1;links.push([a,b]);
  transfers.add(edge(nodes[a],nodes[b]));transfers.add(edge(nodes[b],nodes[a]));}
}
stops[DEPOT]=4;
const adjacency=nodes.map(()=>[]);
for(const [a,b] of links){const dist=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);adjacency[a].push([b,dist]);adjacency[b].push([a,dist]);}
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const isTransfer=(a,b)=>transfers.has(edge(a,b));
export const roadSegments=links.filter(([a,b])=>!isTransfer(nodes[a],nodes[b])).map(([a,b])=>[nodes[a],nodes[b]]);
export function stopAt(home){const node=nodes[stops[home]];if(!node)throw Error('Неизвестная точка маршрута');return [...node];}
export function route(from,to){
 // Normalize direction to make equal-length shortest-path alternatives symmetric.
 if(from>to)return route(to,from).reverse();
 const start=stops[from],end=stops[to];if(start===undefined||end===undefined)throw Error('Неизвестная точка маршрута');
 const dist=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1),used=new Uint8Array(nodes.length);dist[start]=0;
 for(let count=0;count<nodes.length;count++){
  let u=-1;for(let j=0;j<nodes.length;j++)if(!used[j]&&(u===-1||dist[j]<dist[u]))u=j;
  if(u<0||!Number.isFinite(dist[u]))break;used[u]=1;if(u===end)break;
  for(const [v,w] of adjacency[u]){const alternative=dist[u]+w;if(alternative<dist[v]){dist[v]=alternative;previous[v]=u;}}
 }
 const path=[];for(let cur=end;cur>=0;cur=previous[cur]){path.push([...nodes[cur]]);if(cur===start)break;}
 if(!path.length||!path.at(-1).every((n,i)=>n===nodes[start][i]))throw Error('Дорога недоступна');
 return path.reverse();
}
export function travelTime(from,to,speed=1){const p=route(from,to);return Math.max(3,Math.ceil(p.slice(1).reduce((sum,b,i)=>sum+distance(p[i],b),0)/(125*speed)));}
export function onRoute(path,progress){
 const lengths=path.slice(1).map((b,i)=>distance(path[i],b)),total=lengths.reduce((a,b)=>a+b,0);
 let left=total*Math.max(0,Math.min(1,progress));
 for(let i=0;i<lengths.length;i++){
  if(left<=lengths[i]){const t=lengths[i]?left/lengths[i]:0;return {point:path[i].map((n,j)=>n+(path[i+1][j]-n)*t),angle:Math.atan2(path[i+1][1]-path[i][1],path[i+1][0]-path[i][0]),...(isTransfer(path[i],path[i+1])?{transfer:true}:{})};}
  left-=lengths[i];
 }
 return {point:path.at(-1),angle:0};
}