// Condition of a managed residential building. Higher values mean more wear.
// Pure functions: deterministic, offline and independent from the view layer.
export const SYSTEMS = Object.freeze([
  Object.freeze({key:'water',label:'Водоснабжение'}),
  Object.freeze({key:'power',label:'Электрика'}),
  Object.freeze({key:'heating',label:'Отопление'}),
  Object.freeze({key:'roof',label:'Кровля и фасад'}),
  Object.freeze({key:'grounds',label:'Двор и подъезды'})
]);
export const SYSTEM_KEYS = Object.freeze(SYSTEMS.map(s=>s.key));

// Exactly one affected subsystem per incident type from engine.TYPES.
// This mapping is an original design choice and can be tuned without editing UI.
const TYPE_SYSTEMS = Object.freeze([
  'water', 'water', 'water', 'heating', 'water',
  'heating', 'water', 'power', 'power', 'grounds',
  'power', 'power', 'power', 'power', 'roof',
  'grounds', 'roof', 'grounds', 'grounds', 'roof'
]);
export function systemForType(typeIndex) {
  if (!Number.isInteger(typeIndex) || !TYPE_SYSTEMS[typeIndex])
    throw Error('Неизвестный тип происшествия');
  return TYPE_SYSTEMS[typeIndex];
}
export function clampWear(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
export function initialSystems(wear) {
  if (!Number.isFinite(wear) || wear < 0 || wear > 100)
    throw Error('Некорректный износ здания');
  return Object.fromEntries(SYSTEM_KEYS.map(key => [key, clampWear(wear)]));
}
export function syncWear(home) {
  home.wear = Math.round(SYSTEM_KEYS.reduce((total,key)=>total+home.systems[key],0)/SYSTEM_KEYS.length);
  return home.wear;
}
// Called by the migration/loading boundary. Reject malformed modern states
// rather than silently erasing damaged progress.
export function normalizeHome(home) {
  if (!home || typeof home !== 'object') throw Error('Некорректный дом');
  if (home.systems == null) home.systems = initialSystems(home.wear);
  for (const key of SYSTEM_KEYS) {
    if (!Number.isInteger(home.systems[key]) || home.systems[key] < 0 || home.systems[key] > 100)
      throw Error('Некорректное состояние системы: ' + key);
  }
  syncWear(home);
  return home;
}
export function changeWear(home,key,delta) {
  if (!SYSTEM_KEYS.includes(key)) throw Error('Неизвестная система дома');
  if (!Number.isFinite(delta)) throw Error('Некорректное изменение износа');
  home.systems[key] = clampWear(home.systems[key] + delta);
  syncWear(home);
}
export function applyDailyWear(home,weather) {
  // Everyday degradation; cold stresses heating/outdoor access, rain stresses roof/drainage.
  for (const key of SYSTEM_KEYS) changeWear(home,key,1);
  if (weather.kind === 'snow' || weather.kind === 'frost') {
    changeWear(home,'heating',3);
    changeWear(home,'grounds',2);
    changeWear(home,'water',1);
  } else if (weather.kind === 'rain') {
    changeWear(home,'roof',3);
    changeWear(home,'grounds',1);
    changeWear(home,'water',1);
  }
}
export function weakestSystem(home) {
  return SYSTEMS.reduce((worst,system)=>
    home.systems[system.key] > home.systems[worst.key] ? system : worst,SYSTEMS[0]);
}
export function averageWear(homes,key) {
  if (!SYSTEM_KEYS.includes(key) || !homes.length) throw Error('Некорректная система');
  return homes.reduce((sum,home)=>sum+home.systems[key],0)/homes.length;
}
