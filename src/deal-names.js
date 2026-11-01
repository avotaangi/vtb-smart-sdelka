const sampleNames = new Map([
  ['wedding', ['Оформление свадьбы', 'Алина Орехова', 'Оформление свадьбы с Алиной Ореховой']],
  ['brand', ['Оформление витрины', 'Ольга Шавочкина', 'Оформление витрины с Ольгой Шавочкиной']],
  ['salon', ['Декор открытия студии', 'Полина Попова', 'Декор открытия студии с Полиной Поповой']],
  ['photo', ['Свадебная фотосъёмка', 'Алина Орехова', 'Свадебная фотосъёмка с Алиной Ореховой']],
  ['host', ['Ведение свадьбы', 'Алина Орехова', 'Ведение свадьбы с Алиной Ореховой']],
]);

export const dealTitle = deal => deal.displayName || deal.name;

// A working title is separate from the service terms accepted by the client.
export function renameDeal(deal, value, executorId) {
  if (deal.executorId !== executorId) throw new Error('Название может изменить только исполнитель сделки');
  const title = String(value || '').trim().replace(/\s+/g, ' ');
  if (!title) throw new Error('Введите название сделки');
  if (title.length > 120) throw new Error('Название должно быть не длиннее 120 символов');
  return {...deal, displayName: title};
}

export function refreshSampleName(deal) {
  const sample = sampleNames.get(deal.id);
  return sample && !deal.displayName && deal.name === sample[0] && deal.client === sample[1]
    ? {...deal, displayName: sample[2]} : deal;
}
