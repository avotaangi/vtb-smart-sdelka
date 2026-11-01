export const KEY = "vtb-smart-deal:prototype:v1";
export const uid = () => crypto.randomUUID();
export const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const today = () => iso(new Date());
export const parseDate = (value) =>
  value ? new Date(`${value}T12:00:00`) : null;
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  Number.isFinite(parseDate(value)?.getTime()) && iso(parseDate(value)) === value;
export const shiftDays = (value, days) => {
  const d = parseDate(value);
  d.setDate(d.getDate() + Number(days));
  return iso(d);
};
export function shiftMonths(value, count) {
  const d = parseDate(value),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(count));
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return iso(d);
}
export const money = (value) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
export const shortDate = (value) =>
  value
    ? parseDate(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : "Без срока";
export const fullDate = (value) =>
  value
    ? parseDate(value).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Без дедлайна";
export const kopecks = (value) => Math.round(Number(value) * 100);
export const paymentKopecks = (deal, stage) =>
  stage.payment.mode === "none"
    ? 0
    : stage.payment.mode === "percent"
      ? Math.round((kopecks(deal.price) * Number(stage.payment.value)) / 100)
      : kopecks(stage.payment.value);
export const paymentAmount = (deal, stage) => paymentKopecks(deal, stage) / 100;
export const paidAmount = (deal) =>
  deal.stages.reduce(
    (sum, s) => sum + (s.paid ? paymentKopecks(deal, s) : 0),
    0,
  ) / 100;
export const isDone = (stage) => stage.status === "accepted" && stage.dispute?.status !== "open";
export const depsReady = (deal, stage) =>
  stage.deps.every((id) =>
    deal.stages.some(
      (s) => s.id === id && isDone(s) && (s.payment.mode === "none" || s.paid || (s.funds === "reserved" && s.payment.trigger === "before")),
    ),
  );
export const isAvailable = (deal, stage) =>
  deal.status === "active" && stage.dispute?.status !== "open" && depsReady(deal, stage);
export const statusLabel = (deal, stage) =>
  stage.dispute?.status === "open" ? "Открыт спор" : stage.funds === "reserved" && stage.status === "accepted" ? "Средства в резерве" : stage.status === "accepted"
    ? stage.payment.mode !== "none" && !stage.paid
      ? "Ожидает оплаты"
      : "Завершён"
    : stage.status === "review"
      ? "На приёмке"
      : isAvailable(deal, stage)
        ? "Можно начать"
        : "Ожидает этап";
export function deadline(deal, stage) {
  const rule = stage.deadline;
  if (rule.mode === "none") return null;
  if (rule.mode === "date") return rule.date || null;
  let anchor =
    rule.anchor === "end"
      ? deal.endDate
      : rule.anchor === "start"
        ? deal.startDate
        : deal.stages.find((s) => s.id === rule.anchor)?.completedDate;
  if (!anchor) return null;
  const count = Number(rule.count) * (rule.direction === "before" ? -1 : 1);
  return rule.unit === "months"
    ? shiftMonths(anchor, count)
    : shiftDays(anchor, count);
}
export function deadlineText(deal, stage) {
  if (stage.deadline.mode === "none") return "Без дедлайна";
  const d = deadline(deal, stage);
  if (d) return fullDate(d);
  const r = stage.deadline;
  const anchor = r.anchor === 'start' ? 'начала проекта' : r.anchor === 'end' ? 'события' :
    `завершения этапа «${deal.stages.find(item => item.id === r.anchor)?.name || 'не выбран'}»`;
  return `${r.direction === "before" ? "За" : "Через"} ${r.count} ${r.unit === "months" ? "мес" : "дн"} ${r.direction === "before" ? "до" : "после"} ${anchor}`;
}
export const fieldTypes = {
  text: "Короткий текст",
  textarea: "Развёрнутый текст",
  number: "Число",
  money: "Сумма",
  date: "Дата",
  select: "Один вариант",
  multiselect: "Несколько вариантов",
  photo: "Фотографии",
  file: "Файлы",
  link: "Ссылка",
};
export const actionTypes = {
  materials: "Материалы",
  work: "Работа",
  approval: "Согласование",
  payment: "Оплата",
};
export const blankField = (role = "client") => ({
  id: uid(),
  label: "Новое поле",
  type: "text",
  required: true,
  role,
  min: 1,
  options: "Вариант 1, Вариант 2",
});
export const blankStage = () => ({
  id: uid(),
  name: "Новый этап",
  type: "work",
  owner: "executor",
  comment: "",
  fields: [],
  deps: [],
  deadline: {
    mode: "none",
    date: "",
    count: 3,
    unit: "days",
    direction: "after",
    anchor: "start",
  },
  payment: { mode: "none", value: 0, trigger: "acceptance" },
  status: "pending",
  paid: false,
  values: {},
  note: "",
});
export function fieldError(field, value) {
  const empty =
    value == null || value === "" || (Array.isArray(value) && !value.length);
  if (empty) return field.required ? "Заполните обязательное поле" : "";
  if (
    ["photo", "file"].includes(field.type) &&
    Array.isArray(value) &&
    value.length < Number(field.min || 1)
  )
    return `Добавьте не менее ${field.min || 1} файлов`;
  if (
    ["money", "number"].includes(field.type) &&
    (!Number.isFinite(Number(value)) || Number(value) < 0)
  )
    return "Введите число не меньше нуля";
  if (field.type === "link") {
    try {
      const u = new URL(value);
      if (!["http:", "https:"].includes(u.protocol))
        return "Используйте ссылку http или https";
    } catch {
      return "Введите полную ссылку, например https://example.ru";
    }
  }
  return "";
}
export const fieldsErrors = (fields, values) =>
  Object.fromEntries(
    fields.map((f) => [f.id, fieldError(f, values[f.id])]).filter(([, e]) => e),
  );
export function validateDeal(deal, {dateFloor = deal.status === 'draft' ? today() : null} = {}) {
  const errors = [];
  if (!deal.name.trim()) errors.push("Укажите название сделки");
  if (!deal.client.trim()) errors.push("Укажите имя клиента");
  if (!Number.isFinite(Number(deal.price)) || kopecks(deal.price) <= 0)
    errors.push("Укажите стоимость больше нуля");
  if (!deal.stages.length) errors.push("Добавьте хотя бы один этап");
  if (deal.startDate && deal.endDate && deal.startDate > deal.endDate)
    errors.push("Окончание проекта должно быть не раньше начала");
  if (deal.startDate && !validDate(deal.startDate)) errors.push('Проверьте дату начала проекта');
  if (deal.endDate && !validDate(deal.endDate)) errors.push('Проверьте дату окончания проекта');
  if (deal.stages.some((s) => !s.name.trim()))
    errors.push("У каждого этапа должно быть название");
  if (deal.stages.some((s) => s.fields.some((f) => !f.label.trim())))
    errors.push("У каждого поля должно быть название");
  if (
    deal.stages.some((s) =>
      s.fields.some(
        (f) =>
          ["select", "multiselect"].includes(f.type) &&
          !f.options?.split(",").some((v) => v.trim()),
      ),
    )
  )
    errors.push("Добавьте варианты ответа в поля с выбором");
  if (
    deal.stages.some((s) =>
      s.fields.some(
        (f) =>
          ["photo", "file"].includes(f.type) &&
          (!Number.isInteger(Number(f.min)) ||
            Number(f.min) < 1 ||
            Number(f.min) > 20),
      ),
    )
  )
    errors.push(
      "Количество обязательных файлов должно быть целым числом от 1 до 20",
    );
  if (
    deal.stages.some(
      (s) =>
        s.payment.mode !== "none" &&
        (!Number.isFinite(Number(s.payment.value)) ||
          Number(s.payment.value) <= 0),
    )
  )
    errors.push("Укажите положительную сумму каждого платежа");
  const total = deal.stages.reduce(
    (sum, s) => sum + paymentKopecks(deal, s),
    0,
  );
  if (total !== kopecks(deal.price))
    errors.push(
      `Сумма платежей ${money(total / 100)} должна совпадать со стоимостью ${money(deal.price)}`,
    );
  const ids = new Set(deal.stages.map((s) => s.id)),
    visited = new Set(),
    path = new Set();
  const cycle = (id) => {
    if (path.has(id)) return true;
    if (visited.has(id)) return false;
    path.add(id);
    const s = deal.stages.find((s) => s.id === id);
    for (const dep of s?.deps || []) if (cycle(dep)) return true;
    path.delete(id);
    visited.add(id);
    return false;
  };
  if (deal.stages.some((s) => s.deps.some((id) => !ids.has(id))))
    errors.push("Удалённый этап остался в зависимостях");
  if (deal.stages.some((s) => cycle(s.id)))
    errors.push("В зависимостях есть цикл – измените условия начала этапов");
  for (const s of deal.stages) {
    const r = s.deadline;
    if (r.mode === "date" && !validDate(r.date))
      errors.push(`Укажите дату этапа «${s.name}»`);
    if (
      r.mode === "relative" &&
      (!Number.isInteger(Number(r.count)) || Number(r.count) < 0)
    )
      errors.push(
        `Укажите целое число дней или месяцев для этапа «${s.name}»`,
      );
    if (r.mode === "relative" && r.anchor === "end" && !deal.endDate)
      errors.push(`Укажите дату окончания проекта для этапа «${s.name}»`);
    if (r.mode === "relative" && r.anchor === "start" && !deal.startDate)
      errors.push(`Укажите дату начала проекта для этапа «${s.name}»`);
    if (r.mode === 'relative' && !['start','end'].includes(r.anchor) && !ids.has(r.anchor))
      errors.push(`Укажите существующий этап для отсчёта срока «${s.name}»`);
    const due = deadline(deal, s);
    if (due && s.status === 'pending') {
      if (deal.startDate && validDate(deal.startDate) && due < deal.startDate)
        errors.push(`Срок этапа «${s.name}» раньше начала проекта`);
      if (dateFloor && due < dateFloor)
        errors.push(`Срок этапа «${s.name}» уже в прошлом — выберите новую дату`);
    }
  }
  return [...new Set(errors)];
}
export function roadmapLevels(deal) {
  const memo = {},
    active = new Set();
  const level = (id) => {
    if (memo[id] != null) return memo[id];
    if (active.has(id)) return 0;
    active.add(id);
    const s = deal.stages.find((s) => s.id === id);
    const n = s?.deps.length ? 1 + Math.max(...s.deps.map(level)) : 0;
    active.delete(id);
    return (memo[id] = n);
  };
  return deal.stages.reduce((all, s) => {
    const l = level(s.id);
    (all[l] ||= []).push(s);
    return all;
  }, []);
}
export const visibleDeals = (deals, role, clientId = 'anna') =>
  deals.filter((d) =>
    role === "executor"
      ? d.executorId === "elena"
      : d.clientId === clientId && d.status !== "draft",
  );
export function settleDeal(deal) {
  return deal.status === "active" &&
    deal.stages.length > 0 &&
    deal.stages.every((s) => isDone(s) && (s.payment.mode === "none" || s.paid))
    ? { ...deal, status: "completed" }
    : deal;
}
