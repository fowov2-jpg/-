import {VEHICLE_MODELS} from './content.js';
import {district,roadStop,streetRoute,pathLength} from './campaign-city.js';
export const PART_PRICES=[1400,1100,1800];
export const supplyCost=(service,quantity=20)=>PART_PRICES[service]*quantity;
export function serviceCost(vehicle){if(vehicle.fuel===100&&vehicle.condition===100)return 0;return 750+Math.ceil((100-vehicle.fuel)*35+(100-vehicle.condition)*100);}
export function efficiency(model){
 if(!['crane','lift','tipper'].includes(model.kind))return 1;
 return model.price>=1000000?1.65:model.price>=700000?1.4:1.25;
}
export function rigTimings(model){return ['crane','lift','tipper'].includes(model.kind)?{setup:model.kind==='tipper'?2:4,stow:3}:{setup:0,stow:0};}
export function repairTime(s,mission,crew){
 const model=VEHICLE_MODELS.find(m=>m.id===s.vehicles.find(v=>v.id===crew.vehicle).model),average=crew.members.reduce((sum,id)=>sum+s.employees.find(p=>p.id===id).level,0)/crew.members.length;
 const rig=rigTimings(model);return Math.ceil(mission.duration/(efficiency(model)*(1+(average-1)*.08)))+rig.setup+rig.stow;
}
export function fuelFor(path){return Math.min(15,3+Math.ceil(pathLength(path)/2200));}
export function expenses(s){return 4500+s.region*1800+s.employees.reduce((sum,p)=>sum+1000+p.level*300,0)+s.vehicles.reduce((sum,v)=>sum+VEHICLE_MODELS.find(m=>m.id===v.model).upkeep,0);}
export function deadlineFor(s,m){
 const destination=roadStop(district(s.seed,s.region).homes[m.home]);let fastest=Infinity;
 for(const cr of s.crews){if(cr.service!==m.service)continue;const model=VEHICLE_MODELS.find(mod=>mod.id===s.vehicles.find(v=>v.id===cr.vehicle).model);if(model.capacity<m.quantity||model.supportedTypes&&!model.supportedTypes.includes(m.type))continue;
  const travel=Math.max(3,Math.ceil(pathLength(streetRoute(cr.point,destination))/(300*model.speed)));fastest=Math.min(fastest,travel+7+repairTime(s,m,cr));
 }
 // Give each already waiting same-service job enough time for a work cycle and return trip.
 // A newly issued call must not be overdue merely because the only compatible crew is busy.
 const waiting=s.calls.filter(c=>c.status==='new'&&c.spec?.service===m.service).length;
 return Math.max(m.deadline,Math.ceil((Number.isFinite(fastest)?fastest:70+m.duration)+25))+waiting*(m.duration+80);
}
export const cadence=s=>Math.max(12,38-s.crews.length*3);
export function payment(m,late){return Number.isInteger(m.fee)?m.materialsCost+Math.round(m.fee*(late?.65:1)):Math.round(m.reward*(late?.8:1));}
