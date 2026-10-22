// Curated neighborhood plan shared by rendering, hit-tests, and dispatch routing.
// Coordinates are in an orthogonal street grid; do not place art by eye on Canvas.
export const ROAD_WIDTH=1.20;
export const ROADS=Object.freeze([
 {axis:'x',at:0,from:-3,to:19},
 {axis:'x',at:8,from:-3,to:19},
 {axis:'x',at:15,from:-3,to:19},
 {axis:'y',at:0,from:-3,to:19},
 {axis:'y',at:8,from:-3,to:19},
 {axis:'y',at:17,from:-3,to:19},
]);
// Each building footprint is 3.10 x 2.20 world units.
// Management identifiers MUST remain in engine order; map labels use state.homes.
export const BUILDINGS=Object.freeze([
 {id:0,managed:0,x:2.25,y:2.60,name:null},
 {id:1,managed:1,x:5.65,y:2.60,name:null},
 {id:2,managed:2,x:2.25,y:5.55,name:null},
 {id:3,x:5.65,y:5.55,name:'ул. Садовая, 10'},
 {id:4,x:10.90,y:2.65,name:'ул. Центральная, 3'},
 {id:5,x:10.90,y:5.55,name:'ул. Садовая, 16'},
 {id:6,x:2.25,y:13.30,name:'ул. Молодёжная, 6'},
 {id:7,x:5.65,y:13.30,name:'ул. Лесная, 7'}
]);
// Curbside stopping points, one per managed building and the shared service depot.
export const STOPS=Object.freeze([[2.25,0],[5.65,0],[0,5.55],[4.5,8]]);
// A real parked position per crew; these are slightly back from the live lane.
export const PARKING_BAYS=Object.freeze([[4.50,7.64],[6.05,7.64],[7.60,7.64]]);
// The walking leg begins where the van stops, ends at the building entrance.
export const ENTRANCES=Object.freeze([
 {home:0,door:[2.25,1.50],curb:STOPS[0]},
 {home:1,door:[5.65,1.50],curb:STOPS[1]},
 {home:2,door:[.70,5.55],curb:STOPS[2]}
]);
export const COURTYARDS=Object.freeze([
 {kind:'playground',x:3.3,y:9.3,w:2.55,h:2.25},
 {kind:'sports',x:9.0,y:9.2,w:2.60,h:2.10}
]);
export const TREES=Object.freeze([
 [1.25,4.20],[3.95,3.95],[7.10,4.65],[1.10,7.15],
 [6.90,6.80],[9.35,3.85],[12.80,4.30],[9.30,6.70],
 [1.15,9.55],[2.10,8.80],[6.65,9.10],[7.30,11.10],
 [9.00,12.35],[12.30,10.60],[11.65,12.80],[1.20,15.30],
 [4.2,15.1],[7.1,14.9],[12.5,6.9],[12.4,2.1]
]);
export const STREET_PROPS=Object.freeze([
 [2.05,8.85],[6.4,10.2],[9.0,8.9],[11.8,10.1],
 [1.0,6.8],[4.0,4.0],[7.3,4.65],[13,6.6]
]);
export function footprint(b){return {x0:b.x-1.55,x1:b.x+1.55,y0:b.y-1.10,y1:b.y+1.10};}
export function onRoad(p){
 return ROADS.some(r=>p[0]>=r.from-.01&&p[0]<=r.to+.01&&
  p[1]>=r.from-.01&&p[1]<=r.to+.01&&
  Math.abs((r.axis==='x'?p[0]:p[1])-r.at)<=ROAD_WIDTH/2);
}
export function buildingIntersectsRoad(b){
 const f=footprint(b);
 return ROADS.some(r=>r.axis==='x'?
  (f.x1>r.at-ROAD_WIDTH/2&&f.x0<r.at+ROAD_WIDTH/2&&
   f.y1>r.from&&f.y0<r.to):
  (f.y1>r.at-ROAD_WIDTH/2&&f.y0<r.at+ROAD_WIDTH/2&&
   f.x1>r.from&&f.x0<r.to));
}
// All streets are axis-aligned. Route changes direction only at public intersections.
export function route(from,to){
 const a=STOPS[from]||STOPS[3],b=STOPS[to]||STOPS[3];
 if(from===to){
  const mid=a[1]===0?[a[0]+.4,0]:a[0]===0?[0,a[1]+.4]:[a[0]+.4,8];
  return [a,mid,a];
 }
 if(from===3||to===3){
  if(to===3)return route(3,from).slice().reverse();
  const via=[a,[0,8]];
  if(b[0]===0)return [...via,b];
  return [...via,[0,0],b];
 }
 if(a[1]===0&&b[1]===0)return [a,b];
 if(a[0]===0&&b[0]===0)return [a,b];
 return [a,[0,0],b];
}
// The initial path comes out of the correct marked bay, then joins public streets.
export function crewRoute(crew,to){
 const from=Number.isInteger(crew.home)?crew.home:3;
 const ordinary=route(from,to);
 if(from!==3)return ordinary;
 const bay=PARKING_BAYS[crew.id]||PARKING_BAYS[0];
 const lane=[bay[0],8];
 const mid=ordinary[0];
 const path=[bay,lane];
 if(lane[0]!==mid[0]||lane[1]!==mid[1])path.push(mid);
 path.push(...ordinary.slice(1));
 return path;
}
