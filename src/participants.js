import { uid } from './model.js';

const nameKey = value => String(value || '').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');

export function migrateParticipants(db) {
  const names = new Map();
  for (const deal of db.deals) {
    if (deal.clientId && deal.clientId !== 'other' &&
        !(deal.clientId === 'anna' && nameKey(deal.client) !== nameKey('Алина Орехова'))) {
      names.set(nameKey(deal.client), deal.clientId);
    }
  }
  return {...db, deals: db.deals.map(deal => {
    const key = nameKey(deal.client);
    const id = names.get(key) || `client-${deal.id}`;
    names.set(key, id);
    return {...deal, clientId: id};
  })};
}

export function clientProfiles(deals) {
  const profiles = new Map();
  for (const deal of deals) {
    if (deal.status !== 'draft') profiles.set(deal.clientId, deal.client);
  }
  return [...profiles].map(([id, name]) => ({id, name}));
}

export function resolveClientId(deals, name) {
  return deals.find(deal => nameKey(deal.client) === nameKey(name))?.clientId || `client-${uid()}`;
}

// A demo identity, not authentication. A link selects the recipient's own cabinet.
export function invitationTarget(deals, value, origin) {
  const url = new URL(value, origin);
  const match = url.hash.match(/^#\/deal\/([^/]+)(?:\/[^/]+)?$/);
  if (url.origin !== origin || !match) throw new Error('Используйте ссылку на сделку этого сервиса');
  const deal = deals.find(item => item.id === match[1] && item.status !== 'draft');
  if (!deal) throw new Error('Сделка не найдена в этом браузере. Откройте ссылку там, где сделка была создана');
  const recipient = url.searchParams.get('client');
  if (recipient && recipient !== deal.clientId) throw new Error('Получатель ссылки не совпадает с клиентом сделки');
  return {dealId: deal.id, clientId: deal.clientId};
}
