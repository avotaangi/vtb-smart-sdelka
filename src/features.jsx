import React,{useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {Bell,Link,Share2,AlertCircle,Clock3,ArrowRight} from 'lucide-react';
import {Modal,Button,Input,Select,TextArea,DynamicField,Attachment,Badge,Card} from './ui.jsx';
import {money,fullDate,today,paidAmount} from './model.js';
import {hasDispute,isReserved,reservedAmount,frozenAmount,openDispute,replyDispute,closeDispute} from './protection.js';
import {invitationTarget} from './participants.js';
import {dealTitle} from './deal-names.js';
export function InviteQR({url,notify}) {
  const [qr,setQR]=useState('');
  useEffect(()=>{let active=true;QRCode.toDataURL(url,{width:220,margin:2,errorCorrectionLevel:'M'}).then(v=>active&&setQR(v));return()=>{active=false}},[url]);
  return <><div className="invite-qr">{qr&&<img src={qr} width="180" height="180" alt="QR-код со ссылкой на сделку"/>}<div><strong>Пригласите заказчика</strong><p>Ссылка открывает условия, этапы и материалы</p></div></div><Button variant="secondary" icon={Share2} onClick={async()=>{try{if(navigator.share)await navigator.share({title:'Смарт-сделка',url});else{await navigator.clipboard.writeText(url);notify('Ссылка скопирована – вставьте её в сообщение')}}catch(e){if(e.name!=='AbortError')notify('Используйте кнопку копирования ссылки')}}}>Поделиться</Button></>;
}
export function JoinDeal({deals,onClose,navigate,switchRole}) {
  const [value,setValue]=useState(''),[error,setError]=useState('');
  function open(){try{const target=invitationTarget(deals,value,location.origin);switchRole('client',target.clientId);navigate(`deal/${target.dealId}`);onClose()}catch(error){setError(error.message)}}
  return <Modal title="Открыть сделку по ссылке" onClose={onClose} footer={<Button icon={ArrowRight} onClick={open}>Посмотреть условия</Button>}><Input label="Ссылка на сделку" value={value} onChange={e=>{setValue(e.target.value);setError('')}} placeholder={`${location.origin}/?role=client#/deal/wedding`}/>{error&&<p role="alert" className="error-box">{error}</p>}<p className="muted">Здесь доступны сделки, сохранённые в этом браузере</p></Modal>;
}
export function Notifications({db,setDb,role,deals,navigate}) {
  const [open,setOpen]=useState(false);
  const events=deals.flatMap(d=>(d.events||[]).map(e=>({...e,deal:d}))).sort((a,b)=>(b.createdAt||b.time).localeCompare(a.createdAt||a.time));
  const read=db.readEvents?.[role]||[];const unread=events.filter(e=>!read.includes(e.id)).length;
  const mark=ids=>setDb(prev=>({...prev,readEvents:{...prev.readEvents,[role]:[...new Set([...(prev.readEvents?.[role]||[]),...ids])]}}));
  return <><button className="notification-button icon-button" aria-label={`Уведомления${unread?` – ${unread} новых`:''}`} onClick={()=>setOpen(true)}><Bell size={21}/>{unread>0&&<span className="notification-count">{unread>9?'9+':unread}</span>}</button>{open&&<Modal title="Уведомления" onClose={()=>setOpen(false)}><div className="button-row"><Button variant="ghost" onClick={()=>mark(events.map(e=>e.id))}>Прочитать все</Button><Badge>{unread} новых</Badge></div><EventFeed events={events} read={read} onOpen={e=>{mark([e.id]);navigate(`deal/${e.deal.id}`);setOpen(false)}}/></Modal>}</>;
}
export function EventFeed({events,read=[],onOpen}) {
  return <div className="event-feed">{!events.length&&<p className="muted">Здесь появятся согласования, результаты и оплаты</p>}{events.slice(0,30).map(e=><button key={e.id} onClick={()=>onOpen(e)} className={read.includes(e.id)?'read':''}><span className="event-icon"><Clock3 size={18}/></span><span><strong>{e.text}</strong><small>{dealTitle(e.deal)} · {fullDate(e.time)}</small></span><ArrowRight size={16}/></button>)}</div>;
}
export function FundsSummary({deal}) {
  const reserved=reservedAmount(deal),frozen=frozenAmount(deal);
  return <Card className="funds-summary"><div><span><strong>Деньги по сделке</strong><small>Резерв, выплаты и предстоящие платежи</small></span></div><dl><div><dt>В резерве</dt><dd>{money(reserved)}</dd></div><div><dt>Из них приостановлено из-за спора</dt><dd>{money(frozen)}</dd></div><div><dt>Ещё не внесено</dt><dd>{money(Math.max(0,Number(deal.price)-reserved-paidAmount(deal)))}</dd></div></dl></Card>;
}
const reasons=['Результат не соответствует условиям','Нарушен срок','Не удалось согласовать доработку'];
export function DisputePanel({deal,stage,role,updateDeal,event,notify,onCancel}) {
  const [reason,setReason]=useState(reasons[0]),[comment,setComment]=useState(''),[files,setFiles]=useState([]),[reply,setReply]=useState(''),[error,setError]=useState('');
  const dispute=stage.dispute,active=hasDispute(stage);
  function act(fn,text){try{const next=fn(deal);updateDeal(deal.id,()=>event(next,`${text} · ${stage.name}`));notify(text);setError('');onCancel?.()}catch(e){setError(e.message)}}
  if(active)return <section className="dispute-panel"><div className="notice warning"><AlertCircle size={22}/><span><strong>Открыт спор по этапу</strong><br/>{isReserved(stage)?'Резерв сохранён – выплата приостановлена':'Оплата и приёмка приостановлены'}</span></div><h3>{dispute.reason}</h3><p className="dispute-comment">{dispute.comment}</p><div className="attachments">{dispute.files?.map(f=><Attachment file={f} key={f.id}/>)}</div><p className="muted">Ответ исполнителя ожидается до {fullDate(dispute.respondBy)}</p>{dispute.reply&&<div className="notice"><span><strong>Ответ исполнителя</strong><br/>{dispute.reply}</span></div>}{role==='executor'?<><TextArea label="Ответ по спору" value={reply} onChange={e=>setReply(e.target.value)}/><Button onClick={()=>act(d=>replyDispute(d,stage.id,reply),'Ответ по спору отправлен')}>Отправить ответ</Button></>:<div className="button-row"><Button variant="secondary" onClick={()=>act(d=>closeDispute(d,stage.id,true),'Спор закрыт – этап возвращён на доработку')}>Вернуть на доработку</Button><Button variant="ghost" onClick={()=>act(d=>closeDispute(d,stage.id),'Спор отозван')}>Отозвать спор</Button></div>}{error&&<p role="alert" className="error-box">{error}</p>}<p className="small muted">Здесь фиксируется решение сторон. Независимое рассмотрение спора пока недоступно</p></section>;
  return <section className="dispute-panel"><h3>Открыть спор</h3><Select label="Причина спора" value={reason} onChange={e=>setReason(e.target.value)}>{reasons.map(r=><option key={r}>{r}</option>)}</Select><TextArea label="Комментарий к спору" required maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Что расходится с условиями и какого решения вы ждёте"/><DynamicField field={{id:'dispute-evidence',label:'Материалы к спору',type:'file',required:false,min:1}} value={files} onChange={setFiles}/>{error&&<p role="alert" className="error-box">{error}</p>}<div className="button-row"><Button onClick={()=>act(d=>openDispute(d,stage.id,{reason,comment,files}),'Спор открыт')}>Отправить спор</Button><Button variant="ghost" onClick={onCancel}>Отмена</Button></div><p className="small muted">Выплата по этапу будет приостановлена до решения сторон</p></section>;
}
