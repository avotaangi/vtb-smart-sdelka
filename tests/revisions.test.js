import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from '../src/seed.js';
import {today, shiftDays, deadline, paidAmount, paymentAmount, validateDeal, visibleDeals} from '../src/model.js';
import {migrateParticipants, invitationTarget, resolveClientId} from '../src/participants.js';
import {draftFromTemplate, shiftProjectDates} from '../src/templates.js';
import {revisionDraft, proposeRevision, acceptRevision, declineRevision, withdrawRevision, termsOf, acceptInitialTerms} from '../src/revisions.js';

const database = () => migrateParticipants(initialData());
const sample = () => database().deals[0];
const proposal = deal => {
  const draft=revisionDraft(deal);
  draft.reason='Добавляем оформление входа';
  draft.price=70000;
  draft.stages.find(stage=>stage.id==='w-install').payment.value=31000;
  return draft;
};

test('proposing revised terms keeps the active price, materials, and payments intact',()=>{
  const original=sample(), next=proposeRevision(original,proposal(original));
  assert.deepEqual(termsOf(next),termsOf(original));
  assert.equal(next.price,60000);
  assert.equal(next.version,1);
  assert.equal(next.pendingRevision.terms.price,70000);
  assert.equal(paidAmount(next),18000);
  assert.deepEqual(next.stages[0].values,original.stages[0].values);
  assert.equal(original.pendingRevision,undefined);
});

test('accepting a revision preserves received funds and materials while adopting future work',()=>{
  const original=sample(), next=acceptRevision(proposeRevision(original,proposal(original)),original.clientId);
  assert.equal(next.version,2);
  assert.equal(next.price,70000);
  assert.equal(paidAmount(next),18000);
  assert.equal(next.stages.find(stage=>stage.id==='w-pay').status,'accepted');
  assert.deepEqual(next.stages[0].values,original.stages[0].values);
  assert.deepEqual(next.versions.map(version=>version.terms.price),[60000,70000]);
  assert.equal(next.pendingRevision,null);
  assert.equal(next.revisionHistory[0].status,'accepted');
  assert.throws(()=>acceptRevision(next,original.clientId));
});

test('rejection and withdrawal retain the former conditions and record the outcome',()=>{
  const original=sample(), pending=proposeRevision(original,proposal(original));
  const rejected=declineRevision(pending,original.clientId,'Цена не подходит');
  assert.deepEqual(termsOf(rejected),termsOf(original));
  assert.equal(rejected.revisionHistory[0].comment,'Цена не подходит');
  assert.equal(rejected.pendingRevision,null);
  const withdrawn=withdrawRevision(pending);
  assert.deepEqual(termsOf(withdrawn),termsOf(original));
  assert.equal(withdrawn.revisionHistory[0].status,'withdrawn');
});

test('only the recipient can accept or reject a revision',()=>{
  const original=sample(), pending=proposeRevision(original,proposal(original));
  assert.throws(()=>acceptRevision(pending,'client-brand'));
  assert.throws(()=>declineRevision(pending,'client-brand'));
});

test('a paid stage cannot be removed or repriced through a revision',()=>{
  const original=sample(), removed=proposal(original);
  removed.stages=removed.stages.filter(stage=>stage.id!=='w-pay');
  assert.throws(()=>proposeRevision(original,removed),/уже начат/);
  const changed=proposal(original);
  changed.stages.find(stage=>stage.id==='w-pay').payment.value=19000;
  changed.stages.find(stage=>stage.id==='w-install').payment.value=30000;
  assert.throws(()=>proposeRevision(original,changed),/уже начат/);
});

test('a reserved stage keeps its exact amount and dispute status',()=>{
  const original=sample();
  const stage=original.stages.find(item=>item.id==='w-pay');
  stage.paid=false;stage.funds='reserved';stage.dispute={status:'open',comment:'Уточняем условия'};
  const next=acceptRevision(proposeRevision(original,proposal(original)),original.clientId);
  const preserved=next.stages.find(item=>item.id==='w-pay');
  assert.equal(paymentAmount(next,preserved),18000);
  assert.equal(preserved.funds,'reserved');
  assert.equal(preserved.dispute.status,'open');
});

test('work submitted after the proposal prevents changing that stage at acceptance',()=>{
  const original=sample(), draft=revisionDraft(original);
  draft.reason='Уточняем состав концепции';
  draft.stages.find(stage=>stage.id==='w-concept').comment='Иной состав концепции';
  const pending=proposeRevision(original,draft);
  pending.stages.find(stage=>stage.id==='w-concept').status='review';
  assert.throws(()=>acceptRevision(pending,original.clientId),/уже начат/);
});

test('stale proposals, empty changes and concurrent proposals are rejected',()=>{
  const original=sample(), empty=revisionDraft(original);
  empty.reason='Проверка';
  assert.throws(()=>proposeRevision(original,empty),/не изменились/);
  const pending=proposeRevision(original,proposal(original));
  assert.throws(()=>proposeRevision(pending,proposal(original)),/уже рассматривает/);
  pending.version=2;
  assert.throws(()=>acceptRevision(pending,original.clientId),/Условия сделки изменились/);
});

test('first acceptance keeps the agreed project start date and an immutable terms record',()=>{
  const original=sample();original.status='sent';
  original.startDate=shiftDays(today(),5);
  const next=acceptInitialTerms(original,original.clientId);
  assert.equal(next.startDate,original.startDate);
  assert.equal(next.versions[0].terms.startDate,original.startDate);
  assert.throws(()=>acceptInitialTerms(next,original.clientId));
});

test('legacy clients receive separate cabinets and correct direct invitations',()=>{
  const db=database(), brand=db.deals.find(deal=>deal.id==='brand'), salon=db.deals.find(deal=>deal.id==='salon');
  assert.notEqual(brand.clientId,salon.clientId);
  assert.deepEqual(visibleDeals(db.deals,'client',brand.clientId).map(deal=>deal.id),['brand']);
  assert.deepEqual(invitationTarget(db.deals,'https://demo.test/?role=client#/deal/brand','https://demo.test'),{dealId:'brand',clientId:brand.clientId});
  assert.deepEqual(migrateParticipants(db),db);
  assert.equal(resolveClientId(db.deals,' ОЛЬГА   ШАВОЧКИНА '),brand.clientId);
});

test('links with another origin, wrong recipient or draft do not open a deal',()=>{
  const db=database(), draft={...sample(),id:'draft',status:'draft'};
  db.deals.push(draft);
  assert.throws(()=>invitationTarget(db.deals,'https://other.test/#/deal/brand','https://demo.test'));
  assert.throws(()=>invitationTarget(db.deals,'https://demo.test/?client=anna#/deal/brand','https://demo.test'));
  assert.throws(()=>invitationTarget(db.deals,'https://demo.test/#/deal/draft','https://demo.test'));
  assert.throws(()=>invitationTarget(db.deals,'https://demo.test/#/deal/missing','https://demo.test'),/не найдена в этом браузере/);
});

test('new templates rebase old dates and clear funds, disputes and uploaded results',()=>{
  const db=database(), template=sample();
  template.startDate='2026-01-01';
  template.stages.find(stage=>stage.id==='w-refs').deadline={mode:'date',date:'2026-01-07'};
  template.stages[0].funds='reserved';template.stages[0].dispute={status:'open'};
  template.pendingRevision={id:'old'};template.versions=[{number:2}];
  const next=draftFromTemplate(template,db,null,'2026-11-01');
  assert.equal(next.startDate,'2026-11-01');
  assert.equal(next.stages.find(stage=>stage.id==='w-refs').deadline.date,'2026-11-07');
  assert.equal(next.stages[0].funds,undefined);
  assert.equal(next.stages[0].dispute,undefined);
  assert.deepEqual(next.stages[0].values,{});
  assert.equal(next.stages[0].status,'pending');
  assert.equal(next.pendingRevision,null);
  assert.deepEqual(next.versions,[]);
  assert.equal(paidAmount(next),0);
});

test('moving project start shifts fixed stage dates without changing relative rules',()=>{
  const original=sample(), next=shiftProjectDates(original,{startDate:shiftDays(original.startDate,10)});
  const old=original.stages.find(stage=>stage.id==='w-refs');
  assert.equal(next.stages.find(stage=>stage.id==='w-refs').deadline.date,shiftDays(old.deadline.date,10));
  assert.deepEqual(next.stages.find(stage=>stage.id==='w-plan').deadline,original.stages.find(stage=>stage.id==='w-plan').deadline);
});

test('past dates, impossible dates and deadlines before the project block publishing',()=>{
  const db=database(), draft=draftFromTemplate(sample(),db);
  draft.stages.find(stage=>stage.id==='w-refs').deadline={mode:'date',date:shiftDays(today(),-1)};
  assert.match(validateDeal(draft).join(' '),/раньше начала|прошлом/);
  draft.stages.find(stage=>stage.id==='w-refs').deadline.date='2026-02-30';
  assert.match(validateDeal(draft).join(' '),/Укажите дату/);
});

test('the event date supplied in a brief is kept and invalid chronology is shown',()=>{
  const db=database(), brief=db.briefs[0];
  const submission={client:'Новый заказчик',briefId:brief.id,briefSnapshot:brief,values:{'b-date':shiftDays(today(),-1)}};
  const draft=draftFromTemplate(sample(),db,submission);
  assert.equal(draft.endDate,submission.values['b-date']);
  assert.match(validateDeal(draft).join(' '),/Окончание проекта/);
  assert.notEqual(draft.clientId,'anna');
});
