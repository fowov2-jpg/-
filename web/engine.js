// Deterministic simulation. No DOM, clocks, network or storage dependencies.
import {routePlan,weatherForDay} from './routing.js';
import {SYSTEM_KEYS,systemForType,normalizeHome,changeWear,applyDailyWear,averageWear} from './buildings.js';
export const SERVICES = ['Сантехническая №1','Электротехническая №2','Ремонтная №3'];
export const COLORS = ['#ff665e','#ffc64a','#58b9ff'];
export const TYPES = [
 ['Прорыв трубы',0,3,28,6200,'Из трубы в подвале бьёт вода.','Подвал затапливает, вода приближается к щитовой.'],
 ['Засор канализации',0,2,24,2400,'Вода не уходит в нескольких квартирах.','Проблема во всём стояке, со вчерашнего вечера.'],
 ['Протечка стояка',0,2,30,3800,'Мокрая стена в подъезде.','Течёт между вторым и третьим этажами.'],
 ['Нет горячей воды',0,1,22,1600,'Из горячего крана идёт холодная вода.','Это во всём подъезде, с утра.'],
 ['Неисправный вентиль',0,1,18,1800,'Вентиль в подвале не закрывается.','Доступ в подвал у старшего по дому.'],
 ['Течь радиатора',0,3,26,4200,'Из батареи капает на пол.','Течь усиливается, квартира на первом этаже.'],
 ['Падение давления',0,2,32,3100,'На верхних этажах почти нет воды.','Соседи тоже жалуются, на первом этаже вода есть.'],
 ['Отключение подъезда',1,3,25,3300,'Во всём подъезде погас свет.','Нет света и в квартирах, запаха дыма нет.'],
 ['Неисправность щитка',1,3,35,5400,'Щиток трещит и пахнет горелым.','Щиток на первом этаже, рядом никто не находится.'],
 ['Не горит фонарь',1,1,18,2100,'Темно у входа во двор.','Не работает один фонарь, остальные светят.'],
 ['Повреждение проводки',1,2,32,3600,'Свет в коридоре постоянно мигает.','Мигает весь этаж, автомат не отключался.'],
 ['Сбой домофона',1,1,20,1900,'Домофон не открывает дверь.','Ключи не работают у всех жителей.'],
 ['Отказ насоса',1,3,36,7200,'В подвале остановился насос.','Слышен гул, но насос не запускается.'],
 ['Освещение лестницы',1,1,14,800,'На лестнице перегорели лампы.','Не освещены второй и третий этажи.'],
 ['Протечка кровли',2,3,42,8500,'После дождя течёт потолок.','Вода в двух квартирах верхнего этажа.'],
 ['Повреждение двери',2,1,25,2700,'Входная дверь не закрывается.','Сломан доводчик, само полотно целое.'],
 ['Разбитое окно',2,2,28,3200,'В подъезде разбито стекло.','Окно на лестничной площадке второго этажа.'],
 ['Обледенение входа',2,3,20,1400,'У входа очень скользко.','Лёд на ступеньках, жильцы пока не пострадали.'],
 ['Повреждение ступеней',2,2,40,6500,'Крошится край крыльца.','Повреждены две ступени у главного входа.'],
 ['Засор водостока',2,1,30,2200,'Вода с крыши льётся на фасад.','Забита труба со стороны двора.']
];
export const HOMES = [
 {id:0,name:'ул. Садовая, 12',x:240,y:290,wear:40},
 {id:1,name:'ул. Лесная, 5',x:650,y:470,wear:32},
 {id:2,name:'ул. Молодёжная, 8',x:310,y:820,wear:48}
];
export const SHIFT = 480;
// One shared travel estimate is used by the game and the dispatch UI.
export function travelMinutes(crew, call, state) {return routePlan(crew.home,call.home,{day:state?.day??1,minute:state?.minute??0}).minutes;}
export function fresh() { return {version:2,day:1,minute:0,phase:'prep',money:3000000,reputation:70,seed:112,sequence:0,nextCall:0,homes:structuredClone(HOMES).map(normalizeHome),calls:[],ledger:[],report:null,opening:3000000,crews:SERVICES.map((name,id)=>({id,name,service:id,level:1,xp:0,fatigue:0,fuel:100,condition:100,equipment:1,status:'idle',job:null,remaining:0,total:0,home:0}))}; }
function rand(s) { s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0; return s.seed/4294967296; }
export function book(s,amount,label) { s.money+=amount;s.ledger.unshift({day:s.day,minute:s.minute,amount,label});s.ledger=s.ledger.slice(0,100); }
function spend(s,amount,label) { if(s.money<amount) throw Error('Недостаточно средств');book(s,-amount,label); }
export function spawn(s,typeIndex=null,homeIndex=null) {
 const weather=weatherForDay(s.day);
 const cold=weather.kind==='snow'||weather.kind==='frost';
 // Per-system risk selects the incident; the condition of THAT system
 // then biases which property receives it. PRNG is saved with the game.
 const typeWeights=TYPES.map((_,i)=>{
   if(i===17&&!cold)return 0; // ice is a cold-season event
   const base=1+averageWear(s.homes,systemForType(i))/50;
   return base*((cold&&(i===5||i===17))?3:1)*
     ((weather.kind==='rain'&&(i===14||i===19))?3:1);
 });
 let t=typeIndex;
 if(t===null){
   let roll=rand(s)*typeWeights.reduce((a,b)=>a+b,0);
   t=typeWeights.length-1;
   for(let i=0;i<typeWeights.length;i++)if((roll-=typeWeights[i])<0){t=i;break;}
 }
 if(!TYPES[t])throw Error('Неизвестное происшествие');
 const system=systemForType(t);
 const weights=s.homes.map(h=>20+h.systems[system]);
 let roll=rand(s)*weights.reduce((a,b)=>a+b,0), h=0;
 while(h<weights.length-1 && (roll-=weights[h])>0)h++;
 const home=homeIndex??h;
 if(!s.homes[home])throw Error('Дом не найден');
 const spec=TYPES[t];
 const call={id:++s.sequence,type:t,home,priority:spec[2],created:s.minute,status:'new',asked:false,diagnosed:false,crew:null,due:s.minute+[180,110,65][spec[2]-1],late:false};
 s.calls.push(call);return call;
}
export function start(s) {
 if(s.phase!=='prep')throw Error('Смена уже началась');
 s.phase='active';s.opening=s.money;s.minute=0;s.nextCall=35;
 if(s.day===1){spawn(s,0,0);spawn(s,7,1);spawn(s,15,2);}else if(s.calls.length<3){spawn(s);}
}
export function question(s,id) { const c=s.calls.find(c=>c.id===id);if(!c)throw Error('Заявка не найдена');c.asked=true;return TYPES[c.type][6]; }
export function dispatch(s,id,crewId) {
 if(s.phase!=='active')throw Error('Сначала начните смену');
 const c=s.calls.find(c=>c.id===id), crew=s.crews.find(c=>c.id===crewId);
 if(!c||!crew||c.status!=='new')throw Error('Заявка уже назначена');
 if(crew.status!=='idle')throw Error('Бригада занята');
 if(crew.service!==TYPES[c.type][1])throw Error('Нужна другая специализация');
 if(crew.fuel<8||crew.condition<20||crew.fatigue>90)throw Error('Бригаде нужен отдых или обслуживание');
 const plan=routePlan(crew.home,c.home,{day:s.day,minute:s.minute});
 spend(s,TYPES[c.type][4],'Материалы: '+TYPES[c.type][0]);
 c.status='travel';c.crew=crew.id;crew.status='travel';crew.job=c.id;
 crew.route=plan.points;crew.remaining=crew.total=plan.minutes;crew.fuel-=8;
}
export function outsource(s,id) {
 if(s.phase!=='active')throw Error('Смена не запущена');const c=s.calls.find(c=>c.id===id);
 if(!c||c.status!=='new')throw Error('Заявка недоступна');
 spend(s,TYPES[c.type][4]*3,'Подрядчик: '+TYPES[c.type][0]);c.status='contractor';c.remaining=45;
}
function complete(s,c) { c.status='done';c.completed=s.minute;s.reputation=Math.min(100,s.reputation+(c.late?0:1));changeWear(s.homes[c.home],systemForType(c.type),-10); }
export function tick(s,minutes=1) {
 if(s.phase!=='active')return;
 for(let n=0;n<Math.min(480,Math.max(0,Math.floor(minutes)))&&s.phase==='active';n++) {
 s.minute++;
 if(s.minute>=s.nextCall&&s.minute<400) { if(s.calls.filter(c=>c.status!=='done').length<7 && rand(s)<.35+s.homes.reduce((n,h)=>n+h.wear,0)/300)spawn(s);s.nextCall=s.minute+35+Math.floor(rand(s)*25); }
 for(const c of s.calls) {
 if(c.status!=='done'&&!c.late&&s.minute>c.due) {c.late=true;s.reputation=Math.max(0,s.reputation-3);book(s,-1500*c.priority,'Ущерб: '+TYPES[c.type][0]);changeWear(s.homes[c.home],systemForType(c.type),12);}
 if(c.status==='contractor'&&--c.remaining<=0)complete(s,c);
 }
 for(const cr of s.crews) {
 if(cr.status==='idle')continue;
 if(--cr.remaining>0)continue;
 const c=s.calls.find(c=>c.id===cr.job);
 if(cr.status==='travel'){cr.status=c.status='diagnosis';cr.home=c.home;cr.remaining=cr.total=c.asked?4:8;}
 else if(cr.status==='diagnosis'){c.diagnosed=true;cr.status=c.status='repair';cr.remaining=cr.total=Math.ceil(TYPES[c.type][3]/(1+(cr.level-1)*.1+(cr.equipment-1)*.15));}
 else {complete(s,c);cr.status='idle';cr.job=null;cr.route=null;cr.xp+=10;cr.fatigue=Math.min(100,cr.fatigue+12);cr.condition=Math.max(0,cr.condition-3);}
 }
 if(s.minute>=SHIFT)finish(s);
 }
}
export function finish(s) {
 if(s.phase!=='active')return;
 const done=s.calls.filter(c=>c.status==='done').length, pending=s.calls.length-done;
 book(s,3*22000,'Договоры обслуживания: 3 дома');book(s,-6*1800,'Зарплаты: 6 сотрудников');book(s,-4500,'Гараж и постоянные расходы');
 s.report={done,pending,total:s.calls.length,late:s.calls.filter(c=>c.late).length,net:s.money-s.opening};s.phase='report';
}
export function nextDay(s) {
 if(s.phase!=='report')throw Error('Сначала завершите смену');
 s.day++;s.minute=0;s.phase='prep';s.report=null;
 s.calls=s.calls.filter(c=>c.status!=='done');
 for(const c of s.calls){c.created-=SHIFT;c.due-=SHIFT;}
 for(const cr of s.crews)cr.fatigue=Math.max(0,cr.fatigue-50);
 for(const h of s.homes)applyDailyWear(h,weatherForDay(s.day));
}
export function maintain(s,id,kind) {
 const c=s.crews[id];if(!c||c.status!=='idle')throw Error('Дождитесь освобождения бригады');
 if(kind==='service'){spend(s,5000,'Топливо и ТО: '+c.name);c.fuel=100;c.condition=100;}
 else if(kind==='equipment'){if(c.equipment>=3)throw Error('Максимальное оснащение');spend(s,25000*c.equipment,'Оснащение: '+c.name);c.equipment++;}
 else if(kind==='train'){if(c.xp<30)throw Error('Нужно 30 опыта');spend(s,15000,'Обучение: '+c.name);c.xp-=30;c.level++;}
 else throw Error('Неизвестное действие');
}
export function prevent(s,id,systemKey=null) {
 if(s.phase!=='prep')throw Error('Профилактика доступна перед сменой');
 const h=s.homes[id];if(!h)throw Error('Дом не найден');
 if(systemKey!==null && !SYSTEM_KEYS.includes(systemKey))throw Error('Неизвестная система дома');
 const amount=systemKey===null?12000:8000;
 spend(s,amount,'Профилактика: '+h.name+(systemKey===null?'':' / '+systemKey));
 if(systemKey===null)for(const key of SYSTEM_KEYS)changeWear(h,key,-15);
 else changeWear(h,systemKey,-20);
}
export function encode(s){return JSON.stringify(s);}
export function decode(raw){
 const s=JSON.parse(raw);
 if(![1,2].includes(s?.version)||!['prep','active','report'].includes(s.phase)||
    !Number.isFinite(s.money)||!Number.isInteger(s.day)||s.day<1||
    !Number.isFinite(s.minute)||s.minute<0||s.minute>480||
    !Array.isArray(s.crews)||s.crews.length!==3||
    !Array.isArray(s.homes)||s.homes.length!==3||
    !Array.isArray(s.calls)||!Array.isArray(s.ledger))
   throw Error('Сохранение повреждено');
 for(const h of s.homes){
   if(s.version===2 && !h.systems)throw Error('Отсутствует состояние дома');
   normalizeHome(h);
 }
 for(const c of s.calls)if(!TYPES[c.type]||!s.homes[c.home])throw Error('Неизвестная заявка');
 s.version=2; // migration from version 1: every system inherits the former aggregate wear
 return s;
}
