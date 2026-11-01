import { uid, today, validateDeal, paymentKopecks, deadline, fullDate, money } from './model.js';

const clone = value => structuredClone(value);
const stageKeys = ['id','name','type','owner','comment','fields','deps','deadline','payment'];
const dealKeys = ['name','group','client','clientId','executor','executorId','category','price','startDate','endDate','briefId','briefSnapshot','briefValues'];
const pick = (item, keys) => Object.fromEntries(keys.map(key => [key, clone(item[key])]));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const timestamp = () => new Date().toISOString();
const withRuntime = (deal, terms) => ({...terms, stages: terms.stages.map(stage => ({
  status: 'pending', paid: false, values: {}, note: '',
  ...clone(deal.stages.find(item => item.id === stage.id) || {}), ...pick(stage, stageKeys),
}))});

export const hasStageActivity = stage => Boolean(stage && (stage.status !== 'pending' || stage.paid || stage.funds === 'reserved' ||
  stage.dispute?.status === 'open' || Object.values(stage.values || {}).some(value => Array.isArray(value) ? value.length : value != null && value !== '')));

export function termsOf(deal) {
  return {...pick(deal, dealKeys), stages: deal.stages.map(stage => pick(stage, stageKeys))};
}

export function acceptInitialTerms(deal, clientId) {
  if (deal.status !== 'sent' || clientId !== deal.clientId) throw new Error('Эти условия недоступны для согласования');
  const at = timestamp();
  return {...deal, status: 'active', acceptedAt: at, acceptedBy: deal.client,
    versions: [{number: deal.version, acceptedAt: at, acceptedBy: deal.client, terms: termsOf(deal)}]};
}

export function revisionDraft(deal) {
  if (deal.status !== 'active' || deal.pendingRevision) throw new Error('Сначала завершите согласование текущего предложения');
  if (deal.revisionDraft) return clone(deal.revisionDraft);
  const terms = termsOf(deal);
  terms.stages = terms.stages.map(stage => {
    const original = deal.stages.find(item => item.id === stage.id);
    return hasStageActivity(original) && stage.payment.mode === 'percent'
      ? {...stage, payment: {...stage.payment, mode: 'fixed', value: paymentKopecks(deal, original) / 100}}
      : stage;
  });
  return {...terms, id: deal.id, status: 'revision', version: deal.version + 1,
    baseVersion: deal.version, reason: '', stages: terms.stages.map(stage => {
      const original = deal.stages.find(item => item.id === stage.id);
      return {...clone(original), ...stage};
    })};
}

function protectedStageTerms(deal, stage) {
  const value = pick(stage, stageKeys.filter(key => key !== 'payment'));
  return {...value, payment: {amount: paymentKopecks(deal, stage), trigger: stage.payment.trigger}, dueDate: deadline(deal, stage)};
}

export function revisionErrors(deal, draft) {
  draft = withRuntime(deal, draft);
  const errors = validateDeal(draft, {dateFloor: null});
  if (!['active', 'completed'].includes(deal.status)) errors.push('Изменять можно только согласованную сделку');
  if (draft.baseVersion !== deal.version) errors.push('Условия сделки изменились. Откройте новый черновик изменений');
  if (draft.clientId !== deal.clientId || draft.client !== deal.client || draft.executorId !== deal.executorId || draft.executor !== deal.executor)
    errors.push('Стороны действующей сделки менять нельзя');
  for (const old of deal.stages) {
    const proposed = draft.stages.find(stage => stage.id === old.id);
    if (hasStageActivity(old) && (!proposed || !same(protectedStageTerms(deal, old), protectedStageTerms(draft, proposed))))
      errors.push(`Этап «${old.name}» уже начат, передан, принят или оплачен. Его условия и сумму менять нельзя`);
  }
  for (const stage of draft.stages) {
    const old = deal.stages.find(item => item.id === stage.id);
    const date = deadline(draft, stage);
    if ((!old || !same(old.deadline, stage.deadline) || deadline(deal, old) !== date) && date && date < today() && !hasStageActivity(old || {status:'pending'}))
      errors.push(`Новый срок этапа «${stage.name}» не может быть в прошлом`);
  }
  if (!String(draft.reason || '').trim()) errors.push('Укажите причину изменения условий');
  if (!revisionChanges(deal, termsOf(draft)).length) errors.push('Условия не изменились');
  return [...new Set(errors)];
}

export function proposeRevision(deal, draft) {
  if (deal.pendingRevision) throw new Error('Клиент уже рассматривает предложение. Сначала отзовите его');
  const errors = revisionErrors(deal, draft);
  if (errors.length) throw new Error(errors.join('\n'));
  const existingVersions = deal.versions?.length ? deal.versions : [{number: deal.version, acceptedAt: deal.acceptedAt || null, acceptedBy: deal.client, terms: termsOf(deal)}];
  return {...deal, versions: existingVersions, revisionDraft: null,
    pendingRevision: {id: uid(), number: deal.version + 1, baseVersion: deal.version,
      proposedAt: timestamp(), reason: draft.reason.trim(), terms: termsOf(draft)}};
}

export function acceptRevision(deal, clientId) {
  const proposal = deal.pendingRevision;
  if (!proposal || clientId !== deal.clientId) throw new Error('Предложение недоступно для согласования');
  const draft = {...proposal.terms, status: 'revision', baseVersion: proposal.baseVersion, reason: proposal.reason};
  const errors = revisionErrors(deal, draft);
  if (errors.length) throw new Error(errors.join('\n'));
  const at = timestamp();
  return {...deal, ...clone(proposal.terms), version: proposal.number, status: 'active',
    stages: withRuntime(deal,proposal.terms).stages,
    pendingRevision: null, revisionDraft: null,
    versions: [...(deal.versions || []), {number: proposal.number, acceptedAt: at, acceptedBy: deal.client, terms: clone(proposal.terms)}],
    revisionHistory: [{...proposal, status: 'accepted', resolvedAt: at}, ...(deal.revisionHistory || [])]};
}

export function declineRevision(deal, clientId, comment = '') {
  if (!deal.pendingRevision || clientId !== deal.clientId) throw new Error('Предложение недоступно для отклонения');
  return closeProposal(deal, 'declined', comment);
}

export function withdrawRevision(deal) {
  if (!deal.pendingRevision) throw new Error('Предложение уже закрыто');
  return closeProposal(deal, 'withdrawn', 'Исполнитель отозвал предложение');
}

function closeProposal(deal, status, comment) {
  return {...deal, pendingRevision: null,
    revisionHistory: [{...deal.pendingRevision, status, comment: comment.trim(), resolvedAt: timestamp()}, ...(deal.revisionHistory || [])]};
}

export function revisionChanges(deal, terms) {
  terms = withRuntime(deal, terms);
  const changes = [];
  if (Number(deal.price) !== Number(terms.price)) changes.push(`Стоимость: ${money(deal.price)} → ${money(terms.price)}`);
  if (deal.name !== terms.name) changes.push(`Название: ${deal.name} → ${terms.name}`);
  if (deal.startDate !== terms.startDate) changes.push(`Начало: ${fullDate(deal.startDate)} → ${fullDate(terms.startDate)}`);
  if (deal.endDate !== terms.endDate) changes.push(`Дата события: ${fullDate(deal.endDate)} → ${fullDate(terms.endDate)}`);
  for (const old of deal.stages) {
    const next = terms.stages.find(stage => stage.id === old.id);
    if (!next) changes.push(`Удалён этап «${old.name}»`);
    else if (!same(protectedStageTerms(deal, old), protectedStageTerms(terms, next))) changes.push(`Изменены условия этапа «${old.name}»`);
  }
  for (const stage of terms.stages) if (!deal.stages.some(old => old.id === stage.id)) changes.push(`Добавлен этап «${stage.name}»`);
  if (deal.group !== terms.group) changes.push('Изменён общий проект клиента');
  return changes;
}
