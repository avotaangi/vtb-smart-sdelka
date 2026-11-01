import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  ClipboardList,
  CalendarDays,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  CheckCheck,
  Clock3,
  CircleHelp,
  Search,
  X,
  SlidersHorizontal,
  GitBranch,
  FileText,
  Image,
  Link,
  CreditCard,
  Eye,
  Copy,
  Save,
  Send,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Download,
  RotateCcw,
  Menu,
  Settings2,
  ExternalLink,
  Layers,
  Bell,
  Share2,
} from "lucide-react";
import { initialData } from "./seed.js";
import {dealTitle, renameDeal} from "./deal-names.js";
import {DealNameEditor} from "./DealNameEditor.jsx";
import { migrateDemoIdentity } from "./identity.js";
import {migrateParticipants, clientProfiles, resolveClientId} from './participants.js';
import {draftFromTemplate, shiftProjectDates} from './templates.js';
import {revisionDraft as startRevision, revisionErrors, proposeRevision, acceptRevision, declineRevision, withdrawRevision, acceptInitialTerms, termsOf, hasStageActivity} from './revisions.js';
import {RevisionReview, ContractTerms} from './RevisionReview.jsx';
import {
  KEY,
  uid,
  today,
  iso,
  parseDate,
  shiftDays,
  money,
  shortDate,
  fullDate,
  paymentAmount,
  paymentKopecks,
  paidAmount,
  isDone,
  isAvailable,
  statusLabel,
  deadline,
  deadlineText,
  fieldTypes,
  actionTypes,
  blankField,
  blankStage,
  fieldsErrors,
  validateDeal,
  roadmapLevels,
  visibleDeals,
  settleDeal,
} from "./model.js";
import {
  Button,
  IconButton,
  Badge,
  Avatar,
  Card,
  Empty,
  Modal,
  Input,
  Select,
  TextArea,
  DynamicField,
  FieldEditor,
  Progress,
  SectionTitle,
  Attachment,
} from "./ui.jsx";

import { InviteQR, JoinDeal, Notifications, EventFeed, FundsSummary, DisputePanel } from "./features.jsx";
import { hasDispute, isReserved, reservedAmount, frozenAmount, reserveStage, releaseStage } from "./protection.js";

const Context = createContext();
const useApp = () => useContext(Context);
const clone = (value) => structuredClone(value);
function BankMark() {
  return <svg className="bank-mark" viewBox="0 0 32 28" aria-hidden="true"><path fill="currentColor" d="M6 2h26l-2 6H4zm-3 9h26l-2 6H1zm-3 9h26l-2 6H-2z" /></svg>;
}
const route = () =>
  location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
const dealStatuses = {
  draft: "Черновик",
  sent: "На согласовании",
  active: "В работе",
  completed: "Завершена",
};
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v?.schema === 1 && Array.isArray(v.deals) && Array.isArray(v.briefs))
      return migrateParticipants(migrateDemoIdentity(v));
  } catch {}
  return migrateParticipants(initialData());
}

export default function App() {
  const [db, setDbState] = useState(load),
    [role, setRole] = useState(() =>
      new URLSearchParams(location.search).get("role") === "client"
        ? "client"
        : "executor",
    ),
    [clientId, setClientId] = useState(() => {
      const url = new URL(location.href), deal = db.deals.find(item => item.id === route()[1]);
      return url.searchParams.get('client') || (url.searchParams.get('role') === 'client' && deal?.status !== 'draft' ? deal?.clientId : null) || 'anna';
    }),
    [path, setPath] = useState(route),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [menu, setMenu] = useState(false),
    [link, setLink] = useState(null),
    [joining, setJoining] = useState(false);
  const toastTimer = useRef();
  const dbRef = useRef(db);
  const setDb = (change) => {
    const next = typeof change === 'function' ? change(dbRef.current) : change;
    dbRef.current = next;
    setDbState(next);
  };
  const notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      notify(
        "Не удалось сохранить изменения в браузере – экспортируйте данные из раздела помощи",
      );
    }
  }, [db]);
  useEffect(() => {
    const hash = () => {
      setPath(route());
      setMenu(false);
      window.scrollTo(0, 0);
    };
    const sync = (e) => {
      if (e.key === KEY && e.newValue) {
        try {
          setDb(migrateParticipants(migrateDemoIdentity(JSON.parse(e.newValue))));
        } catch {}
      }
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("storage", sync);
      clearTimeout(toastTimer.current);
    };
  }, []);
  const navigate = (p, { replace = false } = {}) => {
    if (replace) {
      const url = new URL(location.href);
      url.hash = `/${p}`;
      history.replaceState(null, "", url);
      setPath(route());
    } else location.hash = `/${p}`;
    setMenu(false);
  };
  const switchRole = (r, recipient) => {
    setRole(r);
    const url = new URL(location.href);
    url.searchParams.set('role', r);
    if (r === 'client') {
      const deal = dbRef.current.deals.find(item => item.id === path[1] && path[0] === 'deal' && item.status !== 'draft');
      const selected = recipient || deal?.clientId || clientId;
      setClientId(selected);
      url.searchParams.set('client', selected);
    } else url.searchParams.delete('client');
    history.replaceState(null, '', url);
    if (r === 'client' && ['builder', 'briefs'].includes(path[0])) navigate('');
  };
  const updateDeal = (id, fn) => {
    let result;
    setDb(prev => {
      const current = prev.deals.find(item => item.id === id);
      if (!current) throw new Error('Сделка не найдена');
      result = settleDeal(fn(clone(current)));
      return {...prev, deals: prev.deals.map(item => item.id === id ? result : item)};
    });
    return result;
  };
  const event = (d, text) => ({
    ...d,
    events: [{ id: uid(), text, time: today(), createdAt: new Date().toISOString() }, ...(d.events || [])],
  });
  const share = (kind, id, recipient) => {
    const u = new URL(location.href);
    u.searchParams.set("role", "client");
    const targetClient = recipient || dbRef.current.deals.find(item => item.id === id)?.clientId;
    if (kind === 'deal' && targetClient) u.searchParams.set('client', targetClient);
    else u.searchParams.delete('client');
    u.hash = `/${kind}/${id}`;
    setLink({ url: u.href, kind, id, clientId: targetClient });
  };
  const profiles = clientProfiles(db.deals);
  const clientName = profiles.find(profile => profile.id === clientId)?.name || 'Клиент';
  const deals = visibleDeals(db.deals, role, clientId),
    section = path[0] || "home";
  const context = {
    db,
    setDb,
    role,
    setRole: switchRole,
    clientId,
    navigate,
    notify,
    updateDeal,
    event,
    share,
    join: () => setJoining(true),
    deals,
  };
  const nav = [
    ["home", "Обзор", LayoutDashboard],
    ["deals", "Сделки", BriefcaseBusiness],
    ["briefs", "Брифы и шаблоны", ClipboardList],
    ["calendar", "Календарь", CalendarDays],
    ["finance", "Финансы", Wallet],
  ].filter((n) => role === "executor" || n[0] !== "briefs");
  const current =
    nav.find((n) => n[0] === section)?.[1] ||
    (["deal", "builder"].includes(section) ? "Сделки" : "Бриф");
  return (
    <Context.Provider value={context}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        К содержимому
      </a>
      <div className="app-shell" data-section={section}>
        <aside className={`sidebar ${menu ? "open" : ""}`}>
          <button
            className="brand"
            onClick={() => navigate("")}
            aria-label="На главную"
          >
            <span className="brand-bank"><BankMark />ВТБ</span>
            <span className="brand-divider" />
            <span>Смарт-сделка</span>
          </button>
          <div className="workspace-label">Сервисы для самозанятых</div>
          <nav aria-label="Основная навигация">
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                className={`nav-item ${section === id || (id === "deals" && ["deal", "builder"].includes(section)) ? "active" : ""}`}
                onClick={() => navigate(id === "home" ? "" : id)}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
                {id === "deals" && (
                  <span className="nav-count">{deals.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="bank-small">
              <strong>Работа по вашим правилам</strong>
              <p>Условия, результат и оплата – в одной сделке</p>
            </div>
            <button className="nav-item" onClick={() => setHelp(true)}>
              <CircleHelp size={20} aria-hidden="true" />О сервисе
            </button>
            <div className="sidebar-user">
              <Avatar
                name={role === "executor" ? "Алина Игнатова" : clientName}
              />
              <div>
                <strong>
                  {role === "executor" ? "Алина Игнатова" : clientName}
                </strong>
                <span>
                  {role === "executor" ? "Самозанятая" : "Заказчик"}
                </span>
              </div>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
        {menu && (
          <button
            className="menu-scrim"
            onClick={() => setMenu(false)}
            aria-label="Закрыть навигацию"
          />
        )}
        <div className="app-main">
          <header className="topbar">
            <div className="topbar-left">
              <button className="mobile-brand" onClick={() => navigate("")} aria-label="ВТБ Смарт-сделка – на главную">
                <Avatar name={role === "executor" ? "Алина Игнатова" : clientName} /><span><strong>{role === "executor" ? "Алина Игнатова" : clientName}</strong><small>Смарт-сделка</small></span><BankMark />
              </button>
              <IconButton icon={CircleHelp} label="О сервисе" className="mobile-help" onClick={() => setHelp(true)} />
              <IconButton
                icon={Menu}
                label="Открыть навигацию"
                onClick={() => setMenu(!menu)}
                className="mobile-menu"
              />
              <span className="breadcrumb">
                Мой кабинет <ChevronRight size={14} aria-hidden="true" />{" "}
                <strong>{current}</strong>
              </span>
            </div>
            <div className="topbar-right">
              <Notifications db={db} setDb={setDb} role={role} deals={deals} navigate={navigate} />
              <div className="role-switch" aria-label="Роль пользователя">
                <button
                  aria-pressed={role === "executor"}
                  className={role === "executor" ? "selected" : ""}
                  onClick={() => switchRole("executor")}
                >
                  Исполнитель
                </button>
                <button
                  aria-pressed={role === "client"}
                  className={role === "client" ? "selected" : ""}
                  onClick={() => switchRole("client")}
                >
                  Клиент
                </button>
              </div>
            </div>
          </header>
          <main id="main" className="content" tabIndex={-1}>
            {role === 'client' && <div className="demo-client-picker"><Select label="Кабинет клиента" value={clientId} onChange={e=>{switchRole('client',e.target.value);navigate('deals')}}>
              {profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </Select></div>}
            {section === "home" ? (
              <Home />
            ) : section === "deals" ? (
              <Deals />
            ) : section === "deal" ? (
              <DealPage key={path[1]} id={path[1]} stageId={path[2]} />
            ) : section === "builder" ? (
              role === "executor" ? (
                <Builder key={`${path[1] || "new"}/${path[2] || ""}`} id={path[1]} isRevision={path[2] === "revision"} />
              ) : (
                <Empty
                  title="Конструктор доступен исполнителю"
                  description="Переключитесь в роль исполнителя, чтобы настроить сделку"
                />
              )
            ) : section === "briefs" ? (
              <Briefs />
            ) : section === "brief" ? (
              <BriefPage id={path[1]} />
            ) : section === "calendar" ? (
              <Calendar />
            ) : section === "finance" ? (
              <Finance />
            ) : (
              <Empty title="Страница не найдена">
                <Button onClick={() => navigate("")}>На главную</Button>
              </Empty>
            )}
          </main>
          <footer className="page-footer">
            <span>ВТБ Смарт-сделка</span>
            <span>Сервис для самозанятых</span>
          </footer>
          <nav className="mobile-nav" aria-label="Мобильная навигация">
            {nav.map(([id, label, Icon]) => {
              const active = section === id || (id === "deals" && ["deal", "builder"].includes(section)) || (id === "briefs" && section === "brief");
              return <button key={id} aria-current={active ? "page" : undefined} onClick={() => navigate(id === "home" ? "" : id)}>
                <span><Icon size={21} aria-hidden="true" /></span>
                {id === "home" ? "Главная" : id === "briefs" ? "Брифы" : label}
              </button>;
            })}
          </nav>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <IconButton
            icon={X}
            label="Скрыть сообщение"
            onClick={() => setToast("")}
          />
        </div>
      )}
      {joining && <JoinDeal deals={db.deals} onClose={() => setJoining(false)} navigate={navigate} switchRole={switchRole} />}
      {link && (
        <Modal
          title={
            link.kind === "brief"
              ? "Бриф готов для клиента"
              : "Ссылка на сделку"
          }
          onClose={() => setLink(null)}
        >
          <p>Отправьте ссылку клиенту для согласования условий</p>
          <div className="copy-box">
            <input aria-label="Ссылка для клиента" readOnly value={link.url} />
            <IconButton
              icon={Copy}
              label="Скопировать ссылку"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  notify("Ссылка скопирована");
                } catch {
                  notify("Выделите ссылку и скопируйте её вручную");
                }
              }}
            />
          </div>
          <InviteQR url={link.url} notify={notify} />
          <p className="muted small">
            Изменения сделки доступны в этом браузере
          </p>
          <Button
            icon={ArrowRight}
            onClick={() => {
              switchRole("client", link.clientId);
              navigate(`${link.kind}/${link.id}`);
              setLink(null);
            }}
          >
            Открыть как клиент
          </Button>
        </Modal>
      )}
      {help && (
        <Modal title="О сервисе" onClose={() => setHelp(false)}>
          <p>
            Настройте бриф и этапы под свою услугу: съёмку, ведение события,
            декор, торт или свадебный образ. Согласуйте условия с клиентом,
            передайте материалы, примите результат и завершите расчёт
          </p>
          <div className="notice">
            <span>
              Реальные списания, кредитование и отправка данных в ВТБ
              пока недоступны
            </span>
          </div>
          <p>
            Сделки хранятся в браузере, вложения – в локальной базе этого
            браузера. Переключение между исполнителем и клиентом не требует входа
            в учётную запись
          </p>
          <div className="button-row">
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(db, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "vtb-smart-deal.json";
                a.click();
                URL.revokeObjectURL(url);
                notify("Сделки экспортированы, вложения остаются в браузере");
              }}
            >
              Экспорт сделок
            </Button>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={() => {
                if (
                  confirm(
                    "Вернуть начальные сделки? Ваши изменения будут удалены",
                  )
                ) {
                  setDb(migrateParticipants(initialData()));
                  setHelp(false);
                  navigate("");
                  notify("Начальные сделки восстановлены");
                }
              }}
            >
              Восстановить начальные сделки
            </Button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  );
}

function PageHeading({ eyebrow, title, description, children, onRename }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {onRename ? <div className="deal-heading-title"><h1>{title}</h1><Button variant="ghost" className="rename-deal" onClick={onRename}>Изменить название</Button></div> : <h1>{title}</h1>}
        {description && <p className="page-description">{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function DealRow({ deal }) {
  const { role, navigate } = useApp(),
    done = deal.stages.filter(isDone).length;
  return (
    <button
      className="deal-row"
      onClick={() =>
        navigate(
          deal.status === "draft" && role === "executor"
            ? `builder/${deal.id}`
            : `deal/${deal.id}`,
        )
      }
    >
      <span
        className={`project-symbol ${deal.id === "wedding" ? "blue" : deal.id === "brand" ? "sand" : "mint"}`}
      >
        <Layers size={22} aria-hidden="true" />
      </span>
      <span className="deal-row-name">
        <strong>{dealTitle(deal)}</strong>
        <span>{role === "executor" ? deal.client : deal.executor}</span>
        <span className="mobile-deal-status">{dealStatuses[deal.status]} · {done} из {deal.stages.length} этапов</span>
      </span>
      <span className="deal-row-progress">
        <Progress value={(done / deal.stages.length) * 100} />
        <small>
          {done} из {deal.stages.length} этапов
        </small>
      </span>
      <span className="deal-row-price">
        <strong>{money(deal.price)}</strong>
        <span>до {shortDate(deal.endDate)}</span>
      </span>
      <Badge
        tone={
          deal.status === "active"
            ? "blue"
            : deal.status === "completed"
              ? "green"
              : "neutral"
        }
      >
        {dealStatuses[deal.status]}
      </Badge>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
function Home() {
  const { deals, role, navigate, join } = useApp();
  const agreedDeals = deals.filter((d) =>
    ["active", "completed"].includes(d.status),
  );
  const total = agreedDeals.reduce((sum, d) => sum + Number(d.price), 0),
    paid = agreedDeals.reduce((sum, d) => sum + paidAmount(d), 0);
  const tasks = deals
    .flatMap((d) =>
      d.stages
        .filter((s) => !isDone(s) && isAvailable(d, s))
        .map((s) => ({ d, s, date: deadline(d, s) })),
    )
    .sort((a, b) => (a.date || "z").localeCompare(b.date || "z"))
    .slice(0, 3);
  return (
    <div className="home-page">
      <PageHeading
        eyebrow={new Date().toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        })}
        title={
          role === "executor"
            ? "Мои смарт-сделки"
            : "Все проекты под контролем"
        }
        description={
          role === "executor"
            ? "Договорённости, этапы и оплаты – в одном месте"
            : "Следите за работой исполнителей и оплачивайте результат по этапам"
        }
      >
        {role === "executor" && (
          <Button icon={Plus} onClick={() => navigate("builder")}>
            Создать сделку
          </Button>
        )}
      </PageHeading>
      <div className="stats-grid">
        <Stat
          label="Активные сделки"
          value={deals.filter((d) => d.status === "active").length}
          hint={`${deals.length} всего в кабинете`}
          icon={BriefcaseBusiness}
        />
        <Stat
          label={
            role === "executor" ? "Получено по сделкам" : "Оплачено по сделкам"
          }
          value={money(paid)}
          hint="Подтверждено"
          icon={Wallet}
        />
        <Stat
          label={
            role === "executor" ? "Ожидаемые поступления" : "Осталось оплатить"
          }
          value={money(total - paid)}
          hint="По согласованным условиям"
          icon={ArrowUpRight}
        />
        <Stat
          label="Ближайшие действия"
          value={tasks.length}
          hint="Этапы доступны сейчас"
          icon={Clock3}
        />
      </div>
      <div className="bank-quick-actions" aria-label="Быстрые действия">
        {(role === "executor" ? [["builder", Plus, "Новая сделка"], ["briefs", ClipboardList, "Мои брифы"]] : [["deals", BriefcaseBusiness, "Мои сделки"], ["deal/wedding", GitBranch, "Этапы проекта"]]).concat([["calendar", CalendarDays, "Календарь"], ["finance", Wallet, "Все поступления"]]).map(([url, Icon, label]) => <button key={url} onClick={() => navigate(url)}><span><Icon size={24} strokeWidth={1.7} /></span>{label}</button>)}
      </div>
      <div className="join-action"><Button variant="secondary" icon={Link} onClick={join}>Открыть по ссылке</Button></div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">
            <GitBranch size={16} aria-hidden="true" />
            СМАРТ-КОНТРАКТ ДЛЯ ВАШЕЙ РАБОТЫ
          </span>
          <h2>
            От первого брифа
            <br />
            до финального «готово»
          </h2>
          <p>
            Настройте свой бриф, этапы и график оплаты под любую услугу.
            Ведите клиента от согласования условий до готового результата
          </p>
          <Button
            variant="light"
            icon={ArrowRight}
            onClick={() => navigate("deal/wedding")}
          >
            Посмотреть пример сделки
          </Button>
        </div>
        <div
          className="hero-flow"
          aria-label="Пример последовательности сделки"
        >
          <div className="flow-card">
            <div>
              <small>01 · Условия согласованы</small>
              <strong>Бриф и предоплата</strong>
            </div>
          </div>
          <span className="flow-line" />
          <div className="flow-card middle">
            <div>
              <small>02 · Работаем параллельно</small>
              <strong>Концепция и примеры</strong>
            </div>
          </div>
          <span className="flow-line" />
          <div className="flow-card last">
            <div>
              <small>03 · По условиям сделки</small>
              <strong>Приёмка и оплата</strong>
            </div>
            <span className="flow-price">24 000 ₽</span>
          </div>
        </div>
      </section>
      <div className="home-columns">
        <Card className="projects-card">
          <SectionTitle
            title="Мои сделки"
            description="Ближайшие проекты и их готовность"
          >
            <Button
              variant="ghost"
              icon={ArrowUpRight}
              onClick={() => navigate("deals")}
            >
              Все сделки
            </Button>
          </SectionTitle>
          <div className="deal-list">
            {deals.slice(0, 3).map((d) => (
              <DealRow key={d.id} deal={d} />
            ))}
          </div>
        </Card>
        <Card className="tasks-card">
          <SectionTitle
            title="Следующий шаг"
            description="Что можно сделать сейчас"
          />
          {tasks.map(({ d, s, date }) => (
            <button
              key={s.id}
              className="task-item"
              onClick={() => navigate(`deal/${d.id}/${s.id}`)}
            >
              <span className="task-dot" />
              <span>
                <strong>{s.name}</strong>
                <small>{dealTitle(d)}</small>
                <span className="task-date">
                  <Clock3 size={13} />
                  {date ? shortDate(date) : "Без дедлайна"}
                </span>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          {!tasks.length && (
            <p className="muted">Все доступные действия выполнены</p>
          )}
          <Button
            variant="secondary"
            icon={CalendarDays}
            className="full-width"
            onClick={() => navigate("calendar")}
          >
            Открыть календарь
          </Button>
        </Card>
      </div>
      <div className="bottom-note">
        <span>
          Вы задаёте условия – сервис помогает соблюдать договорённости
        </span>
      </div>
    </div>
  );
}
function Stat({ label, value, hint, icon: Icon }) {
  return (
    <Card className="stat">
      <div>
        <span>{label}</span>
        <Icon size={18} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </Card>
  );
}
function Deals() {
  const { deals, role, navigate, join } = useApp();
  const [sort,setSort] = useState("newest");
  const [q, setQ] = useState(""),
    [filter, setFilter] = useState("all");
  const filtered = deals.filter(
    (d) =>
      (filter === "all" || d.status === filter) &&
      `${dealTitle(d)} ${d.client} ${d.executor}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  ).sort((a,b) => sort === "amount" ? Number(b.price)-Number(a.price) : sort === "deadline" ? (a.endDate||"z").localeCompare(b.endDate||"z") : (b.events?.[0]?.createdAt||b.events?.[0]?.time||"").localeCompare(a.events?.[0]?.createdAt||a.events?.[0]?.time||""));
  const events = deals.flatMap(d => (d.events||[]).map(e=>({...e,deal:d}))).sort((a,b)=>(b.createdAt||b.time).localeCompare(a.createdAt||a.time)).slice(0,5);
  return (
    <>
      <PageHeading
        title="Сделки"
        description="У каждого заказа – свои условия, этапы и история"
      >
        {role === "executor" && (
          <Button icon={Plus} onClick={() => navigate("builder")}>
            Создать сделку
          </Button>
        )}
      </PageHeading>
      <div className="toolbar">
        <div className="tabs">
          {[
            ["all", "Все"],
            ["active", "В работе"],
            ["sent", "На согласовании"],
            ["draft", "Черновики"],
            ["completed", "Завершены"],
          ]
            .filter((a) => role === "executor" || a[0] !== "draft")
            .map(([v, t]) => (
              <button
                className={filter === v ? "active" : ""}
                key={v}
                onClick={() => setFilter(v)}
              >
                {t} ({deals.filter(d=>v==="all"||d.status===v).length})
              </button>
            ))}
        </div>
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Поиск сделки"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Название или участник"
          />
        </div>
      </div>
      <div className="deal-sort"><Select label="Порядок сделок" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Сначала последние события</option><option value="deadline">Ближайший срок</option><option value="amount">Сначала большая сумма</option></Select><Button variant="secondary" icon={Link} onClick={join}>По ссылке</Button></div>
      <Card>
        <div className="deal-list">
          {filtered.map((d) => (
            <DealRow key={d.id} deal={d} />
          ))}
          {!filtered.length && (
            <Empty
              title="Сделок пока нет"
              description="Попробуйте изменить поиск или создайте новую сделку"
            />
          )}
        </div>
      </Card>
      <Card className="recent-events"><SectionTitle title="Последние события" /><EventFeed events={events} onOpen={e=>navigate(`deal/${e.deal.id}`)} /></Card>
    </>
  );
}

function Briefs() {
  const { db, setDb, navigate, share, notify } = useApp();
  const [editing, setEditing] = useState(null),
    [error, setError] = useState("");
  function save() {
    if (
      !editing.name.trim() ||
      !editing.fields.length ||
      editing.fields.some((f) => !f.label.trim())
    ) {
      setError("Укажите название брифа и добавьте поля с названиями");
      return;
    }
    setDb((p) => ({
      ...p,
      briefs: p.briefs.some((b) => b.id === editing.id)
        ? p.briefs.map((b) => (b.id === editing.id ? editing : b))
        : [...p.briefs, editing],
    }));
    setEditing(null);
    notify("Бриф сохранён");
  }
  return (
    <>
      <PageHeading
        title="Брифы и шаблоны"
        description="Настройте вопросы один раз и используйте для новых заказов"
      >
        <Button
          icon={Plus}
          onClick={() => {
            setEditing({
              id: uid(),
              name: "Новый бриф",
              description: "",
              fields: [blankField()],
            });
            setError("");
          }}
        >
          Создать бриф
        </Button>
      </PageHeading>
      <div className="brief-grid">
        {db.briefs.map((b) => (
          <Card key={b.id} className="brief-card">
            <span className="project-symbol blue">
              <ClipboardList size={25} />
            </span>
            <Badge>Бриф</Badge>
            <h2>{b.name}</h2>
            <p>{b.description || "Анкета для нового клиента"}</p>
            <div className="brief-meta">
              <span>{b.fields.length} полей</span>
              <span>
                {b.fields.filter((f) => f.required).length} обязательных
              </span>
            </div>
            <div className="button-row">
              <Button
                variant="secondary"
                icon={Settings2}
                onClick={() => {
                  setEditing(clone(b));
                  setError("");
                }}
              >
                Настроить
              </Button>
              <IconButton
                icon={Eye}
                label={`Предпросмотр: ${b.name}`}
                onClick={() => navigate(`brief/${b.id}`)}
              />
              <IconButton
                icon={Send}
                label={`Отправить: ${b.name}`}
                onClick={() => share("brief", b.id)}
              />
            </div>
          </Card>
        ))}
        <button className="template-card" onClick={() => navigate("builder")}>
          <GitBranch size={28} />
          <h2>Сделка по шаблону</h2>
          <p>Настройте этапы, материалы, сроки и платежи под свою услугу</p>
          <span>
            Открыть конструктор <ArrowRight size={17} />
          </span>
        </button>
      </div>
      <Card className="submissions">
        <SectionTitle
          title="Ответы клиентов"
          description="Используйте заполненный бриф для подготовки сделки"
        />
        {db.briefSubmissions.length ? (
          db.briefSubmissions.map((s) => (
            <div key={s.id} className="submission-row">
              <Avatar name={s.client} />
              <div>
                <strong>{s.client}</strong>
                <p>
                  {s.briefName} · {shortDate(s.date)}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate(`builder/new-${s.id}`)}
              >
                Собрать сделку
              </Button>
            </div>
          ))
        ) : (
          <Empty
            title="Здесь появятся заполненные брифы"
            description="Отправьте клиенту ссылку на анкету – ответы сохранятся в этом кабинете"
          />
        )}
      </Card>
      {editing && (
        <Modal
          wide
          title="Настройка брифа"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Отмена
              </Button>
              <Button icon={Save} onClick={save}>
                Сохранить бриф
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <Input
              label="Название брифа"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <TextArea
              label="Описание для клиента"
              value={editing.description}
              onChange={(e) =>
                setEditing({ ...editing, description: e.target.value })
              }
            />
          </div>
          <div className="section-divider" />
          <SectionTitle
            title="Поля анкеты"
            description="Выберите тип ответа и обязательность"
          />
          {editing.fields.map((f, i) => (
            <FieldEditor
              key={f.id}
              field={f}
              onChange={(v) =>
                setEditing({
                  ...editing,
                  fields: editing.fields.map((x, j) => (j === i ? v : x)),
                })
              }
              onDelete={() =>
                setEditing({
                  ...editing,
                  fields: editing.fields.filter((x) => x.id !== f.id),
                })
              }
            />
          ))}
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() =>
              setEditing({
                ...editing,
                fields: [...editing.fields, blankField()],
              })
            }
          >
            Добавить поле
          </Button>
          {error && (
            <div className="error-box" role="alert" tabIndex={-1}>
              {error}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function BriefPage({ id }) {
  const { db, setDb, role, navigate, notify, share } = useApp(),
    b = db.briefs.find((b) => b.id === id);
  const [values, setValues] = useState({}),
    [errors, setErrors] = useState({}),
    [sent, setSent] = useState(false);
  if (!b) return <Empty title="Бриф не найден" />;
  function submit() {
    const e = fieldsErrors(b.fields, values);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`field-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    const nameField = b.fields.find((f) => /имя|name/i.test(f.label));
    setDb((p) => ({
      ...p,
      briefSubmissions: [
        {
          id: uid(),
          briefId: b.id,
          briefName: b.name,
          briefSnapshot: clone(b),
          client: values[nameField?.id] || "Новый клиент",
          values,
          date: today(),
        },
        ...p.briefSubmissions,
      ],
    }));
    setSent(true);
    notify("Бриф передан исполнителю");
  }
  return (
    <>
      <PageHeading
        eyebrow={
          role === "executor"
            ? "Предпросмотр для клиента"
            : "Бриф от Алины Игнатовой"
        }
        title={b.name}
        description={b.description}
      >
        {role === "executor" && (
          <Button icon={Send} onClick={() => share("brief", id)}>
            Отправить клиенту
          </Button>
        )}
      </PageHeading>
      <div className="brief-page">
        <Card className="brief-form">
          {sent ? (
            <Empty
              title="Спасибо, ответы сохранены"
              description="Исполнитель использует их для подготовки условий сделки"
            >
              <Button onClick={() => navigate("")}>В кабинет</Button>
            </Empty>
          ) : (
            <>
              <div className="person-line">
                <Avatar name="Алина Игнатова" />
                <div>
                  <strong>Алина Игнатова</strong>
                  <span>Декор и оформление событий</span>
                </div>
                <Badge tone="blue">Самозанятая</Badge>
              </div>
              <div className="section-divider" />
              {b.fields.map((f) => (
                <DynamicField
                  key={f.id}
                  field={f}
                  value={values[f.id]}
                  error={errors[f.id]}
                  onChange={(v) => {
                    setValues({ ...values, [f.id]: v });
                    setErrors({ ...errors, [f.id]: "" });
                  }}
                />
              ))}
              <Button icon={ArrowRight} onClick={submit}>
                Передать бриф исполнителю
              </Button>
              <p className="small muted">
                Заполнение брифа не означает согласия с ценой – условия сделки вы
                согласуете отдельно
              </p>
            </>
          )}
        </Card>
        <div className="brief-side">
          <span className="large-step">01</span>
          <h2>Начнём с вашей идеи</h2>
          <p>
            Ответы помогут исполнителю предложить подходящий состав работ,
            стоимость и этапы
          </p>
          <div className="notice">
            <span>Вы увидите все условия до начала работы</span>
          </div>
        </div>
      </div>
    </>
  );
}

function BriefAnswers({ brief, values }) {
  return (
    <div className="builder-answers">
      <h3>Ответы клиента</h3>
      {brief?.fields.map((f) => (
        <div className="brief-answer" key={f.id}>
          <span>{f.label}</span>
          {Array.isArray(values[f.id]) ? (
            <div className="attachments">
              {values[f.id].map((v, i) =>
                typeof v === "string" ? (
                  <Badge key={i}>{v}</Badge>
                ) : (
                  <Attachment key={i} file={v} />
                ),
              )}
            </div>
          ) : (
            <strong>{values[f.id] || "Не заполнено"}</strong>
          )}
        </div>
      ))}
    </div>
  );
}

function freshDeal(db, submission) {
  const template = db.deals.find(deal => deal.id === 'wedding') || initialData().deals[0];
  return draftFromTemplate(template, db, submission);
}

function Builder({ id, isRevision = false }) {
  const { db, setDb, navigate, notify, share, updateDeal, event } = useApp();
  const existing = db.deals.find((d) => d.id === id),
    submission = id?.startsWith("new-")
      ? db.briefSubmissions.find((s) => s.id === id.slice(4))
      : null;
  const revisionMode = isRevision && existing?.status === 'active';
  const [draft, setDraft] = useState(() =>
      revisionMode && !existing.pendingRevision ? startRevision(existing) : existing ? clone(existing) : freshDeal(db, submission),
    ),
    [step, setStep] = useState(0),
    [selected, setSelected] = useState(() => existing?.stages[0]?.id || null),
    [stagePicker, setStagePicker] = useState(false),
    [errors, setErrors] = useState([]);
  useEffect(() => {
    if (errors.length) {
      const summary = document.querySelector('.review-summary .error-box');
      summary?.focus();
      summary?.scrollIntoView({block:'center'});
    }
  }, [errors]);
  const stage = draft.stages.find((s) => s.id === selected) || draft.stages[0];
  const total =
    draft.stages.reduce((sum, s) => sum + paymentKopecks(draft, s), 0) / 100;
  const stageLocked = revisionMode && hasStageActivity(existing.stages.find(item => item.id === stage?.id));
  if (isRevision && (!revisionMode || existing.pendingRevision)) return <Empty title="Изменения сейчас недоступны" description="Сначала завершите согласование текущего предложения"><Button onClick={()=>navigate(`deal/${id}`)}>Открыть сделку</Button></Empty>;
  if (existing && existing.status !== "draft" && !revisionMode)
    return (
      <Empty
        title="Условия уже отправлены клиенту"
        description="Согласованные условия доступны на странице сделки"
      >
        <Button onClick={() => navigate(`deal/${id}`)}>Открыть сделку</Button>
      </Empty>
    );
  const updateStage = (v) =>
    setDraft((p) => ({
      ...p,
      stages: p.stages.map((s) => (s.id === v.id ? v : s)),
    }));
  function save(publish = false) {
    if (revisionMode) {
      const issues = publish ? revisionErrors(existing,draft) : [];
      setErrors(issues);
      if (issues.length) {setStep(2);return;}
      try {
        updateDeal(id, current => publish
          ? event(proposeRevision(current,draft), `Исполнитель предложил изменения: ${draft.reason}`)
          : {...current, revisionDraft: clone(draft)});
        notify(publish ? 'Изменения отправлены на согласование — прежние условия продолжают действовать' : 'Черновик изменений сохранён');
        if (publish) {navigate(`deal/${id}`);share('deal',id,existing.clientId);}
        else navigate(`deal/${id}`);
      } catch (error) {setErrors(error.message.split('\n'));setStep(2);}
      return;
    }
    if (publish) {
      const e = validateDeal(draft);
      setErrors(e);
      if (e.length) {
        setStep(2);
        return;
      }
    }
    const saved = {
      ...draft,
      clientId: resolveClientId(db.deals, draft.client),
      briefSnapshot:
        draft.briefSnapshot ||
        clone(db.briefs.find((b) => b.id === draft.briefId) || null),
      status: publish ? "sent" : "draft",
    };
    setDb((p) => ({
      ...p,
      deals: p.deals.some((d) => d.id === saved.id)
        ? p.deals.map((d) => (d.id === saved.id ? saved : d))
        : [saved, ...p.deals],
    }));
    notify(publish ? "Условия готовы для согласования" : "Черновик сохранён");
    if (publish) {
      navigate(`deal/${saved.id}`);
      share("deal", saved.id, saved.clientId);
    } else navigate(`builder/${saved.id}`);
  }
  function removeStage(s) {
    if (revisionMode && hasStageActivity(existing.stages.find(item=>item.id===s.id))) return;
    if (!confirm(`Удалить этап «${s.name}»?`)) return;
    setDraft({
      ...draft,
      stages: draft.stages
        .filter((x) => x.id !== s.id)
        .map((x) => ({
          ...x,
          deps: x.deps.filter((v) => v !== s.id),
          deadline:
            x.deadline.anchor === s.id
              ? { ...x.deadline, anchor: "start" }
              : x.deadline,
        })),
    });
    setSelected(null);
  }
  function moveStage(direction) {
    const index = draft.stages.findIndex((s) => s.id === stage.id),
      to = index + direction;
    if (to < 0 || to >= draft.stages.length) return;
    const stages = [...draft.stages];
    [stages[index], stages[to]] = [stages[to], stages[index]];
    setDraft({ ...draft, stages });
  }
  function addStage() {
    const s = blankStage();
    setDraft({ ...draft, stages: [...draft.stages, s] });
    setSelected(s.id);
    setStagePicker(false);
  }
  function nextStep() {
    setStep(step + 1);
    window.scrollTo(0, 0);
  }
  function goToStep(value) {
    setStep(value);
    window.scrollTo(0, 0);
  }
  const stageMenu = (choose) => draft.stages.map((s, i) => (
    <button key={s.id} className={`stage-nav ${stage?.id === s.id ? "active" : ""}`} aria-pressed={stage?.id === s.id} onClick={() => choose(s.id)}>
      <span>{String(i + 1).padStart(2, "0")}</span>
      <div><strong>{s.name}</strong><small>{actionTypes[s.type]}{s.payment.mode !== "none" ? ` · ${money(paymentAmount(draft, s))}` : ""}</small></div>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  ));
  return (
    <div className="builder-page" data-step={step}>
      <button className="back-link mobile-only" onClick={() => navigate("deals")}><ChevronLeft size={18} aria-hidden="true" />К сделкам</button>
      <PageHeading
        eyebrow="КОНСТРУКТОР СМАРТ-КОНТРАКТА"
        title={revisionMode ? 'Изменение условий' : 'Соберите свои правила работы'}
        description={revisionMode ? 'До согласия клиента продолжают действовать прежние условия' : 'Клиент увидит этапы, сроки и платежи до согласования'}
      >
        <Button variant="secondary" icon={Save} onClick={() => save(false)}>
          Сохранить черновик
        </Button>
        <Button icon={Send} onClick={() => save(true)}>
          Отправить клиенту
        </Button>
      </PageHeading>
      {step > 0 && <h1 className="mobile-builder-title">{step === 1 ? "Этапы и правила" : "Проверьте условия"}</h1>}
      <div className="builder-stepper" aria-label="Шаги настройки сделки">
        {["Условия сделки", "Этапы и правила", "Проверка"].map((name, i) => (
          <button
            key={name}
            aria-current={step === i ? "step" : undefined}
            className={step === i ? "active" : step > i ? "complete" : ""}
            onClick={() => goToStep(i)}
          >
            <span>{step > i ? <Check size={16} /> : i + 1}</span>
            {name}
          </button>
        ))}
      </div>
      {step === 0 ? (
        <div className="builder-basics">
          <Card>
            <SectionTitle
              title="Основные условия"
              description="Что и для кого вы делаете"
            />
            {revisionMode && <TextArea label="Причина изменений" required value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})} placeholder="Что меняется и почему"/>}
            <div className="form-grid">
              <Input
                label="Название сделки"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                label="Имя клиента"
                disabled={revisionMode}
                value={draft.client}
                onChange={(e) => setDraft({ ...draft, client: e.target.value })}
              />
              <Input
                label="Стоимость, ₽"
                type="number"
                min="1"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
              <Input
                label="Общий проект клиента"
                hint="Необязательно"
                value={draft.group || ""}
                onChange={(e) => setDraft({ ...draft, group: e.target.value })}
              />
              <Input
                label="Дата начала"
                type="date"
                value={draft.startDate}
                onChange={(e) =>
                  setDraft(shiftProjectDates(draft, {startDate:e.target.value}))
                }
              />
              <Input
                label="Дата окончания / события"
                type="date"
                value={draft.endDate}
                onChange={(e) =>
                  setDraft({ ...draft, endDate: e.target.value })
                }
              />
            </div>
            <div className="section-divider" />
            <Select
              label="Бриф для этой сделки"
              disabled={revisionMode}
              value={draft.briefId || ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  briefId: e.target.value,
                  briefValues: {},
                  briefSnapshot: null,
                })
              }
            >
              <option value="">Без брифа</option>
              {db.briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            {Object.keys(draft.briefValues || {}).length > 0 && (
              <div className="notice">
                <Check size={20} />
                <span>Ответы клиента из брифа сохранены</span>
              </div>
            )}
            {Object.keys(draft.briefValues || {}).length > 0 && (
              <BriefAnswers
                brief={
                  draft.briefSnapshot ||
                  db.briefs.find((b) => b.id === draft.briefId)
                }
                values={draft.briefValues}
              />
            )}
            <Button icon={ArrowRight} onClick={() => goToStep(1)}>
              Перейти к этапам
            </Button>
          </Card>
          <div className="builder-guide">
            <span className="guide-icon">
              <GitBranch size={28} />
            </span>
            <h2>
              Ваш процесс
              <br />
              Ваши условия
            </h2>
            <p>
              Начните с примера оформления события – переименуйте этапы, выберите
              поля и настройте оплату под свою услугу
            </p>
            <ul>
              <li>Обязательные материалы</li>
              <li>Параллельные работы</li>
              <li>Сроки от даты или события</li>
              <li>Платежи суммой и процентом</li>
            </ul>
          </div>
        </div>
      ) : step === 1 ? (
        <div className="builder-layout">
          <div className="mobile-stage-picker">
            <button aria-label="Выбрать этап" aria-haspopup="dialog" onClick={() => setStagePicker(true)}>
              <span><small>Этап {draft.stages.indexOf(stage) + 1} из {draft.stages.length}</small><strong>{stage?.name || "Добавьте первый этап"}</strong></span>
              <ChevronDown size={21} aria-hidden="true" />
            </button>
            <div><span>Платежи по этапам</span><strong className={Math.round(total * 100) === Math.round(Number(draft.price) * 100) ? "" : "error-text"}>{money(total)} <small>из {money(draft.price)}</small></strong></div>
          </div>
          <Card className="stage-sidebar">
            <SectionTitle title="Этапы сделки" />
            {stageMenu(setSelected)}
            <Button
              variant="secondary"
              icon={Plus}
              className="full-width"
              onClick={addStage}
            >
              Добавить этап
            </Button>
            <div
              className={`payment-total ${Math.round(total * 100) === Math.round(Number(draft.price) * 100) ? "" : "mismatch"}`}
            >
              <span>Платежи по этапам</span>
              <strong>{money(total)}</strong>
              <small>Стоимость сделки {money(draft.price)}</small>
            </div>
          </Card>
          {stage ? (
            <Card className="stage-editor">
              {stageLocked && <p className="notice">Этот этап уже начат, передан, принят или оплачен. Его условия и сумма сохраняются; изменить можно будущие этапы.</p>}
              <fieldset className="stage-settings" disabled={stageLocked}>
              <div className="section-title">
                <div>
                  <p className="eyebrow">НАСТРОЙКА ЭТАПА</p>
                  <h2>{stage.name}</h2>
                </div>
                <div className="button-row">
                  <IconButton
                    icon={ArrowUp}
                    label="Поднять этап"
                    disabled={draft.stages[0]?.id === stage.id}
                    onClick={() => moveStage(-1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label="Опустить этап"
                    disabled={draft.stages.at(-1)?.id === stage.id}
                    onClick={() => moveStage(1)}
                  />
                  <IconButton
                    icon={Trash2}
                    label="Удалить этап"
                    onClick={() => removeStage(stage)}
                  />
                </div>
              </div>
              <div className="form-grid">
                <Input
                  label="Название этапа"
                  value={stage.name}
                  onChange={(e) =>
                    updateStage({ ...stage, name: e.target.value })
                  }
                />
                <Select
                  label="Тип этапа"
                  value={stage.type}
                  onChange={(e) =>
                    updateStage({ ...stage, type: e.target.value })
                  }
                >
                  {Object.entries(actionTypes).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Кто выполняет"
                  value={stage.owner}
                  onChange={(e) =>
                    updateStage({ ...stage, owner: e.target.value })
                  }
                >
                  <option value="executor">Исполнитель</option>
                  <option value="client">Клиент</option>
                </Select>
              </div>
              <TextArea
                label="Комментарий и критерий готовности"
                value={stage.comment}
                onChange={(e) =>
                  updateStage({ ...stage, comment: e.target.value })
                }
              />
              <div className="section-divider" />
              <SectionTitle
                title="Материалы и поля"
                description="Что нужно заполнить для передачи результата"
              />
              {stage.fields.map((f, i) => (
                <FieldEditor
                  key={f.id}
                  field={f}
                  showRole
                  onChange={(v) =>
                    updateStage({
                      ...stage,
                      fields: stage.fields.map((x, j) => (j === i ? v : x)),
                    })
                  }
                  onDelete={() =>
                    updateStage({
                      ...stage,
                      fields: stage.fields.filter((x) => x.id !== f.id),
                    })
                  }
                />
              ))}
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() =>
                  updateStage({
                    ...stage,
                    fields: [...stage.fields, blankField(stage.owner)],
                  })
                }
              >
                Добавить поле
              </Button>
              <div className="section-divider" />
              <SectionTitle
                title="Начало и зависимости"
                description="Без зависимостей этап может идти параллельно другим"
              />
              <div className="dependency-options">
                {draft.stages
                  .filter((s) => s.id !== stage.id)
                  .map((s) => (
                    <label className="check" key={s.id}>
                      <input
                        type="checkbox"
                        checked={stage.deps.includes(s.id)}
                        onChange={(e) =>
                          updateStage({
                            ...stage,
                            deps: e.target.checked
                              ? [...stage.deps, s.id]
                              : stage.deps.filter((id) => id !== s.id),
                          })
                        }
                      />
                      После завершения «{s.name}» и связанной оплаты
                    </label>
                  ))}
              </div>
              <div className="section-divider" />
              <SectionTitle title="Срок выполнения" />
              <div className="form-grid">
                <Select
                  label="Режим срока"
                  value={stage.deadline.mode}
                  onChange={(e) =>
                    updateStage({
                      ...stage,
                      deadline: { ...stage.deadline, mode: e.target.value },
                    })
                  }
                >
                  <option value="none">Без дедлайна</option>
                  <option value="date">Конкретная дата</option>
                  <option value="relative">Относительный срок</option>
                </Select>
                {stage.deadline.mode === "date" && (
                  <Input
                    label="Дата"
                    type="date"
                    value={stage.deadline.date || ""}
                    onChange={(e) =>
                      updateStage({
                        ...stage,
                        deadline: { ...stage.deadline, date: e.target.value },
                      })
                    }
                  />
                )}
              </div>
              {stage.deadline.mode === "relative" && (
                <div className="form-grid">
                  <Input
                    label="Количество"
                    type="number"
                    min="0"
                    value={stage.deadline.count ?? 3}
                    onChange={(e) =>
                      updateStage({
                        ...stage,
                        deadline: {
                          ...stage.deadline,
                          count: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <Select
                    label="Период"
                    value={stage.deadline.unit || "days"}
                    onChange={(e) =>
                      updateStage({
                        ...stage,
                        deadline: { ...stage.deadline, unit: e.target.value },
                      })
                    }
                  >
                    <option value="days">Календарные дни</option>
                    <option value="months">Месяцы</option>
                  </Select>
                  <Select
                    label="Направление"
                    value={stage.deadline.direction || "after"}
                    onChange={(e) =>
                      updateStage({
                        ...stage,
                        deadline: {
                          ...stage.deadline,
                          direction: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="after">После события</option>
                    <option value="before">До события</option>
                  </Select>
                  <Select
                    label="Точка отсчёта"
                    value={stage.deadline.anchor || "start"}
                    onChange={(e) =>
                      updateStage({
                        ...stage,
                        deadline: { ...stage.deadline, anchor: e.target.value },
                      })
                    }
                  >
                    <option value="start">Начало проекта</option>
                    <option value="end">Окончание / событие</option>
                    {draft.stages
                      .filter((s) => s.id !== stage.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Завершение: {s.name}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              <div className="section-divider" />
              <SectionTitle title="Оплата этапа" />
              <div className="form-grid">
                <Select
                  label="Размер оплаты"
                  value={stage.payment.mode}
                  onChange={(e) =>
                    updateStage({
                      ...stage,
                      payment: {
                        ...stage.payment,
                        mode: e.target.value,
                        value:
                          e.target.value === "percent"
                            ? 30
                            : e.target.value === "fixed"
                              ? 10000
                              : 0,
                      },
                    })
                  }
                >
                  <option value="none">Без оплаты</option>
                  <option value="percent">Процент от стоимости</option>
                  <option value="fixed">Фиксированная сумма</option>
                </Select>
                {stage.payment.mode !== "none" && (
                  <>
                    <Input
                      label={
                        stage.payment.mode === "percent"
                          ? "Процент, %"
                          : "Сумма, ₽"
                      }
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={stage.payment.value}
                      onChange={(e) =>
                        updateStage({
                          ...stage,
                          payment: { ...stage.payment, value: e.target.value },
                        })
                      }
                    />
                    <Select
                      label="Когда оплачивать"
                      value={stage.payment.trigger}
                      onChange={(e) =>
                        updateStage({
                          ...stage,
                          payment: {
                            ...stage.payment,
                            trigger: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="before">До начала работы</option>
                      <option value="delivery">
                        После передачи результата
                      </option>
                      <option value="acceptance">После приёмки</option>
                    </Select>
                    <div className="calculated-payment">
                      <span>К оплате по этапу</span>
                      <strong>{money(paymentAmount(draft, stage))}</strong>
                    </div>
                  </>
                )}
              </div>
              </fieldset>
            </Card>
          ) : (
            <Card>
              <Empty
                title="Добавьте первый этап"
                description="Название, поля, срок и оплата настраиваются в карточке этапа"
              />
            </Card>
          )}
        </div>
      ) : (
        <div className="review-layout">
          <Card>
            <SectionTitle
              title={draft.name}
              description={`Клиент: ${draft.client} · ${money(draft.price)}`}
            />
            <div className="notice">
              <Eye size={21} />
              <span>
                Проверьте правила перед отправкой – клиент отдельно согласует
                условия
              </span>
            </div>
            {draft.stages.map((s, i) => (
              <div className="review-stage" key={s.id}>
                <span className="step-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.comment || "Комментарий не указан"}</p>
                  <div className="tag-row">
                    <Badge>{actionTypes[s.type]}</Badge>
                    <span>{deadlineText(draft, s)}</span>
                    <span>{s.fields.length} полей</span>
                  </div>
                  {s.deps.length > 0 && (
                    <p className="small muted">
                      После:{" "}
                      {s.deps
                        .map(
                          (id) => draft.stages.find((x) => x.id === id)?.name,
                        )
                        .join(", ")}
                    </p>
                  )}
                </div>
                <strong>
                  {s.payment.mode === "none"
                    ? "Без оплаты"
                    : money(paymentAmount(draft, s))}
                </strong>
              </div>
            ))}
          </Card>
          <Card className="review-summary">
            <h2>Готовность условий</h2>
            <p>Стоимость сделки</p>
            <strong className="big-number">{money(draft.price)}</strong>
            <div className="summary-line">
              <span>Платежи по этапам</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="summary-line">
              <span>Этапы</span>
              <strong>{draft.stages.length}</strong>
            </div>
            {errors.length > 0 ? (
              <div className="error-box" role="alert" tabIndex={-1}>
                {errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : (
              <p className="small muted">
                Проверим суммы, сроки и зависимости при отправке
              </p>
            )}
            <Button
              icon={Send}
              className="full-width"
              onClick={() => save(true)}
            >
              Отправить клиенту
            </Button>
          </Card>
        </div>
      )}
      <div className="builder-bottom">
        <Button
          variant="ghost"
          icon={ChevronLeft}
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Назад
        </Button>
        {step < 2 && (
          <Button
            variant="secondary"
            icon={ArrowRight}
            onClick={() => setStep(step + 1)}
          >
            Продолжить
          </Button>
        )}
      </div>
      <div className="mobile-builder-actions">
        <Button variant="secondary" icon={Save} onClick={() => save(false)}>Сохранить</Button>
        <Button icon={step < 2 ? ArrowRight : Send} onClick={() => step < 2 ? nextStep() : save(true)}>{step < 2 ? "Далее" : "Отправить клиенту"}</Button>
      </div>
      {stagePicker && <Modal title="Этапы сделки" onClose={() => setStagePicker(false)} footer={<Button icon={Plus} className="full-width" onClick={addStage}>Добавить этап</Button>}>
        <div className="stage-picker-list">{stageMenu((id) => { setSelected(id); setStagePicker(false); })}</div>
      </Modal>}
    </div>
  );
}

function DealPage({ id, stageId }) {
  const { deals, role, clientId, navigate, share, updateDeal, event, notify, db } =
      useApp(),
    deal = deals.find((d) => d.id === id);
  const [tab, setTab] = useState("roadmap"),
    [selected, setSelected] = useState(stageId || null),
    [payment, setPayment] = useState(null),
    [agree, setAgree] = useState(false),
    [reviewRevision, setReviewRevision] = useState(false),
    [viewVersion, setViewVersion] = useState(null),
    [renaming, setRenaming] = useState(false);
  useEffect(() => setSelected(stageId || null), [stageId]);
  function closeStage() {
    setSelected(null);
    if (stageId) navigate(`deal/${id}`, { replace: true });
  }
  if (!deal)
    return (
      <Empty
        title="Сделка недоступна в этой роли"
        description="Переключитесь в другую роль или вернитесь к своим сделкам"
      >
        <Button onClick={() => navigate("deals")}>Мои сделки</Button>
      </Empty>
    );
  const selectedStage = deal.stages.find((s) => s.id === selected),
    done = deal.stages.filter(isDone).length,
    paid = paidAmount(deal),
    brief = deal.briefSnapshot || db.briefs.find((b) => b.id === deal.briefId);
  function acceptContract() {
    if (!agree) return;
    updateDeal(id, (d) =>
      event(
        acceptInitialTerms(d,clientId),
        "Клиент согласовал условия сделки",
      ),
    );
    notify("Условия согласованы – можно работать по этапам");
  }
  const complete = done === deal.stages.length && paid === Number(deal.price);
  return (
    <>
      <button className="back-link" onClick={() => navigate("deals")}>
        <ChevronLeft size={16} />
        Все сделки
      </button>
      <PageHeading
        eyebrow={deal.group || "ПРОЕКТНАЯ УСЛУГА"}
        title={dealTitle(deal)}
        onRename={role === "executor" && deal.executorId === "elena" ? () => setRenaming(true) : undefined}
        description={`${role === "executor" ? "Клиент" : "Исполнитель"}: ${role === "executor" ? deal.client : deal.executor}`}
      >
        {role === "executor" && deal.status === "draft" ? (
          <Button icon={Settings2} onClick={() => navigate(`builder/${id}`)}>
            Продолжить настройку
          </Button>
        ) : (
          role === "executor" && (
            <Button
              variant="secondary"
              icon={Send}
              onClick={() => share("deal", id)}
            >
              Ссылка для клиента
            </Button>
          )
        )}
        {role === 'executor' && deal.status === 'active' && !deal.pendingRevision && <Button variant="secondary" onClick={()=>navigate(`builder/${id}/revision`)}>{deal.revisionDraft ? 'Продолжить изменения' : 'Изменить условия'}</Button>}
        <Badge
          tone={complete ? "green" : deal.status === "sent" ? "orange" : "blue"}
        >
          {complete ? "Завершена" : dealStatuses[deal.status]}
        </Badge>
      </PageHeading>
      {deal.status === "sent" && (
        <Card className="agreement-banner">
          <div className="agreement-content">
            <h2>
              {role === "client"
                ? "Проверьте и согласуйте условия"
                : "Ожидаем согласования клиента"}
            </h2>
            <p>
              Этапы, стоимость, сроки и обязательные материалы доступны ниже – работа начнётся после согласия клиента
            </p>
            {role === "client" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                Я принимаю условия сделки
              </label>
            )}
          </div>
          {role === "client" && (
            <Button disabled={!agree} icon={Check} onClick={acceptContract}>
              Согласовать условия
            </Button>
          )}
        </Card>
      )}
      {deal.pendingRevision && <Card className="revision-banner"><div><h2>Предложены изменения условий</h2><p>До согласия клиента работа и платежи продолжаются по прежним условиям.</p></div><Button variant="secondary" onClick={()=>setReviewRevision(true)}>{role === 'client' ? 'Рассмотреть изменения' : 'Посмотреть изменения'}</Button></Card>}
      <div className="deal-summary">
        <div>
          <span>Стоимость сделки</span>
          <strong>{money(deal.price)}</strong>
        </div>
        <div>
          <span>{role === "executor" ? "Получено" : "Оплачено"}</span>
          <strong>{money(paid)}</strong>
        </div>
        <div>
          <span>Готовность проекта</span>
          <strong>
            {done} <small>из {deal.stages.length} этапов</small>
          </strong>
          <Progress value={(done / deal.stages.length) * 100} />
        </div>
        <div>
          <span>Дата события / окончания</span>
          <strong className="date-value">{fullDate(deal.endDate)}</strong>
        </div>
      </div>
      {deal.status === "active" && <><FundsSummary deal={deal} />{deal.stages.find(s=>isAvailable(deal,s)&&!isDone(s)) && <div className="next-stage"><Button icon={ArrowRight} onClick={()=>setSelected(deal.stages.find(s=>isAvailable(deal,s)&&!isDone(s)).id)}>Следующий этап</Button></div>}</>}
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Представление сделки">
          {[
            ["roadmap", "Дорожная карта", GitBranch],
            ["list", "Список этапов", ClipboardList],
            ["conditions", "Условия и бриф", FileText],
            ["history", "История", Clock3],
          ].map(([id, label, Icon]) => (
            <button
              role="tab"
              aria-selected={tab === id}
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "roadmap" ? (
        <Card className="roadmap-card">
          <SectionTitle
            title="Маршрут проекта"
            description="Нажмите на этап, чтобы увидеть материалы, срок и следующий шаг"
          >
            <span className="parallel-hint">
              <GitBranch size={16} />
              Параллельные этапы – рядом
            </span>
          </SectionTitle>
          <div className="roadmap">
            {roadmapLevels(deal).map((level, i) => (
              <div key={i} className="roadmap-level">
                <div className="roadmap-axis">
                  <span className={level.every(isDone) ? "done" : ""}>
                    {level.every(isDone) ? (
                      <Check size={14} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                </div>
                <div
                  className={`roadmap-branches ${level.length > 1 ? "parallel" : ""}`}
                >
                  {level.length > 1 && <span className="mobile-parallel-label"><GitBranch size={15} aria-hidden="true" />Параллельно · {level.length} этапа</span>}
                  {level.map((s) => (
                    <StageTile
                      key={s.id}
                      deal={deal}
                      stage={s}
                      onClick={() => setSelected(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="roadmap-legend">
            <span>
              <i className="legend-dot green" />
              Завершён
            </span>
            <span>
              <i className="legend-dot blue" />
              Доступен
            </span>
            <span>
              <i className="legend-dot gray" />
              Ожидает предыдущий этап
            </span>
          </div>
        </Card>
      ) : tab === "list" ? (
        <Card className="stage-list">
          {deal.stages.map((s, i) => (
            <button
              className="stage-list-row"
              key={s.id}
              onClick={() => setSelected(s.id)}
            >
              <span
                className={`stage-state ${isDone(s) ? "done" : isAvailable(deal, s) ? "ready" : ""}`}
              >
                {isDone(s) ? <Check size={17} /> : i + 1}
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>{deadlineText(deal, s)}</small>
              </div>
              <Badge
                tone={
                  isDone(s)
                    ? "green"
                    : isAvailable(deal, s)
                      ? "blue"
                      : "neutral"
                }
              >
                {statusLabel(deal, s)}
              </Badge>
              <strong>
                {s.payment.mode === "none"
                  ? "–"
                  : money(paymentAmount(deal, s))}
              </strong>
              <ChevronRight size={18} />
            </button>
          ))}
        </Card>
      ) : tab === "conditions" ? (
        <div className="conditions-layout">
          <Card>
            <SectionTitle
              title="Согласованные условия"
              description={dealStatuses[deal.status]}
            />
            <dl className="details-list">
              <div>
                <dt>Исполнитель</dt>
                <dd>{deal.executor}</dd>
              </div>
              <div>
                <dt>Клиент</dt>
                <dd>{deal.client}</dd>
              </div>
              <div>
                <dt>Стоимость</dt>
                <dd>{money(deal.price)}</dd>
              </div>
              <div>
                <dt>Начало проекта</dt>
                <dd>{fullDate(deal.startDate)}</dd>
              </div>
              <div>
                <dt>Окончание / событие</dt>
                <dd>{fullDate(deal.endDate)}</dd>
              </div>
            </dl>
            {deal.versions?.length > 1 && <><h3>История условий</h3>
            <div className="contract-versions">{deal.versions.map(version=><button key={version.number} type="button" onClick={()=>setViewVersion(version)}>{version.number === deal.version ? 'Действующие условия' : version.acceptedAt ? `Условия от ${new Date(version.acceptedAt).toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'})}` : 'Начальные условия'}</button>)}</div></>}
            <h3>График платежей</h3>
            {deal.stages
              .filter((s) => s.payment.mode !== "none")
              .map((s) => (
                <div className="payment-schedule-row" key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.payment.trigger === "before"
                        ? "До начала работы"
                        : s.payment.trigger === "delivery"
                          ? "После передачи результата"
                          : "После приёмки"}
                      {s.payment.mode === "percent"
                        ? ` · ${s.payment.value}%`
                        : ""}
                    </small>
                  </div>
                  <strong>{money(paymentAmount(deal, s))}</strong>
                  <Badge tone={s.paid ? "green" : "neutral"}>
                    {hasDispute(s) ? "Спор – выплата приостановлена" : isReserved(s) ? "В резерве" : s.paid ? "Выплачено" : "Предстоит"}
                  </Badge>
                </div>
              ))}
            <div className="notice">
              <span>
                После отправки условия зафиксированы. Изменения
                вступают в силу после согласия обеих сторон
              </span>
            </div>
          </Card>
          <Card>
            <SectionTitle
              title="Ответы из брифа"
              description={brief?.name || "Бриф не выбран"}
            />
            {Object.keys(deal.briefValues || {}).length ? (
              brief?.fields.map((f) => (
                <div className="brief-answer" key={f.id}>
                  <span>{f.label}</span>
                  {Array.isArray(deal.briefValues[f.id]) ? (
                    <div className="attachments">
                      {deal.briefValues[f.id].map((v, i) =>
                        typeof v === "string" ? (
                          <Badge key={i}>{v}</Badge>
                        ) : (
                          <Attachment key={i} file={v} />
                        ),
                      )}
                    </div>
                  ) : (
                    <strong>{deal.briefValues[f.id] || "Не заполнено"}</strong>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">
                Ответов пока нет – заполнение брифа доступно по ссылке на анкету
              </p>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <SectionTitle
            title="История сделки"
            description="Согласования, передача результата и оплаты"
          />
          {deal.events?.length ? (
            <div className="history">
              {deal.events.map((e) => (
                <div key={e.id}>
                  <span className="history-dot" />
                  <div>
                    <strong>{e.text}</strong>
                    <small>{fullDate(e.time)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="История начнётся с согласования условий"
              description="Все последующие действия появятся здесь"
            />
          )}
        </Card>
      )}
      {reviewRevision && deal.pendingRevision && <RevisionReview key={deal.pendingRevision.id} deal={deal} role={role} onClose={()=>setReviewRevision(false)}
        onAccept={()=>{updateDeal(id,current=>event(acceptRevision(current,clientId),'Клиент согласовал изменения условий'));notify('Новые условия согласованы и вступили в силу')}}
        onDecline={comment=>{updateDeal(id,current=>event(declineRevision(current,clientId,comment),`Клиент отклонил изменения условий${comment ? `: ${comment}` : ''}`));notify('Изменения отклонены — прежние условия действуют')}}
        onWithdraw={()=>{updateDeal(id,current=>event(withdrawRevision(current),'Исполнитель отозвал предложение изменений'));notify('Предложение отозвано — прежние условия действуют')}}/>}
      {renaming && <DealNameEditor key={deal.id} deal={deal} onClose={()=>setRenaming(false)} onSave={name=>{
        updateDeal(id,current=>{
          const next=renameDeal(current,name,'elena');
          return dealTitle(next) === dealTitle(current) ? current : event(next,`Название сделки изменено на «${dealTitle(next)}»`);
        });
        notify('Название сделки сохранено');
      }}/>}
      {viewVersion && <Modal wide title="Условия сделки" onClose={()=>setViewVersion(null)}><ContractTerms terms={viewVersion.terms}/></Modal>}
      {selectedStage && (
        <StageDrawer
          deal={deal}
          stage={selectedStage}
          onClose={closeStage}
          onPay={() => setPayment(selectedStage.id)}
        />
      )}
      {payment && (
        <PaymentModal
          deal={deal}
          stage={deal.stages.find((s) => s.id === payment)}
          onClose={() => setPayment(null)}
        />
      )}
    </>
  );
}

function StageTile({ deal, stage, onClick }) {
  const done = isDone(stage),
    ready = isAvailable(deal, stage),
    Icon =
      stage.type === "payment"
        ? CreditCard
        : stage.type === "materials"
          ? Image
          : stage.type === "approval"
            ? CheckCheck
            : Layers;
  return (
    <button
      className={`stage-tile ${done ? "done" : ready ? "ready" : "waiting"}`}
      onClick={onClick}
    >
      <div className="stage-tile-top">
        <span
          className={`tile-icon ${done ? "green" : ready ? "blue" : "pale"}`}
        >
          {done ? <Check size={19} /> : <Icon size={19} />}
        </span>
        <Badge
          tone={
            done
              ? "green"
              : stage.status === "review"
                ? "orange"
                : ready
                  ? "blue"
                  : "neutral"
          }
        >
          {statusLabel(deal, stage)}
        </Badge>
      </div>
      <h3>{stage.name}</h3>
      <p className="tile-description">
        {stage.comment || "Откройте этап, чтобы посмотреть условия"}
      </p>
      <div className="tile-meta">
        <span>
          <Clock3 size={14} />
          {deadline(deal, stage)
            ? shortDate(deadline(deal, stage))
            : stage.deadline.mode === "none"
              ? "Без дедлайна"
              : "От события"}
        </span>
        <span>{stage.owner === "client" ? "Клиент" : "Исполнитель"}</span>
      </div>
      <div className="tile-bottom">
        <span>
          {stage.fields.length
            ? `${stage.fields.length} полей · ${stage.fields.filter((f) => f.required).length} обязательных`
            : actionTypes[stage.type]}
        </span>
        <strong>
          {stage.payment.mode === "none" ? (
            <ChevronRight size={17} />
          ) : (
            money(paymentAmount(deal, stage))
          )}
        </strong>
      </div>
      <span className="stage-tooltip" role="tooltip">
        <strong>{stage.name}</strong>
        <span>{stage.comment}</span>
        {stage.fields.length > 0 && (
          <span>
            Прикрепить / заполнить:{" "}
            {stage.fields
              .map((f) => `${f.label}${f.required ? " *" : ""}`)
              .join(", ")}
          </span>
        )}
      </span>
    </button>
  );
}

function StageDrawer({ deal, stage, onClose, onPay }) {
  const { role, updateDeal, event, notify } = useApp();
  const [values, setValues] = useState(() => clone(stage.values || {})),
    [errors, setErrors] = useState({}),
    [note, setNote] = useState(""),
    [returning, setReturning] = useState(false),
    [message, setMessage] = useState(""),
    [disputing,setDisputing] = useState(false);
  function showFieldErrors(nextErrors) {
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors).find((id) => nextErrors[id]);
    if (!firstInvalid) return;
    requestAnimationFrame(() => {
      const input = document.getElementById(`field-${firstInvalid}`);
      input?.closest(".field")?.scrollIntoView({ block: "center" });
      if (input && !input.disabled && input.type !== "file") input.focus({ preventScroll: true });
    });
  }
  const available = isAvailable(deal, stage),
    owner = role === stage.owner,
    reviewer = !owner,
    editable = available && stage.status === "pending",
    amount = paymentAmount(deal, stage),
    paymentDue =
      available &&
      !stage.paid &&
      !isReserved(stage) &&
      stage.payment.mode !== "none" &&
      (stage.type === "payment" ||
        stage.payment.trigger === "before" ||
        (stage.payment.trigger === "delivery" &&
          ["review", "accepted"].includes(stage.status)) ||
        (stage.payment.trigger === "acceptance" &&
          stage.status === "accepted"));
  function save() {
    const ownFields = stage.fields.filter((f) => f.role === role),
      e = fieldsErrors(ownFields, values);
    showFieldErrors(e);
    if (Object.keys(e).length) return;
    updateDeal(deal.id, (d) => ({
      ...d,
      stages: d.stages.map((s) =>
        s.id === stage.id
          ? {
              ...s,
              values: {
                ...s.values,
                ...Object.fromEntries(
                  ownFields.map((f) => [f.id, values[f.id]]),
                ),
              },
            }
          : s,
      ),
    }));
    notify("Материалы сохранены");
  }
  function submit() {
    const e = fieldsErrors(stage.fields, values);
    showFieldErrors(e);
    if (Object.keys(e).length) {
      setMessage(
        "Заполните обязательные поля и дождитесь материалов другой стороны, если её поля ещё пусты",
      );
      return;
    }
    if (
      stage.payment.mode !== "none" &&
      stage.payment.trigger === "before" &&
      !stage.paid && !isReserved(stage)
    ) {
      setMessage("Сначала нужна оплата по условиям этапа");
      return;
    }
    updateDeal(deal.id, (d) =>
      event(
        {
          ...d,
          stages: d.stages.map((s) =>
            s.id === stage.id
              ? { ...s, values, status: "review", note: "" }
              : s,
          ),
        },
        `Результат этапа «${stage.name}» передан на приёмку`,
      ),
    );
    notify("Результат передан на приёмку");
    onClose();
  }
  function accept() {
    updateDeal(deal.id, (d) =>
      event(
        {
          ...d,
          stages: d.stages.map((s) =>
            s.id === stage.id
              ? { ...s, status: "accepted", completedDate: today(), ...(isReserved(s) ? {paid:true,funds:"released"} : {}) }
              : s,
          ),
        },
        `Этап «${stage.name}» принят${isReserved(stage) ? " – резерв перечислен исполнителю" : ""}`,
      ),
    );
    notify(
      stage.payment.mode !== "none" && !stage.paid && !isReserved(stage)
        ? "Результат принят – доступна оплата этапа"
        : "Этап завершён",
    );
    onClose();
  }
  function rework() {
    if (!note.trim()) {
      setMessage("Опишите, что нужно исправить");
      return;
    }
    updateDeal(deal.id, (d) =>
      event(
        {
          ...d,
          stages: d.stages.map((s) =>
            s.id === stage.id
              ? { ...s, status: "pending", note: note.trim() }
              : s,
          ),
        },
        `Этап «${stage.name}» возвращён с замечанием: ${note.trim()}`,
      ),
    );
    notify("Замечания переданы");
    onClose();
  }
  const actions = returning ? (
        <>
          <div className="button-row">
            <Button variant="ghost" onClick={() => setReturning(false)}>
              Отмена
            </Button>
            <Button onClick={rework}>Передать замечания</Button>
          </div>
        </>
      ) : (
        <div className="drawer-actions">
          {editable && stage.fields.some((f) => f.role === role) && (
            <Button variant="secondary" icon={Save} onClick={save}>
              Сохранить материалы
            </Button>
          )}
          {editable && owner && stage.type !== "payment" && (
            <Button
              icon={Send}
              disabled={
                stage.payment.trigger === "before" &&
                stage.payment.mode !== "none" &&
                !stage.paid && !isReserved(stage)
              }
              onClick={submit}
            >
              Передать на приёмку
            </Button>
          )}
          {stage.status === "review" && reviewer && !hasDispute(stage) && (
            <>
              <Button icon={Check} onClick={accept}>
                Принять результат
              </Button>
              <Button variant="secondary" onClick={() => setReturning(true)}>
                Нужны доработки
              </Button>
            </>
          )}
          {paymentDue && role === "client" && (
            <Button icon={CreditCard} onClick={onPay}>
              Оплатить {money(amount)}
            </Button>
          )}
          {role === "client" && available && !stage.paid && !isReserved(stage) && stage.payment.mode !== "none" && !paymentDue && <Button variant="secondary" onClick={onPay}>Зарезервировать {money(amount)}</Button>}
          {role === "client" && isReserved(stage) && stage.status === "accepted" && !hasDispute(stage) && <Button onClick={() => {updateDeal(deal.id,d=>event(releaseStage(d,stage.id),`Выплата по этапу «${stage.name}» подтверждена`));notify("Резерв перечислен исполнителю");onClose()}}>Разрешить выплату {money(amount)}</Button>}
          {role === "client" && available && !stage.paid && stage.type !== "payment" && !disputing && <Button variant="danger" icon={AlertCircle} onClick={()=>setDisputing(true)}>Открыть спор</Button>}
          {paymentDue && role === "executor" && (
            <p className="small muted">
              Клиенту доступен запрос оплаты по этому этапу
            </p>
          )}
        </div>
      );
  return (
    <Modal drawer title={stage.name} onClose={onClose} footer={actions}>
      {(disputing || hasDispute(stage)) && <DisputePanel deal={deal} stage={stage} role={role} updateDeal={updateDeal} event={event} notify={notify} onCancel={()=>setDisputing(false)} />}
      <div className="tag-row">
        <Badge tone={isDone(stage) ? "green" : available ? "blue" : "neutral"}>
          {statusLabel(deal, stage)}
        </Badge>
        <Badge>{actionTypes[stage.type]}</Badge>
      </div>
      <p className="stage-comment">
        {stage.comment || "Описание этапа не указано"}
      </p>
      <dl className="details-list compact">
        <div>
          <dt>Выполняет</dt>
          <dd>{stage.owner === "client" ? deal.client : deal.executor}</dd>
        </div>
        <div>
          <dt>Срок</dt>
          <dd>{deadlineText(deal, stage)}</dd>
        </div>
        {stage.deps.length > 0 && (
          <div>
            <dt>После этапов</dt>
            <dd>
              {stage.deps
                .map((id) => deal.stages.find((s) => s.id === id)?.name)
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>
      {!available && !isDone(stage) && (
        <div className="notice">
          <Clock3 size={20} />
          <span>
            {hasDispute(stage) ? "Этап приостановлен до урегулирования спора" : deal.status === "sent"
              ? "Сначала нужно согласовать условия сделки"
              : "Этап откроется после завершения зависимостей и связанных оплат"}
          </span>
        </div>
      )}
      {stage.note && (
        <div className="notice warning">
          <AlertCircle size={20} />
          <span>
            <strong>Замечания к результату</strong>
            <br />
            {stage.note}
          </span>
        </div>
      )}
      {stage.fields.length > 0 && (
        <>
          <div className="section-divider" />
          <h3>Материалы этапа</h3>
          {stage.fields.map((f) => (
            <div key={f.id}>
              <span className="field-owner">
                Заполняет {f.role === "client" ? "клиент" : "исполнитель"}
              </span>
              <DynamicField
                field={f}
                value={editable ? values[f.id] : stage.values[f.id]}
                error={errors[f.id]}
                disabled={!editable || f.role !== role}
                onChange={(v) => {
                  setValues({ ...values, [f.id]: v });
                  setErrors({ ...errors, [f.id]: "" });
                  setMessage("");
                }}
              />
            </div>
          ))}
        </>
      )}
      {stage.payment.mode !== "none" && (
        <div className="stage-payment">
          <div>
            <span>Оплата по этапу</span>
            <strong>{money(amount)}</strong>
            <small>
              {stage.payment.mode === "percent"
                ? `${stage.payment.value}% от цены сделки · `
                : ""}
              {stage.payment.trigger === "before"
                ? "До начала работы"
                : stage.payment.trigger === "delivery"
                  ? "После передачи результата"
                  : "После приёмки"}
            </small>
          </div>
          <Badge tone={stage.paid ? "green" : "neutral"}>
            {hasDispute(stage) ? "Выплата приостановлена" : isReserved(stage) ? "В резерве" : stage.paid ? "Оплачено" : "Предстоит"}
          </Badge>
        </div>
      )}
      {message && (
        <div className="error-box" role="alert" tabIndex={-1}>
          {message}
        </div>
      )}
      {returning && <TextArea autoFocus label="Что нужно исправить" value={note} onChange={(e) => setNote(e.target.value)} />}
      <p className="small muted">
        Приёмка подтверждает результат – платёж имеет отдельный статус
      </p>
    </Modal>
  );
}

function PaymentModal({ deal, stage, onClose }) {
  const { updateDeal, event, notify, role } = useApp();
  const [protectedPay,setProtectedPay] = useState(stage.payment.trigger === "acceptance" && stage.status !== "accepted"),
    [bank,setBank] = useState("ВТБ");
  const [method, setMethod] = useState("vtb"),
    [busy, setBusy] = useState(false);
  async function pay() {
    if (busy || stage.paid || isReserved(stage) || hasDispute(stage) || !isAvailable(deal,stage) || role !== "client") return;
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    updateDeal(deal.id, (d) => {
      const current = d.stages.find((s) => s.id === stage.id);
      if (current.paid || isReserved(current) || hasDispute(current) || !isAvailable(d,current)) return d;
      if (protectedPay) return event(reserveStage(d,stage.id,method,bank),`Зарезервировано ${money(paymentAmount(d,stage))} по этапу «${stage.name}»`);
      if (current.payment.trigger === "acceptance" && current.status !== "accepted" && current.type !== "payment") return d;
      return event(
        {
          ...d,
          stages: d.stages.map((s) =>
            s.id === stage.id
              ? {
                  ...s,
                  paid: true,
                  funds: "released",
                  paymentMethod: method,
                  paymentBank: bank,
                  status: s.type === "payment" ? "accepted" : s.status,
                  completedDate:
                    s.type === "payment" ? today() : s.completedDate,
                }
              : s,
          ),
        },
        `Оплата ${money(paymentAmount(deal, stage))} по этапу «${stage.name}» подтверждена`,
      );
    });
    notify(protectedPay ? "Резерв создан" : "Оплата подтверждена");
    onClose();
  }
  return (
    <Modal title="Оплата этапа" onClose={busy ? () => {} : onClose} footer={
      <Button icon={Check} className="full-width" disabled={busy || stage.paid} onClick={pay}>
        {busy ? "Подтверждаем…" : stage.paid ? "Уже оплачено" : "Подтвердить оплату"}
      </Button>
    }>
      <div className="pay-amount">
        <span>{stage.name}</span>
        <strong>{money(paymentAmount(deal, stage))}</strong>
        <small>Получатель: {deal.executor}</small>
      </div>
      <label className="check reserve-toggle"><input type="checkbox" disabled={stage.payment.trigger === "acceptance" && stage.status !== "accepted"} checked={protectedPay} onChange={e=>setProtectedPay(e.target.checked)} />Зарезервировать до приёмки</label>
      <div className="payment-methods">
        <label className={method === "vtb" ? "selected" : ""}>
          <input
            type="radio"
            name="payment"
            value="vtb"
            checked={method === "vtb"}
            onChange={() => setMethod("vtb")}
          />
          <CreditCard size={23} />
          <span>
            <strong>Карта ВТБ</strong>
            <small>•••• 4271</small>
          </span>
        </label>
        <label className={method === "sbp" ? "selected" : ""}><input type="radio" name="payment" value="sbp" checked={method === "sbp"} onChange={()=>setMethod("sbp")} /><ArrowUpRight size={23}/><span><strong>СБП из любого банка</strong><small>Выберите банк для оплаты</small></span></label>
        <label className={method === "other" ? "selected" : ""}>
          <input
            type="radio"
            name="payment"
            value="other"
            checked={method === "other"}
            onChange={() => setMethod("other")}
          />
          <Wallet size={23} />
          <span>
            <strong>Карта другого банка</strong>
            <small>Оплата картой любого банка</small>
          </span>
        </label>
      </div>
      {method === "sbp" && <Select label="Банк для оплаты" value={bank} onChange={e=>setBank(e.target.value)}>{["ВТБ","Сбер","Т-Банк","Альфа-Банк","Другой банк"].map(b=><option key={b}>{b}</option>)}</Select>}
      <dl className="details-list compact payment-breakdown"><div><dt>Сумма этапа</dt><dd>{money(paymentAmount(deal,stage))}</dd></div><div><dt>Комиссия</dt><dd>0 ₽</dd></div><div><dt>Итого</dt><dd>{money(paymentAmount(deal,stage))}</dd></div></dl>
      {protectedPay && <div className="notice"><span>Резерв имеет отдельный статус – выплата после приёмки результата или разрешения клиента</span></div>}
      <div className="notice">
        <span>
          Деньги не списываются. Реквизиты вводить не нужно
        </span>
      </div>
    </Modal>
  );
}

function Calendar() {
  const { deals, role, navigate } = useApp();
  const [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [selected, setSelected] = useState(today()),
    [filter, setFilter] = useState("all"),
    [view, setView] = useState("month"),
    [mine, setMine] = useState(false);
  const filtered = deals.filter(
    (d) =>
      d.status === "active" &&
      (filter === "all" || d.id === filter || d.group === filter),
  );
  const entries = filtered.flatMap((d) =>
    d.stages
      .filter(
        (s) =>
          !mine ||
          s.owner === role ||
          (role === "client" && s.payment.mode !== "none" && !s.paid) ||
          (s.status === "review" && s.owner !== role),
      )
      .map((s) => ({ deal: d, stage: s, date: deadline(d, s) })),
  );
  const start = new Date(month.getFullYear(), month.getMonth(), 1),
    offset = (start.getDay() + 6) % 7,
    days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((days + offset) / 7) * 7 },
    (_, i) => {
      const d = new Date(month.getFullYear(), month.getMonth(), i - offset + 1);
      return {
        date: iso(d),
        day: d.getDate(),
        other: d.getMonth() !== month.getMonth(),
      };
    },
  );
  const dayEntries = entries.filter((e) => e.date === selected);
  const groups = [...new Set(deals.map((d) => d.group).filter(Boolean))];
  const monthPrefix = iso(month).slice(0, 7);
  const monthDates = [...new Set(entries.filter((e) => e.date?.startsWith(monthPrefix)).map((e) => e.date))].sort();
  function openStage(d, s) { navigate(`deal/${d.id}/${s.id}`); }
  function agendaItem({ deal: d, stage: s }) {
    return <button key={s.id} className="agenda-item" onClick={() => openStage(d, s)}>
      <Badge tone={isDone(s) ? "green" : "blue"}>{statusLabel(d, s)}</Badge>
      <h3>{s.name}</h3><p>{dealTitle(d)}</p>
      <small>{s.owner === "client" ? "Клиент" : "Исполнитель"} · {role === "client" ? d.executor : d.client}</small>
      {s.payment.mode !== "none" && <strong>{money(paymentAmount(d, s))}</strong>}
      <span className="agenda-link">Открыть этап <ArrowUpRight size={15} aria-hidden="true" /></span>
    </button>;
  }
  return (
    <>
      <PageHeading
        title="Календарь проектов"
        description={
          role === "executor"
            ? "Вся загрузка по заказам – в одном календаре"
            : "Сроки разных подрядчиков – в общем плане"
        }
      >
        <Button
          variant="secondary"
          onClick={() => {
            setMonth(
              new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            );
            setSelected(today());
          }}
        >
          Сегодня
        </Button>
      </PageHeading>
      <div className="calendar-toolbar">
        <Select
          label="Проект или сделка"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все проекты</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {dealTitle(d)}
            </option>
          ))}
        </Select>
        <label className="check">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          Только мои действия
        </label>
      </div>
      <div className="mobile-calendar-switch" aria-label="Вид календаря">
        <button aria-pressed={view === "month"} onClick={() => setView("month")}><CalendarDays size={18} aria-hidden="true" />Месяц</button>
        <button aria-pressed={view === "agenda"} onClick={() => setView("agenda")}><ClipboardList size={18} aria-hidden="true" />Список</button>
      </div>
      <div className="calendar-layout" data-view={view}>
        <Card className="calendar-card">
          <div className="calendar-month">
            <h2>
              {month.toLocaleDateString("ru-RU", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="button-row">
              <IconButton
                icon={ChevronLeft}
                label="Предыдущий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              />
              <IconButton
                icon={ChevronRight}
                label="Следующий месяц"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              />
            </div>
          </div>
          <div className="calendar-grid weekdays">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((c) => {
              const es = entries.filter((e) => e.date === c.date);
              return (
                <button
                  key={c.date}
                  className={`calendar-cell ${c.other ? "other" : ""} ${c.date === today() ? "today" : ""} ${c.date === selected ? "selected" : ""}`}
                  onClick={() => setSelected(c.date)}
                  aria-label={`${fullDate(c.date)}, этапов: ${es.length}`}
                  aria-pressed={c.date === selected}
                >
                  <span className="day-number">{c.day}</span>
                  <div className="calendar-events">
                    {es.slice(0, 2).map(({ deal: d, stage: s }) => (
                      <span
                        key={s.id}
                        className={`calendar-event ${isDone(s) ? "complete" : ""}`}
                        title={`${dealTitle(d)}: ${s.name}`}
                      >
                        {s.name}
                      </span>
                    ))}
                    {es.length > 2 && <small>Ещё {es.length - 2}</small>}
                  </div>
                  {es.length > 0 && (
                    <span className="mobile-event-count">{es.length}</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-upcoming">
            {monthDates.length ? monthDates.map((date) => <section key={date} className="agenda-day">
              <h3 className="agenda-day-title">{parseDate(date).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" })}{date === today() && <span>Сегодня</span>}</h3>
              {entries.filter((e) => e.date === date).map(agendaItem)}
            </section>) : <Empty icon={CalendarDays} title="В этом месяце нет этапов" description="Выберите другой месяц или измените фильтр проекта" />}
          </div>
        </Card>
        <Card className="calendar-agenda">
          <SectionTitle
            title={parseDate(selected).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
            description={`${dayEntries.length} этапов на эту дату`}
          />
          {dayEntries.length ? (
            dayEntries.map(agendaItem)
          ) : (
            <Empty
              icon={CalendarDays}
              title="Свободный день"
              description="На эту дату нет этапов по выбранным фильтрам"
            />
          )}
        </Card>
      </div>
      {entries.some((e) => !e.date) && (
        <Card className="undated">
          <SectionTitle
            title="Без даты"
            description="Этапы без дедлайна или с ещё неизвестной точкой отсчёта"
          />
          {entries
            .filter((e) => !e.date)
            .map(({ deal: d, stage: s }) => (
              <button
                key={s.id}
                className="undated-row"
                onClick={() => openStage(d, s)}
              >
                <span>
                  <strong>{s.name}</strong>
                  <small>{dealTitle(d)}</small>
                </span>
                <span>{deadlineText(d, s)}</span>
                <ChevronRight size={16} />
              </button>
            ))}
        </Card>
      )}
    </>
  );
}

function Finance() {
  const { deals, role, navigate, notify } = useApp();
  const [product, setProduct] = useState(null);
  const agreedDeals = deals.filter((d) =>
    ["active", "completed"].includes(d.status),
  );
  const total = agreedDeals.reduce((sum, d) => sum + Number(d.price), 0),
    paid = agreedDeals.reduce((sum, d) => sum + paidAmount(d), 0);
  const payments = agreedDeals.flatMap((d) =>
    d.stages.filter((s) => s.payment.mode !== "none").map((s) => ({ d, s })),
  );
  return (
    <>
      <PageHeading
        title={
          role === "executor" ? "Профессиональный доход" : "Оплаты по проектам"
        }
        description="Поступления и будущие платежи связаны с этапами сделок"
      />
      <div className="finance-top">
        <div className="income-card">
          <div className="income-card-head">
            <strong>ВТБ</strong>
            <span>ПРОФЕССИОНАЛЬНЫЙ ДОХОД</span>
          </div>
          <p>
            {role === "executor"
              ? "Получено по сделкам"
              : "Оплачено по сделкам"}
          </p>
          <strong className="card-balance">{money(paid)}</strong>
          <div className="income-card-bottom">
            <span>•••• 4271</span>
            <small>Карта ВТБ</small>
          </div>
        </div>
        <Card className="finance-summary">
          <SectionTitle title="План платежей" />
          <div className="summary-line">
            <span>Общая стоимость заказов</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="summary-line">
            <span>
              {role === "executor"
                ? "Подтверждённые поступления"
                : "Подтверждённые оплаты"}
            </span>
            <strong>{money(paid)}</strong>
          </div>
          <div className="summary-line">
            <span>
              {role === "executor"
                ? "Ожидается по договорам"
                : "Предстоит по договорам"}
            </span>
            <strong>{money(total - paid)}</strong>
          </div>
          <p className="small muted">
            Ожидаемые суммы зависят от выполнения этапов и согласованного
            графика платежей
          </p>
        </Card>
      </div>
      <Card className="funds-summary"><div><span><strong>Резерв по всем сделкам</strong><small>Суммы в резерве учитываются отдельно от полученного дохода</small></span></div><dl><div><dt>В резерве</dt><dd>{money(deals.reduce((a,d)=>a+reservedAmount(d),0))}</dd></div><div><dt>Приостановлено из-за споров</dt><dd>{money(deals.reduce((a,d)=>a+frozenAmount(d),0))}</dd></div></dl></Card>
      <Card>
        <SectionTitle
          title="Платежи по этапам"
          description="Откройте сделку для приёмки и оплаты"
        />
        <div className="payment-list">
          {payments.map(({ d, s }) => (
            <button
              className="payment-row"
              key={s.id}
              onClick={() => navigate(`deal/${d.id}/${s.id}`)}
            >
              <span className={`tile-icon ${s.paid ? "green" : "blue"}`}>
                <CreditCard size={19} />
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>{dealTitle(d)}</small>
              </div>
              <span className="payment-row-date">
                {deadline(d, s) ? shortDate(deadline(d, s)) : "По событию"}
              </span>
              <strong>{money(paymentAmount(d, s))}</strong>
              <Badge tone={s.paid ? "green" : "neutral"}>
                {s.paid ? "Оплачено" : "Предстоит"}
              </Badge>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </Card>
      {role === "executor" && (
        <div className="bank-products">
          <Card>
            <span className="project-symbol blue">
              <Wallet size={23} />
            </span>
            <Badge>Развитие сервиса</Badge>
            <h2>Карта для дохода от заказов</h2>
            <p>
              Профессиональные поступления, план дохода и накопление на налог в
              отдельном пространстве
            </p>
            <Button
              variant="secondary"
              icon={ArrowUpRight}
              onClick={() => setProduct("card")}
            >
              Подробнее
            </Button>
          </Card>
          <Card>
            <span className="project-symbol mint">
              <BriefcaseBusiness size={23} />
            </span>
            <Badge>Развитие сервиса</Badge>
            <h2>Финансирование под заказ</h2>
            <p>
              Средства на материалы и оборудование до получения оплаты – решение
              принимает банк
            </p>
            <Button
              variant="secondary"
              icon={ArrowUpRight}
              onClick={() => setProduct("credit")}
            >
              Подробнее
            </Button>
          </Card>
        </div>
      )}
      {product && (
        <Modal
          title={
            product === "card"
              ? "Карта для профессионального дохода"
              : "Финансирование расходов по заказу"
          }
          onClose={() => setProduct(null)}
        >
          <p>
            {product === "card"
              ? "Отдельная дебетовая карта для поступлений по сделкам В приложении можно видеть ожидаемые платежи и откладывать часть собственных средств на налог"
              : "Банк сможет учитывать фактические поступления и согласованные заказы при оценке заявки, а решение и условия определит после проверки"}
          </p>
          <div className="notice">
            <CircleHelp size={21} />
            <span>
              Сервис готовится к запуску. Заявки в банк пока не отправляются
            </span>
          </div>
          <Button
            onClick={() => {
              setProduct(null);
              notify("Спасибо! Ваш интерес отмечен");
            }}
          >
            Мне интересно
          </Button>
        </Modal>
      )}
    </>
  );
}
