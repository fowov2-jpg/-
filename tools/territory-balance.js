import fs from 'node:fs/promises';
import * as E from '../web/campaign-engine.js';
import * as T from '../web/territory-progression.js';
import {SCENARIOS} from '../web/operations-content.js';
const O=E.Operations;
const choices={lights:['scope','priority'],leak:['source','close'],flood:['network','branch'],door:['access','today'],sewer:['scope','notice'],entrance:['bypass','barrier'],outage:['residents','own'],roof:['history','cover'],pump:['scope','notice'],heating:['scope','local'],gutters:['access','clear'],delivery:['scope','barrier'],cable:['risk','barrier']};
const report={story:'Three houses → districts → twenty areas; previous areas remain playable.',runs:[]};
for(const strategy of ['manual','delayed','assistant'])for(const seed of [0,7,112]){
 const s=E.freshTerritoryCompany(seed),days=[];
 for(let i=0;i<800&&T.unlocked(s)<19;i++){
  if(s.phase==='report')E.nextDay(s);
  for(const v of s.vehicles)if((v.fuel<100||v.condition<100)&&!s.crews.some(cr=>cr.vehicle===v.id&&cr.status!=='idle'))E.maintain(s,v.id);
  for(let service=0;service<3;service++)if(s.stock[service]<30)E.procure(s,service);
  if(T.expansion(s).district&&T.area(s).districts.length<3)O.openDistrict(s,T.nextDistrict(s).id,E.log);
  if(T.expansion(s).area)E.nextDistrict(s);
  if(strategy==='assistant'&&O.Career.assistantUnlocked(s))O.Career.setAssistant(s,true);
  E.start(s);
  for(let m=0;m<480&&s.phase==='active';m++){
   for(const c of [...s.calls]){
    if(strategy==='assistant'&&s.operations.career.assistant.enabled&&c.channel==='report')continue;
    if(strategy==='delayed'&&s.clock-c.created<12)continue;
    for(const choice of choices[c.kind])if(SCENARIOS[c.kind].dialogue[c.dialogue]?.options.some(v=>v.id===choice))E.answer(s,c.mission,choice);
    for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);
   }
   E.tick(s);
  }
  E.decode(E.encode(s));
  if(s.phase!=='report'||s.report.pending||s.report.results.some(r=>!r.success))throw Error(strategy+' seed '+seed+' failed duty '+s.day);
  if(s.operations.shift.peak>O.Career.shiftRules(s).concurrent)throw Error('Call concurrency exceeded');
  days.push({day:s.day,area:s.region,district:T.current(s),calls:s.report.results.length,planned:s.operations.shift.schedule.length,peak:s.operations.shift.peak,money:s.money,points:T.balance(s),desks:T.desks(s).length});
 }
 if(T.unlocked(s)!==19)throw Error('The last area is unreachable: '+strategy+' '+seed);
 const lastArea=s.region;O.switchArea(s,0);E.decode(E.encode(s));if(T.unlocked(s)!==19||T.area(s).districts.length!==3)throw Error('Returning to the first area lost its progress');
 O.switchArea(s,lastArea);E.decode(E.encode(s));
 report.runs.push({strategy,seed,duties:days.length,minimumMoney:Math.min(...days.map(d=>d.money)),endingMoney:s.money,completed:s.operations.completed,assistantCompleted:s.operations.career.assistant.completed,days});
 console.log('REGIONAL BALANCE '+strategy+' seed '+seed+': all 20 areas, '+days.length+' duties, '+s.money+' ₽');
}
await fs.mkdir('test-results/territory-balance',{recursive:true});await fs.writeFile('test-results/territory-balance/report.json',JSON.stringify(report,null,2));
