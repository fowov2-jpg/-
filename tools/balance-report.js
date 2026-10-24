import * as E from '../web/campaign-engine.js';
import {writeFile,mkdir} from 'node:fs/promises';
export function simulate(seed=112,teams=3,regions=20){
 const s=E.fresh(seed),report={seed,teams,regions:[],completed:0,late:0,minMoney:s.money,days:0},starting=s.money;
 if(teams>3)for(let service=0;service<3;service++)for(let i=1;i<teams/3;i++){
  const first=s.nextEmployee;E.hire(s,service);E.hire(s,service);const car=s.nextVehicle;E.buy(s,'van');E.form(s,[first,first+1],car);
 }
 let guard=0,regionOpening=s.money,regionDay=s.day;
 while(s.phase!=='won'&&s.region<regions&&guard++<3000000){
  report.minMoney=Math.min(report.minMoney,s.money);
  if(s.phase==='prep'){
   // All job families remain playable. Upgrade capacity only when entering a harder district.
   const maximum=Math.max(...E.catalog(s).map(m=>m.quantity));
   for(const cr of [...s.crews]){const v=s.vehicles.find(v=>v.id===cr.vehicle),model=E.VEHICLE_MODELS.find(m=>m.id===v.model);if(model.capacity<maximum&&cr.status==='idle'){const members=[...cr.members],id=s.nextVehicle;E.disband(s,cr.id);E.sell(s,v.id);E.buy(s,'gazon-next-flatbed');E.form(s,members,id);}}
   E.start(s);
  }
  if(s.phase==='active'){
   for(const c of [...s.calls].filter(c=>c.status==='new').sort((a,b)=>a.due-b.due)){
    const m=E.task(s,c),cr=s.crews.find(cr=>cr.status==='idle'&&cr.service===m.service&&!cr.members.some(id=>s.employees.find(p=>p.id===id).fatigue>90));if(!cr)continue;
    if(s.stock[m.service]<m.quantity)E.procure(s,m.service);
    let why=E.reason(s,c,cr);if(why==='Нужна заправка'||why==='Нужно обслуживание'){E.maintain(s,cr.vehicle);why=E.reason(s,c,cr);}
    if(!why){E.question(s,c.mission);E.dispatch(s,c.mission,cr.id);}
   }
   const finishing=s.calls.filter(c=>c.status==='repair'&&c.remaining===1),before=s.done.length;E.tick(s);
   report.completed+=s.done.length-before;report.late+=finishing.filter(c=>c.late).length;
  }
  if(s.phase==='report')E.nextDay(s);
  if(s.phase==='cleared'||s.phase==='won'){
   report.regions.push({region:s.region+1,days:s.day-regionDay+1,money:s.money,net:s.money-regionOpening,completed:s.done.length});
   if(s.region+1>=regions||s.phase==='won')break;E.nextDistrict(s);regionDay=s.day;regionOpening=s.money;
  }
 }
 if(guard>=3000000)throw Error('Campaign stalled');report.days=s.day;report.finalMoney=s.money;report.net=s.money-starting;report.lateRate=report.late/report.completed;
 E.decode(E.encode(s));return report;
}
if(process.argv[1]?.endsWith('balance-report.js')){
 await mkdir('test-results/balance',{recursive:true});
 for(const teams of [3,6]){const report=simulate(112,teams);await writeFile(`test-results/balance/${teams}-teams.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({teams,completed:report.completed,days:report.days,minMoney:report.minMoney,finalMoney:report.finalMoney,lateRate:report.lateRate}));}
}
