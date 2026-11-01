import React, {useState} from 'react';
import {Modal, Button, TextArea} from './ui.jsx';
import {money, fullDate, deadlineText, paymentAmount, actionTypes, fieldTypes} from './model.js';
import {revisionChanges} from './revisions.js';

export function ContractTerms({terms}) {
  return <>
    <dl className="details-list">
      <div><dt>Стоимость</dt><dd>{money(terms.price)}</dd></div>
      <div><dt>Начало проекта</dt><dd>{fullDate(terms.startDate)}</dd></div>
      <div><dt>Дата события / окончания</dt><dd>{fullDate(terms.endDate)}</dd></div>
      <div><dt>Клиент</dt><dd>{terms.client}</dd></div>
      <div><dt>Исполнитель</dt><dd>{terms.executor}</dd></div>
    </dl>
    <h3>Этапы и условия оплаты</h3>
    {terms.stages.map((stage,index) => <section className="revision-stage" key={stage.id}>
      <h4>{index + 1}. {stage.name}</h4>
      <p>{stage.comment || actionTypes[stage.type]}</p>
      <p className="small muted">Выполняет {stage.owner === 'executor' ? 'исполнитель' : 'клиент'} · {deadlineText(terms,stage)}</p>
      <p className="small">{stage.deps.length ? `Начало после завершения этапов и связанной оплаты: ${stage.deps.map(id => terms.stages.find(item => item.id === id)?.name || id).join('; ')}` : 'Можно начать без ожидания других этапов'}</p>
      {!!stage.fields.length && <p className="small">Материалы: {stage.fields.map(field => `${field.label} (${fieldTypes[field.type]}${field.required ? ', обязательно' : ''}${['photo','file'].includes(field.type) ? `, минимум файлов: ${field.min || 1}` : ''}${['select','multiselect'].includes(field.type) ? `, варианты: ${field.options}` : ''}; заполняет ${field.role === 'executor' ? 'исполнитель' : 'клиент'})`).join('; ')}</p>}
      <p>{stage.payment.mode === 'none' ? 'Без оплаты' : `${money(paymentAmount(terms,stage))} · ${stage.payment.trigger === 'before' ? 'до начала работы' : stage.payment.trigger === 'delivery' ? 'после передачи результата' : 'после приёмки'}`}</p>
    </section>)}
  </>;
}

export function RevisionReview({deal, role, onClose, onAccept, onDecline, onWithdraw}) {
  const [agree,setAgree] = useState(false), [comment,setComment] = useState(''), [error,setError] = useState('');
  const proposal = deal.pendingRevision;
  if (!proposal) return null;
  function act(action) {
    try { action(); onClose(); } catch (e) { setError(e.message); }
  }
  return <Modal wide title="Предложенные изменения условий" onClose={onClose} footer={role === 'client' ?
    <div className="button-row revision-actions"><Button disabled={!agree} onClick={()=>act(onAccept)}>Согласовать изменения</Button><Button variant="secondary" onClick={()=>act(()=>onDecline(comment))}>Отклонить изменения</Button></div> :
    <Button variant="secondary" onClick={()=>act(onWithdraw)}>Отозвать предложение</Button>}>
    <p>Новые условия вступят в силу после согласия клиента. До этого продолжают действовать прежние договорённости.</p>
    <h3>Причина изменений</h3><p className="revision-reason">{proposal.reason}</p>
    <h3>Что изменится</h3>
    <ul className="revision-changes">{revisionChanges(deal,proposal.terms).map(change=><li key={change}>{change}</li>)}</ul>
    <ContractTerms terms={proposal.terms}/>
    {role === 'client' && <>
      <label className="check revision-consent"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>Я принимаю предложенные изменения</label>
      <TextArea label="Комментарий при отклонении" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Необязательно"/>
    </>}
    {error && <p className="error-box" role="alert">{error}</p>}
  </Modal>;
}
