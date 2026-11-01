import { today, shiftDays, paymentAmount, isAvailable } from './model.js';
export const hasDispute = s => s.dispute?.status === 'open';
export const isReserved = s => s.funds === 'reserved' && !s.paid;
export const reservedAmount = d => d.stages.reduce((sum,s) => sum + (isReserved(s) ? paymentAmount(d,s) : 0),0);
export const frozenAmount = d => d.stages.reduce((sum,s) => sum + (isReserved(s) && hasDispute(s) ? paymentAmount(d,s) : 0),0);
export function reserveStage(deal,id,method='sbp',bank='ВТБ') {
  const stage=deal.stages.find(s=>s.id===id);
  if (!stage || !isAvailable(deal,stage) || stage.paid || isReserved(stage) || stage.payment.mode==='none') throw new Error('Резервирование сейчас недоступно');
  return {...deal,stages:deal.stages.map(s=>s.id===id?{...s,funds:'reserved',paymentMethod:method,paymentBank:bank,...(s.type==='payment'?{status:'accepted',completedDate:today()}: {})}:s)};
}
export function releaseStage(deal,id) {
  const stage=deal.stages.find(s=>s.id===id);
  if (!stage || hasDispute(stage) || stage.status!=='accepted' || !isReserved(stage)) throw new Error('Сначала завершите приёмку и урегулируйте спор');
  return {...deal,stages:deal.stages.map(s=>s.id===id?{...s,funds:'released',paid:true}:s)};
}
export function openDispute(deal,id,{reason,comment,files=[]}) {
  const stage=deal.stages.find(s=>s.id===id);
  if (!stage || deal.status!=='active' || !isAvailable(deal,stage) || stage.paid || hasDispute(stage) || !reason || !comment.trim()) throw new Error('Укажите причину и комментарий к доступному неоплаченному этапу');
  return {...deal,stages:deal.stages.map(s=>s.id===id?{...s,dispute:{status:'open',reason,comment:comment.trim(),files,opened:today(),respondBy:shiftDays(today(),3),reply:'',previousStatus:s.status}}:s)};
}
export function replyDispute(deal,id,reply) {
  if (!reply.trim()) throw new Error('Опишите ваше решение');
  if (!hasDispute(deal.stages.find(s=>s.id===id)||{})) throw new Error('Спор уже закрыт');
  return {...deal,stages:deal.stages.map(s=>s.id===id?{...s,dispute:{...s.dispute,reply:reply.trim(),replied:today()}}:s)};
}
export function closeDispute(deal,id,rework=false) {
  const stage=deal.stages.find(s=>s.id===id);
  if (!stage || !hasDispute(stage)) throw new Error('Спор уже закрыт');
  return {...deal,stages:deal.stages.map(s=>s.id===id?{...s,status:rework?'pending':s.dispute.previousStatus,completedDate:rework?undefined:s.completedDate,note:rework?s.dispute.comment:s.note,dispute:{...s.dispute,status:'closed',resolution:rework?'rework':'withdrawn',closed:today()}}:s)};
}
