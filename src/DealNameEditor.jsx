import React, {useState} from 'react';
import {Modal, Button, Input} from './ui.jsx';
import {dealTitle} from './deal-names.js';

export function DealNameEditor({deal, onSave, onClose}) {
  const [name, setName] = useState(() => dealTitle(deal));
  const [error, setError] = useState('');
  const formId = `rename-deal-${deal.id}`, errorId = `${formId}-error`;
  function save(event) {
    event.preventDefault();
    try { onSave(name); onClose(); } catch (e) { setError(e.message); }
  }
  return <Modal title="Изменить название сделки" onClose={onClose} footer={<div className="button-row">
    <Button variant="secondary" onClick={onClose}>Отмена</Button>
    <Button type="submit" form={formId}>Сохранить название</Button>
  </div>}>
    <form id={formId} onSubmit={save} noValidate>
      <Input label="Название сделки" value={name} onChange={e=>{setName(e.target.value);setError('')}} maxLength={120} autoFocus required
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        placeholder="Оформление свадьбы с Алиной Ореховой"/>
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
      <p className="muted">Название отображается в списке сделок, календаре и уведомлениях.</p>
    </form>
  </Modal>;
}
