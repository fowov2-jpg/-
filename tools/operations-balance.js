import fs from 'node:fs/promises';
import * as E from '../web/campaign-engine.js';
const O=E.Operations;

function prepare(s){
 for(const v of s.vehicles)if((v.fuel<100||v.condition<100)&&!s.crews.some(cr=>cr.vehicle===v.id&&cr.status!=='idle'))E.maintain(s,v.id);
 for(let service=0;service<3;service++)while(s.stock[service]<40)E.procure(s,service);
 if(O.currentHouses(s).length<4&&s.operations.districtShifts>=1&&O.reputation(s)>=65)O.sign(s,O.candidates(s)[0].id,E.log);
}
function talk(s,c,strategy){
 if(c.dialogue==='start'){
  const first={flood:'network',lights:'scope',leak:'source',roof:'history',entrance:'bypass',outage:'residents',sewer:'scope',door:'history',pump:'scope'}[c.kind];
  E.answer(s,c.mission,first);
 }
 if(c.dialogue==='plan'){
  const last={flood:strategy==='branch'?'branch':'local',lights:'priority',leak:'close',roof:'cover',entrance:'barrier',outage:'own',sewer:'notice',door:'today',pump:'notice'}[c.kind];
  E.answer(s,c.mission,last);
 }
}
function simulate(strategy){
 const s=E.freshCompany(112),days=[];
 for(let n=0;n<160&&s.phase!=='won';n++){
  if(s.phase==='report'){
   if(O.canExpand(s)&&s.region<19)E.nextDistrict(s);else E.nextDay(s);
  }
  if(s.phase==='lost')throw Error(strategy+': company lost on day '+s.day);
  prepare(s);E.start(s);
  for(let minute=0;minute<480&&s.phase==='active';minute++){
   for(const c of [...s.calls]){
    talk(s,c,strategy);
    for(const cr of s.crews)if(!E.reason(s,c,cr))E.dispatch(s,c.mission,cr.id);
   }
   E.tick(s);
   if(minute%60===0)E.decode(E.encode(s));
  }
  E.decode(E.encode(s));
  days.push({day:s.day,region:s.region,completed:s.shift.completed,failed:s.report.results.filter(r=>!r.success).length,
    pending:s.calls.length,trust:O.reputation(s),damage:s.report.damage,compensation:s.report.compensation,balance:s.money});
 }
 if(s.phase!=='won')throw Error(strategy+': campaign did not finish: district '+s.region+', day '+s.day);
 return {strategy,days:days.length,completed:s.operations.completed,failed:s.operations.failed,
   balance:s.money,damage:days.reduce((n,d)=>n+d.damage,0),compensation:days.reduce((n,d)=>n+d.compensation,0),
   minimumTrust:Math.min(...days.map(d=>d.trust)),rows:days};
}
const results=['local','branch'].map(simulate);
const ignored=E.freshCompany(112);let unattendedDays=0;
while(ignored.phase!=='lost'&&unattendedDays<10){if(ignored.phase==='report')E.nextDay(ignored);E.start(ignored);E.tick(ignored,480);unattendedDays++;}
if(ignored.phase!=='lost')throw Error('Ignoring all calls never causes company loss');
const report={method:'Deterministic management bots; not a measurement of human difficulty, enjoyment or playtime.',results,unattended:{phase:ignored.phase,days:unattendedDays,trust:O.reputation(ignored)}};
await fs.mkdir('test-results/operations-balance',{recursive:true});
await fs.writeFile('test-results/operations-balance/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({strategies:results.map(({rows,...r})=>r),unattended:report.unattended},null,2));
