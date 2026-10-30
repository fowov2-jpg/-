// Read-only selectors for the dispatcher UI. The simulation remains the single source of truth.
import {TYPES} from './engine.js';

export const FILTERS = [
  ['active', 'Активные'],
  ['new', 'Без бригады'],
  ['assigned', 'В работе'],
  ['overdue', 'Просрочены'],
  ['done', 'Завершены'],
  ['all', 'Все']
];

export function deadline(state, call) {
  if (call.status === 'done') {
    return {level: 'done', remaining: null, label: call.late ? 'Выполнено с просрочкой' : 'Выполнено в срок'};
  }
  const remaining = call.due - state.minute;
  if (call.late || remaining < 0) {
    return {level: 'overdue', remaining, label: 'Срок превышен'};
  }
  if (remaining <= 15) return {level: 'critical', remaining, label: `Осталось ${remaining} мин · срочно`};
  if (remaining <= 45) return {level: 'warning', remaining, label: `Осталось ${remaining} мин · внимание`};
  return {level: 'normal', remaining, label: `До срока ${remaining} мин`};
}

export function counts(state) {
  const pending = state.calls.filter(c => c.status !== 'done');
  return {
    active: pending.length,
    new: pending.filter(c => c.status === 'new').length,
    assigned: pending.filter(c => c.status !== 'new').length,
    overdue: pending.filter(c => deadline(state, c).level === 'overdue').length,
    done: state.calls.length - pending.length,
    all: state.calls.length
  };
}

export function queue(state, filter = 'active') {
  if (!FILTERS.some(([key]) => key === filter)) throw Error('Неизвестный фильтр');
  return state.calls.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'active') return c.status !== 'done';
    if (filter === 'new') return c.status === 'new';
    if (filter === 'assigned') return c.status !== 'new' && c.status !== 'done';
    if (filter === 'overdue') return c.status !== 'done' && deadline(state, c).level === 'overdue';
    return c.status === 'done';
  }).slice().sort((a, b) => {
    const order = {overdue: 0, critical: 1, warning: 2, normal: 3, done: 4};
    const diff = order[deadline(state, a).level] - order[deadline(state, b).level];
    return diff || b.priority - a.priority || (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) ||
      a.due - b.due || a.id - b.id;
  });
}

// This is the travel formula used by engine.dispatch today; update both together
// when replacing the index-based travel model with a proper road graph.
export function travelMinutes(crew, call) {
  return 10 + Math.abs(crew.home - call.home) * 5;
}

export function crewOption(state, call, crew) {
  const type = TYPES[call.type];
  const reason =
    state.phase !== 'active' ? 'Сначала начните смену' :
    call.status !== 'new' ? 'Заявка уже назначена' :
    crew.status !== 'idle' ? 'Бригада занята' :
    crew.service !== type[1] ? 'Другая специализация' :
    crew.fuel < 8 ? 'Недостаточно топлива — требуется ТО' :
    crew.condition < 20 ? 'Машине требуется ТО' :
    crew.fatigue > 90 ? 'Бригада устала — нужен отдых' :
    state.money < type[4] ? 'Недостаточно денег на материалы' : null;
  const arrival = travelMinutes(crew, call);
  const diagnosis = call.asked ? 4 : 8;
  const repair = Math.ceil(type[3] / (1 + (crew.level - 1) * .1 + (crew.equipment - 1) * .15));
  return {available: !reason, reason, arrival, total: arrival + diagnosis + repair, materials: type[4]};
}

export function contractorOption(state, call) {
  const cost = TYPES[call.type][4] * 3;
  const reason = state.phase !== 'active' ? 'Сначала начните смену' :
    call.status !== 'new' ? 'Заявка уже назначена' :
    state.money < cost ? 'Недостаточно денег для подрядчика' : null;
  return {available: !reason, reason, cost, minutes: 45};
}
