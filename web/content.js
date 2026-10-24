export const DISTRICTS=[
 {id:0,name:'Северный',description:'Жилые дворы и пятиэтажки',reputation:0,day:1,completed:0},
 {id:1,name:'Центральный',description:'Плотная застройка и сложные сети',reputation:76,day:3,completed:12},
 {id:2,name:'Заречный',description:'Большие дома и дорогие договоры',reputation:86,day:7,completed:35}
];
const addresses=['ул. Садовая, 12','ул. Лесная, 5','ул. Молодёжная, 8','ул. Садовая, 14','ул. Центральная, 3','ул. Центральная, 7','ул. Парковая, 10','ул. Парковая, 14','наб. Речная, 2','наб. Речная, 6','ул. Мостовая, 9','ул. Мостовая, 15'];
export const CITY_HOMES=addresses.map((name,id)=>({id,name,district:Math.floor(id/4),x:[190,1120,195,1120][id%4],y:Math.floor(id/4)*1024+[220,220,710,720][id%4],floors:[5,5,5,5,7,6,7,6,9,8,9,8][id],rate:[22000,22000,22000,24000,28000,30000,28000,32000,38000,40000,42000,44000][id],fee:[0,0,0,65000,120000,140000,120000,160000,220000,240000,260000,280000][id]}));
export const DEPOT=CITY_HOMES.length;
export const PARTS=[
 {id:0,name:'Сантехнические комплекты',short:'Сантехника',unit:'компл.',price:1400,icon:'water'},
 {id:1,name:'Электротехнические комплекты',short:'Электрика',unit:'компл.',price:1100,icon:'bolt'},
 {id:2,name:'Ремонтные комплекты',short:'Ремонт',unit:'компл.',price:1800,icon:'tool'}
];
export const VEHICLE_MODELS=[
 {id:'van',name:'Сервисный фургон',description:'Универсальный автомобиль для любого профиля',price:320000,speed:1,capacity:8,upkeep:700},
 {id:'express',name:'Быстрый фургон',description:'На 30% быстрее, но меньше грузовой отсек',price:510000,speed:1.3,capacity:6,upkeep:1000},
 {id:'truck',name:'Грузовой пикап',description:'Запас материалов для сложных ремонтов',price:440000,speed:.9,capacity:14,upkeep:900},
 {"id":"kamaz-crane","name":"Автокран на шасси КамАЗ","description":"Подача тяжёлых материалов: трубы, насосы, кровля и ступени","price":1850000,"speed":0.72,"capacity":20,"upkeep":3200,"kind":"crane","supportedTypes":[0,12,14,18]},
 {"id":"gazelle-next-van","name":"ГАЗель NEXT, фургон","description":"Сервисный фургон для всех профилей","price":610000,"speed":1.15,"capacity":12,"upkeep":1200,"kind":"service"},
 {"id":"gaz53-scissor-lift","name":"ГАЗ-53, ножничный подъёмник","description":"Работы на высоте: светильники, кровля, окна и водостоки","price":720000,"speed":0.8,"capacity":10,"upkeep":1400,"kind":"lift","supportedTypes":[9,13,14,16,19]},
 {"id":"gaz53-aerial-lift","name":"ГАЗ-53, автовышка","description":"Высотные работы с подъёмной корзиной","price":760000,"speed":0.78,"capacity":10,"upkeep":1500,"kind":"lift","supportedTypes":[9,13,14,16,19]},
 {"id":"gaz3307-tipper","name":"ГАЗ-3307, самосвал","description":"Материалы для входных групп: обледенение и ступени","price":580000,"speed":0.78,"capacity":24,"upkeep":1650,"kind":"tipper","supportedTypes":[17,18]},
 {"id":"gazon-next-flatbed","name":"ГАЗон NEXT, бортовой","description":"Бортовой автомобиль для ремонтных материалов","price":780000,"speed":0.95,"capacity":20,"upkeep":1600,"kind":"service"},
 {"id":"kamaz6520-tipper","name":"КамАЗ-6520, самосвал","description":"Тяжёлые поставки для ремонта входов","price":1300000,"speed":0.8,"capacity":32,"upkeep":2500,"kind":"tipper","supportedTypes":[17,18]},
 {"id":"maz-tipper","name":"МАЗ, самосвал","description":"Самосвал для материалов и ремонта ступеней","price":1250000,"speed":0.78,"capacity":30,"upkeep":2400,"kind":"tipper","supportedTypes":[17,18]},
 {"id":"gazelle-business-flatbed","name":"ГАЗель Бизнес, двухрядная кабина и борт","description":"Двухрядная кабина и борт для бригады с материалами","price":480000,"speed":1,"capacity":14,"upkeep":950,"kind":"service"},
 {"id":"uaz39094-utility","name":"УАЗ-39094, аварийная служба","description":"Аварийная служба: инструмент и материалы под тентом","price":410000,"speed":0.92,"capacity":9,"upkeep":800,"kind":"service"},
 {"id":"maz-crane","name":"МАЗ, автокран","description":"Подъём материалов на крупных ремонтных работах","price":1750000,"speed":0.75,"capacity":20,"upkeep":3000,"kind":"crane","supportedTypes":[0,12,14,18]},
 {"id":"gazelle-next-aerial-lift","name":"ГАЗель NEXT, автовышка","description":"Компактная автовышка для дворовых работ","price":1100000,"speed":1.05,"capacity":8,"upkeep":1800,"kind":"lift","supportedTypes":[9,13,14,16,19]},
 {"id":"uaz2206-minibus","name":"УАЗ-2206, микроавтобус","description":"Микроавтобус для выездной бригады","price":370000,"speed":0.95,"capacity":8,"upkeep":750,"kind":"service"},
 {"id":"gaz53-ks1571-crane","name":"ГАЗ-53А, автокран КС-1571","description":"Кран для труб, насосов и строительных материалов","price":950000,"speed":0.7,"capacity":16,"upkeep":1900,"kind":"crane","supportedTypes":[0,12,14,18]}
];
export const PEOPLE=[
 ['Алексей Волков',0,2,2200,12],['Сергей Морозов',0,1,1400,6],['Дмитрий Соколов',1,2,2200,10],['Андрей Козлов',1,1,1400,5],['Михаил Петров',2,2,2200,14],['Иван Лебедев',2,1,1400,7],
 ['Павел Орлов',0,1,1500,4],['Николай Фомин',1,2,2400,9],['Олег Белов',2,1,1500,5],['Роман Кузнецов',0,3,3000,16],['Виктор Павлов',1,1,1450,3],['Евгений Титов',2,2,2300,11],
 ['Антон Васильев',0,2,2200,8],['Максим Егоров',1,3,3100,15],['Константин Зайцев',2,3,3000,13],['Вадим Никитин',0,1,1450,3],['Артём Соловьёв',1,1,1500,4],['Денис Захаров',2,1,1450,3]
];
export const ROLES=['Сантехник','Электромонтёр','Мастер по ремонту'];
export const MILESTONES=[
 {id:'reliable',title:'Первая надёжная смена',description:'Выполнить 3 обращения и закончить день без просроченного остатка',reward:25000},
 {id:'growth',title:'Растущая компания',description:'4 действующих договора и 4 сформированные бригады',reward:75000},
 {id:'operator',title:'Городской оператор',description:'9 договоров, 100 выполненных работ и репутация 90',reward:250000}
];
export function billFor(type,types){const spec=types[type];return {part:spec[1],quantity:Math.max(1,Math.ceil(spec[4]/PARTS[spec[1]].price))};}
export const initials=name=>name.split(' ').slice(0,2).map(x=>x[0]).join('');
