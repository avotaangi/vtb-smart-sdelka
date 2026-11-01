import test from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from '../src/seed.js';
import {dealTitle,renameDeal,refreshSampleName} from '../src/deal-names.js';
import {termsOf,revisionDraft,proposeRevision,acceptRevision} from '../src/revisions.js';
import {draftFromTemplate} from '../src/templates.js';
import {migrateDemoIdentity} from '../src/identity.js';

test('working title leaves accepted terms, money, materials and participants intact',()=>{
 const deal=initialData().deals[0],terms=structuredClone(termsOf(deal));
 const renamed=renameDeal(deal,'  Оформление   свадьбы — зелень и свет  ','elena');
 assert.equal(dealTitle(renamed),'Оформление свадьбы — зелень и свет');
 assert.deepEqual(termsOf(renamed),terms);
 assert.deepEqual(renamed.stages,deal.stages);
 assert.equal(renamed.version,deal.version);
 assert.deepEqual({...renamed,displayName:undefined},{...deal,displayName:undefined});
 assert.throws(()=>renameDeal(deal,'','elena'),/Введите название/);
 assert.throws(()=>renameDeal(deal,'а'.repeat(121),'elena'),/120/);
 assert.throws(()=>renameDeal(deal,'Заказ','other'),/только исполнитель/);
});

test('a custom working title survives agreement to changed terms',()=>{
 const deal=renameDeal(initialData().deals[0],'Свадьба Алины · оформление','elena');
 const draft=revisionDraft(deal);draft.reason='Уточнили результат';draft.stages.at(-1).comment+=' Дополнительный отчёт.';
 const proposed=proposeRevision(deal,draft),accepted=acceptRevision(proposed,deal.clientId);
 assert.equal(dealTitle(accepted),'Свадьба Алины · оформление');
 assert.equal(accepted.stages[1].paid,deal.stages[1].paid);
 assert.equal(accepted.price,deal.price);
});

test('sample updates preserve user titles, changed clients and old agreed snapshots',()=>{
 const deal=initialData().deals[0];deal.name='Оформление свадьбы';
 deal.versions=[{number:1,terms:termsOf(deal)}];deal.events=[{id:'legacy',text:'Клиент согласовал версию 2',time:'2026-11-01'}];
 const original=structuredClone(deal),db=migrateDemoIdentity({deals:[deal]});
 assert.equal(dealTitle(db.deals[0]),'Оформление свадьбы с Алиной Ореховой');
 assert.equal(dealTitle(migrateDemoIdentity({deals:[{...deal,client:'Анна Смирнова'}]}).deals[0]),'Оформление свадьбы с Алиной Ореховой');
 assert.deepEqual(db.deals[0].versions,original.versions);
 assert.equal(db.deals[0].events[0].text,'Клиент согласовал изменения условий');
 assert.equal(dealTitle(refreshSampleName({...deal,displayName:'Моё название'})),'Моё название');
 assert.equal(dealTitle(refreshSampleName({...deal,name:'Особая свадьба'})),'Особая свадьба');
 assert.equal(refreshSampleName({...deal,client:'Ирина'}).displayName,undefined);
 assert.deepEqual(migrateDemoIdentity(db),db);
});

test('a new order does not inherit the previous client working title',()=>{
 const db=initialData(),template=renameDeal(db.deals[0],'Личный заказ Алины','elena');
 const draft=draftFromTemplate(template,db);
 assert.equal(draft.displayName,undefined);
 assert.equal(dealTitle(draft),'Новая сделка');
 assert.notEqual(draft.id,template.id);
});
