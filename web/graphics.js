import {VEHICLE_MODELS} from './content.js';
import {FLEET_IMAGE,FLEET_SIZE,FLEET_ART} from './fleet-art.js';
export const STAFF=[
 [{name:'Алексей Волков',role:'Старший сантехник',initials:'АВ',years:12},{name:'Сергей Морозов',role:'Сантехник',initials:'СМ',years:6}],
 [{name:'Дмитрий Соколов',role:'Старший электрик',initials:'ДС',years:10},{name:'Андрей Козлов',role:'Электромонтёр',initials:'АК',years:5}],
 [{name:'Михаил Петров',role:'Мастер участка',initials:'МП',years:14},{name:'Иван Лебедев',role:'Мастер по ремонту',initials:'ИЛ',years:7}]
];
// Reference vehicles share measured atlas crops with the map; legacy garage art stays intact.
export function vehicle(service=0,model='van'){
 const sprite=FLEET_ART[model],color=['#f25b58','#f7c74d','#52b6fb'][service]??'#52b6fb';
 if(sprite){
  const [x,y,w,h]=sprite.rect,[iw,ih]=FLEET_SIZE,name=VEHICLE_MODELS.find(v=>v.id===model).name;
  return `<div class="vehiclePhoto topdown" role="img" aria-label="${name}" data-model="${model}" style="aspect-ratio:${w}/${h};background-image:url('${FLEET_IMAGE}');background-size:${iw/w*100}% ${ih/h*100}%;background-position:${x/(iw-w)*100}% ${y/(ih-h)*100}%"><span class="fleetService" style="--fleet-color:${color}"></span></div>`;
 }
 const row={van:0,express:1,truck:2}[model]??0;
 const name=['Сервисный фургон с лестницей','Компактный сервисный фургон','Бортовой автомобиль с инструментом и краном'][row];
 return `<div class="vehiclePhoto" role="img" aria-label="${name}" style="background-position:0% ${row*50}%"><span class="fleetService" style="--fleet-color:${color}"></span></div>`;
}
