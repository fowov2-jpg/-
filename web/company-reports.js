// Financial figures come from engine transactions; never infer lifetime totals from a capped ledger.
export function transactions(state,day=null){return state.ledger.filter(entry=>day===null||entry.day===day);}
export function dailyTotals(state,day=state.day){
 const rows=transactions(state,day);
 const income=rows.reduce((sum,e)=>sum+Math.max(0,e.amount),0),costs=rows.reduce((sum,e)=>sum+Math.max(0,-e.amount),0);
 return {income,costs,net:income-costs,rows};
}
export function shiftSummary(state){
 if(state.shift?.day===state.day)return {...state.shift,pending:state.calls.length,closingMoney:state.money,net:state.money-state.shift.openingMoney};
 // Older saves contain no complete shift counters. Show recorded transactions, explicitly marked.
 const totals=dailyTotals(state);
 return {day:state.day,income:totals.income,costs:totals.costs,net:totals.net,completed:null,late:null,pending:state.calls.length,openingMoney:null,closingMoney:state.money,partial:true};
}
export function trainingCost(employee){return 12000*employee.level;}
