import * as E from './engine.js';
import * as D from './dispatch.js';
import {weatherForDay} from './routing.js';

// Presentation only: buttons retain the single event handler in app.js.
export function dispatcherTop(state, {icon, button, status, pill}) {
  const count = D.counts(state), current = D.queue(state)[0];
  const summary = `<div class="dispatch-summary">
    <span>Ожидают: <b>${count.new}</b></span>
    <span class="weather-chip">${weatherForDay(state.day).label}</span>
    <span class="${count.overdue ? 'danger' : ''}">Просрочено: <b>${count.overdue}</b></span>
    ${button('tab', 'Вся очередь', 'data-tab="calls" aria-label="Открыть очередь заявок"', 'queue-link')}
  </div>`;
  if (!current) return summary + `<div class="incident">
    <span class="serviceIcon green">${icon('shield')}</span>
    <div><h3>${state.phase === 'prep' ? 'Район готов к работе' : 'Все заявки обработаны'}</h3>
    <small>${state.phase === 'prep' ? 'Проверьте службы и начните смену' : 'Ожидайте обращения жителей'}</small></div>
  </div>`;
  const due = D.deadline(state, current);
  return summary + `<button class="incident ${due.level === 'overdue' ? 'incident-overdue' : ''}"
    data-action="call" data-id="${current.id}">
    <span class="serviceIcon" style="color:${E.COLORS[E.TYPES[current.type][1]]}">
      ${icon(['water', 'bolt', 'tool'][E.TYPES[current.type][1]])}
    </span>
    <span class="info">${pill(current)}
      <h3>${E.TYPES[current.type][0]}</h3>
      <small>${state.homes[current.home].name} · ${status[current.status]}</small>
      <span class="deadline deadline-${due.level}">${due.label}</span>
    </span>
    ${icon('arrow')}
  </button>`;
}

export function dispatcherList(state, filter, {button, status, pill}) {
  const count = D.counts(state);
  const entries = D.queue(state, filter);
  const controls = D.FILTERS.map(([id, label]) =>
    button('filter', `${label} · ${count[id]}`,
      `data-filter="${id}" aria-pressed="${filter === id}"`, filter === id ? 'active' : '')).join('');
  const cards = entries.map(c => {
    const due = D.deadline(state, c);
    return `<article class="card dispatch-card urgency-${due.level}">
      <div class="row">${pill(c)}<small>№${String(c.id).padStart(3, '0')}</small></div>
      <h3 class="dispatch-title">${E.TYPES[c.type][0]}</h3>
      <p class="muted">${state.homes[c.home].name}</p>
      <span class="deadline deadline-${due.level}">${due.label}</span>
      <div class="row dispatch-card-bottom">
        <span class="dispatch-status">${status[c.status]}</span>
        ${button('call', 'Открыть', `data-id="${c.id}" aria-label="Открыть заявку №${c.id}"`, 'open-request')}
      </div>
    </article>`;
  }).join('');
  return `<div class="pageHead"><div class="eyebrow">ДИСПЕТЧЕРСКАЯ</div>
    <h2>Очередь обращений</h2>
    <p class="muted">${count.new} ожидают бригаду · ${count.assigned} выполняются · ${count.done} завершено</p>
  </div>
  <div class="tabs" aria-label="Фильтры заявок">${controls}</div>
  <div class="dispatch-cards">${cards || '<div class="empty">В выбранной категории заявок нет.</div>'}</div>`;
}

export function dispatcherDialog(state, c, {button, icon, pill, rub, shell, status}) {
  const type = E.TYPES[c.type], due = D.deadline(state, c);
  const assigned = state.crews.find(cr => cr.job === c.id);
  const options = c.status !== 'new' ? '' : `<h3 class="assignment-head">Назначить бригаду</h3>
    ${state.crews.map(crew => {
      const option = D.crewOption(state, c, crew);
      const explanation = option.available
        ? `Прибытие ~${option.arrival} мин · завершение ~${option.total} мин`
        : option.reason;
      const risk = option.available && due.remaining !== null && due.remaining < option.total
        ? '<span class="danger">Риск просрочки</span>' : '';
      return `<div class="crew-option">
        ${button('dispatch',
          `<span><strong>${crew.name}</strong><small>${explanation}</small>${risk}</span>${icon('arrow')}`,
          `data-id="${c.id}" data-crew="${crew.id}" ${option.available ? '' : 'disabled'}`,
          'assignment')}
      </div>`;
    }).join('')}
    ${(() => {
      const option = D.contractorOption(state, c);
      return `<div class="contractor-choice">
        ${button('outsource', `Подрядчик · ${rub(option.cost)}`,
          `data-id="${c.id}" ${option.available ? '' : 'disabled'}`)}
        <small>${option.available ? 'Оценка выполнения: 45 игровых минут' : option.reason}</small>
      </div>`;
    })()}`;
  const content = `<div class="call-meta">${pill(c)}
    <span class="deadline deadline-${due.level}">${due.label}</span>
  </div>
  <p class="muted">${state.homes[c.home].name} · заявка №${c.id}</p>
  <div class="quote">${icon('phone')} «${type[5]}»</div>
  ${c.asked ? `<p class="help">${type[6]}</p>`
    : c.status === 'done' ? '<p class="muted">Уточнение не проводилось</p>'
      : button('question', 'Уточнить обстоятельства', `data-id="${c.id}"`)}
  <div class="grid call-facts">
    <div class="metric"><small>Материалы</small><b>${rub(type[4])}</b></div>
    <div class="metric"><small>Специализация</small><b class="fact-text">${['Вода', 'Электрика', 'Ремонт'][type[1]]}</b></div>
  </div>
  <p class="call-status">Статус: <strong>${status[c.status]}</strong>
    ${assigned ? `· ${assigned.name}, осталось ${assigned.remaining} мин на этапе` : ''}</p>
  ${c.diagnosed ? '<p class="green">Диагностика завершена. Материалы зарезервированы.</p>' : ''}
  ${options}`;
  return shell(type[0], content);
}
