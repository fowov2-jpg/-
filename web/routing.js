// Pure, offline road-graph routing shared by the simulation, UI and map renderer.
// Coordinates match the isometric map in map.js; all edges lie on drawn roads.
export const ROAD_STOPS = Object.freeze([[2,4],[6,4],[2,8]].map(p => Object.freeze(p)));
const JUNCTIONS = [[0,0],[4,0],[8,0],[0,4],[4,4],[8,4],[0,8],[4,8],[8,8]];
const NODES = [...JUNCTIONS, ...ROAD_STOPS].map(p => [...p]);
const key = p => p.join(',');
const point = index => ROAD_STOPS[index];
const same = (a,b) => a[0] === b[0] && a[1] === b[1];

export function weatherForDay(day) {
  if (!Number.isInteger(day) || day < 1) throw Error('Неверный игровой день');
  const season = Math.floor((day - 1) / 7) % 4;
  const pattern = (day - 1) % 7;
  const options = [
    [{label:'−2° · Снег',kind:'snow',slowdown:1.2},
     {label:'−7° · Мороз',kind:'frost',slowdown:1.12},
     {label:'−1° · Снег',kind:'snow',slowdown:1.25}],
    [{label:'+8° · Дождь',kind:'rain',slowdown:1.12},
     {label:'+12° · Облачно',kind:'cloudy',slowdown:1.0},
     {label:'+6° · Ливень',kind:'rain',slowdown:1.24}],
    [{label:'+23° · Ясно',kind:'clear',slowdown:1.0},
     {label:'+19° · Облачно',kind:'cloudy',slowdown:1.0},
     {label:'+25° · Ясно',kind:'clear',slowdown:1.0}],
    [{label:'+5° · Дождь',kind:'rain',slowdown:1.12},
     {label:'+2° · Туман',kind:'fog',slowdown:1.18},
     {label:'+7° · Облачно',kind:'cloudy',slowdown:1.0}]
  ];
  return {...options[season][pattern % 3], season};
}
export function isRushHour(minute) {
  return Number.isFinite(minute) && (minute < 90 || minute >= 420);
}
function segmentCost(a,b,day,minute) {
  const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  // Morning/evening central corridors are more congested than outer roads.
  const central = (a[0] === 4 && b[0] === 4) || (a[1] === 4 && b[1] === 4);
  const traffic = isRushHour(minute) && central ? 1.45 : 1;
  return distance * weatherForDay(day).slowdown * traffic;
}
function edgeKey(a,b) {return [key(a),key(b)].sort().join('|');}
function neighbors(index,blocked) {
  const a = NODES[index], out = [];
  for(let i=0;i<NODES.length;i++) {
    if(i===index)continue;
    const b=NODES[i];
    if(a[0]!==b[0] && a[1]!==b[1])continue;
    if(NODES.some((p,k)=>k!==index&&k!==i &&
      (a[0]===b[0] ? p[0]===a[0]&&p[1]>Math.min(a[1],b[1])&&p[1]<Math.max(a[1],b[1]) :
        p[1]===a[1]&&p[0]>Math.min(a[0],b[0])&&p[0]<Math.max(a[0],b[0]))))continue;
    if(!blocked.has(edgeKey(a,b)))out.push(i);
  }
  return out;
}
// blockedEdges accepts normalized "x,y|x,y" keys (e.g. "2,4|4,4").
export function routePlan(from,to,{day=1,minute=0,blockedEdges=[]}={}) {
  if(!point(from)||!point(to))throw Error('Неизвестная остановка');
  if(!Array.isArray(blockedEdges))throw Error('Неверный список перекрытий');
  const blocked=new Set(blockedEdges);
  const start=NODES.findIndex(n=>same(n,point(from)));
  const target=NODES.findIndex(n=>same(n,point(to)));
  const dist=Array(NODES.length).fill(Infinity),previous=Array(NODES.length).fill(-1);
  const seen=new Set();dist[start]=0;
  while(seen.size<NODES.length){
    let at=-1;
    for(let i=0;i<NODES.length;i++)if(!seen.has(i)&&(at<0||dist[i]<dist[at]))at=i;
    if(at<0||!Number.isFinite(dist[at])||at===target)break;
    seen.add(at);
    for(const next of neighbors(at,blocked)){
      const value=dist[at]+segmentCost(NODES[at],NODES[next],day,minute);
      if(value<dist[next]-1e-9){dist[next]=value;previous[next]=at;}
    }
  }
  if(!Number.isFinite(dist[target]))throw Error('Маршрут перекрыт');
  const nodes=[];for(let i=target;i>=0;i=previous[i]){nodes.unshift([...NODES[i]]);if(i===start)break;}
  const length=nodes.slice(1).reduce((sum,p,i)=>sum+Math.abs(p[0]-nodes[i][0])+Math.abs(p[1]-nodes[i][1]),0);
  return {points:nodes, distance:length, weightedDistance:dist[target],
    minutes:10+Math.ceil(dist[target]*1.25), weather:weatherForDay(day).kind,
    rush:isRushHour(minute)};
}
