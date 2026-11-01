import { uid, today, shiftDays, parseDate } from './model.js';
import { resolveClientId } from './participants.js';

export function shiftProjectDates(deal, changes) {
  const next = {...deal, ...changes};
  if (changes.startDate && deal.startDate && changes.startDate !== deal.startDate) {
    const delta = Math.round((parseDate(changes.startDate) - parseDate(deal.startDate)) / 86400000);
    if (Number.isFinite(delta)) {
      next.stages = deal.stages.map(stage => ({...stage, deadline: stage.deadline.mode === 'date' && stage.deadline.date
        ? {...stage.deadline, date: shiftDays(stage.deadline.date, delta)} : stage.deadline}));
    }
  }
  return next;
}

export function draftFromTemplate(template, db, submission, now = today()) {
  const brief = submission?.briefSnapshot || db.briefs.find(item => item.id === submission?.briefId);
  const dateField = brief?.fields.find(field => field.type === 'date');
  const eventDate = submission?.values?.[dateField?.id];
  const draft = shiftProjectDates(structuredClone(template), {startDate: now});
  return {
    ...draft, id: uid(), name: 'Новая сделка', displayName: undefined,
    client: submission?.client || 'Алина Орехова',
    clientId: resolveClientId(db.deals, submission?.client || 'Алина Орехова'),
    executor: 'Алина Игнатова', executorId: 'elena',
    status: 'draft', version: 1, endDate: eventDate || shiftDays(now, 13),
    briefId: submission?.briefId || db.briefs[0]?.id,
    briefValues: structuredClone(submission?.values || {}),
    briefSnapshot: structuredClone(submission?.briefSnapshot || null),
    events: [], versions: [], revisionDraft: null, pendingRevision: null, revisionHistory: [],
    acceptedAt: undefined, acceptedBy: undefined,
    stages: draft.stages.map(stage => ({
      ...stage, status: 'pending', paid: false, values: {}, note: '',
      funds: undefined, paymentMethod: undefined, paymentBank: undefined,
      completedDate: undefined, dispute: undefined,
    })),
  };
}
