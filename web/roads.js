// Points are in the coordinates of the 1000 × 1500 neighborhood artwork.
export const WORLD={width:1000,height:1500};
export const MARKERS=[[235,310],[835,440],[835,1000]];
export const LABELS=[
 ['ул. Садовая, 12',225,235,0],['ул. Садовая, 10',555,135],
 ['ул. Лесная, 5',825,365,1],['ул. Садовая, 14',130,600],
 ['ул. Садовая, 16',430,750],['ул. Центральная, 3',190,980],
 ['ул. Молодёжная, 8',830,925,2],['ул. Молодёжная, 6',790,1335]
];
const nodes=[[265,375],[360,430],[510,505],[690,600],[805,670],[735,800],[665,935],[620,1000],[675,1070],[735,1120],[635,1270],[480,1405],[395,1500],[775,530],[770,1070],[675,1340]];
const links=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[3,13],[8,14],[10,15]];
const stops=[0,13,14,15];
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function route(from,to){
 const start=stops[from],end=stops[to];
 if(start===undefined||end===undefined)throw Error('Неизвестная точка маршрута');
 const dist=nodes.map(()=>Infinity),prev=[],pending=new Set(nodes.map((_,i)=>i));dist[start]=0;
 while(pending.size){
  const u=[...pending].reduce((best,i)=>dist[i]<dist[best]?i:best);pending.delete(u);if(u===end)break;
  for(const [a,b] of links){const v=a===u?b:b===u?a:null;if(v===null||!pending.has(v))continue;
   const d=dist[u]+distance(nodes[u],nodes[v]);if(d<dist[v]){dist[v]=d;prev[v]=u;}
  }
 }
 const path=[end];while(path[0]!==start)path.unshift(prev[path[0]]);
 return path.map(i=>[...nodes[i]]);
}
export function travelTime(from,to){const p=route(from,to);return Math.max(6,Math.ceil(p.slice(1).reduce((sum,b,i)=>sum+distance(p[i],b),0)/70));}
export function onRoute(path,progress){
 const lengths=path.slice(1).map((b,i)=>distance(path[i],b));let left=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));
 for(let i=0;i<lengths.length;i++){if(left<=lengths[i]){const t=lengths[i]?left/lengths[i]:0;return {point:path[i].map((n,j)=>n+(path[i+1][j]-n)*t),angle:Math.atan2(path[i+1][1]-path[i][1],path[i+1][0]-path[i][0])};}left-=lengths[i];}
 return {point:path.at(-1),angle:0};
}
