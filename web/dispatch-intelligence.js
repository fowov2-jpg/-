// Read-only operational forecasts. Keep the dispatch UI in sync with the engine.
import {district,roadStop,streetRoute,pathLength} from './campaign-city.js';
import {VEHICLE_MODELS,reason,repairTime,task} from './campaign-engine.js';

export function crewForecast(state,call,crew){
 const mission=task(state,call);
 const vehicle=state.vehicles.find(v=>v.id===crew.vehicle);
 const model=VEHICLE_MODELS.find(m=>m.id===vehicle?.model);
 const blocked=reason(state,call,crew);
 if(!vehicle||!model)return {crewId:crew.id,eligible:false,reason:blocked||'Нет техники',eta:null,work:null,total:null,risk:'unavailable'};
 const destination=roadStop(district(state.seed,state.region).homes[mission.home]);
 const eta=Math.max(3,Math.ceil(pathLength(streetRoute(crew.point,destination))/(300*model.speed)));
 const diagnostic=call.asked?3:7;
 const work=Math.max(1,Math.ceil(repairTime(state,mission,crew)*(call.contained?.9:1)));
 const total=eta+diagnostic+work;
 const remain=Math.max(0,call.due-state.minute);
 const eligible=!blocked;
 return {crewId:crew.id,eligible,reason:blocked,eta,work,total,remain,
  risk:!eligible?'unavailable':total>remain?'late':total+10>remain?'tight':'safe',
  vehicleName:model.name};
}
export function rankedCrews(state,call){
 return state.crews.map(crew=>crewForecast(state,call,crew)).sort((a,b)=>
  Number(b.eligible)-Number(a.eligible)||Number(a.risk==='late')-Number(b.risk==='late')||
  (a.total??Infinity)-(b.total??Infinity)||a.crewId-b.crewId);
}
export function dispatchOverview(state){
 const calls=state.calls||[];
 return {
  newCalls:calls.filter(c=>c.status==='new').length,
  critical:calls.filter(c=>c.status==='new'&&(c.late||c.due-state.minute<=25)).length,
  enroute:calls.filter(c=>c.status==='travel').length,
  working:calls.filter(c=>c.status==='diagnosis'||c.status==='repair').length,
  available:state.crews.filter(c=>c.status==='idle').length,
  total:calls.length
 };
}
