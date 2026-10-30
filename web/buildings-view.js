import {SYSTEMS,weakestSystem} from './buildings.js';

// Presentational helpers. All authoritative expenses and changes are in engine.prevent.
function severity(wear) {
  return wear >= 70 ? 'severe' : wear >= 45 ? 'watch' : 'good';
}
export function systemRows(home) {
  return '<div class="building-systems">' + SYSTEMS.map(({key,label}) => {
    const wear=home.systems[key];
    return '<div class="building-system"><div class="row"><span>'+label+
      '</span><strong>'+wear+'% износ</strong></div><div class="condition system-meter '+
      severity(wear)+'"><i style="width:'+wear+'%"></i></div></div>';
  }).join('')+'</div>';
}
export function homeCard(home,button) {
  const weakest=weakestSystem(home);
  return '<div class="card building-card"><div class="row"><div><h3>'+home.name+
    '</h3><small>Договор: 22 000 ₽ / смена</small></div>'+
    button('home','Подробнее','data-id="'+home.id+'" aria-label="Карточка дома '+home.name+'"')+
    '</div><p>Общий износ: <strong>'+home.wear+'%</strong></p>'+
    '<small>Требует внимания: '+weakest.label+' ('+home.systems[weakest.key]+'%)</small>'+
    systemRows(home)+'</div>';
}
export function homeDialog(home,phase,money,{button,shell,rub}) {
  const available=phase==='prep';
  const systemActions=SYSTEMS.map(({key,label})=>
    '<div class="building-action"><div><strong>'+label+
      '</strong><small>Износ '+home.systems[key]+'% → '+Math.max(0,home.systems[key]-20)+'%</small></div>'+
    button('prevent','−20% · '+rub(8000),
      'data-id="'+home.id+'" data-system="'+key+'" '+
      (!available||money<8000?'disabled':''), 'prevent-system')+'</div>').join('');
  const all=button('prevent','Общая профилактика · '+rub(12000),
    'data-id="'+home.id+'" '+(!available||money<12000?'disabled':''), 'primary wide');
  return shell(home.name,'<p>Инженерное состояние здания. Повреждения и ремонты изменяют отдельные системы.</p>'+
    '<p class="muted">Средний износ: '+home.wear+'% · Доход: 22 000 ₽ за смену</p>'+
    systemRows(home)+'<h3 class="prevention-title">Профилактика перед сменой</h3>'+
    '<p class="muted">Общая обработка снижает износ каждой системы на 15 пунктов.</p>'+
    '<div class="prevention-all">'+all+'</div>'+
    '<div class="prevention-choices">'+systemActions+'</div>'+
    '<small>Локальная профилактика снижает износ только выбранной системы на 20 пунктов. '+
    (available?'':'Доступно только в подготовке.')+'</small>');
}
