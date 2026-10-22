export const STAFF=[
 [{name:'Алексей Волков',role:'Старший сантехник',initials:'АВ',years:12},{name:'Сергей Морозов',role:'Сантехник',initials:'СМ',years:6}],
 [{name:'Дмитрий Соколов',role:'Старший электрик',initials:'ДС',years:10},{name:'Андрей Козлов',role:'Электромонтёр',initials:'АК',years:5}],
 [{name:'Михаил Петров',role:'Мастер участка',initials:'МП',years:14},{name:'Иван Лебедев',role:'Мастер по ремонту',initials:'ИЛ',years:7}]
];
// The same generated model atlas is used by the garage and the moving map vehicles.
export function vehicle(service=0,model='van'){
 const row={van:0,express:1,truck:2}[model]??0;
 const name=['Сервисный фургон с лестницей','Компактный сервисный фургон','Бортовой автомобиль с инструментом и краном'][row];
 return `<div class="vehiclePhoto" role="img" aria-label="${name}" style="background-position:0% ${row*50}%"><span class="fleetService" style="--fleet-color:${['#f25b58','#f7c74d','#52b6fb'][service]}"></span></div>`;
}
