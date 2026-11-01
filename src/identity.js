import {refreshSampleName} from './deal-names.js';
// Keep persisted projects and role IDs intact when refreshing demo identities
const DEMO_NAMES = [
  ["Референсы и пожелания", "Примеры и пожелания"],
  ["Дополнительные референсы", "Примеры оформления"],
  ["Концепция и референсы", "Концепция и примеры"],
  ["сбор референсов", "сбор примеров"],
  ["Елена Морозова", "Алина Игнатова"],
  ["Елены Морозовой", "Алины Игнатовой"],
  ["Анна Смирнова", "Алина Орехова"],
  ["Мария Волкова", "Ольга Шавочкина"],
  ["Ольга Иванова", "Полина Попова"],
  ["Алексей Соколов", "Ольга Шавочкина"],
  ["Дмитрий Орлов", "Полина Попова"],
  ["Свадьба Анны и Михаила", "Свадьба Алины Ореховой"],
  ["Анна согласовала", "Алина согласовала"],
];
function refreshSavedLabels(value) {
  if (!Array.isArray(value?.deals)) return value;
  const seedFiles = new Map([["Зал – демо.jpg", "Зал.jpg"], ["Терраса – демо.jpg", "Терраса.jpg"], ["Вход – демо.jpg", "Вход.jpg"]]);
  return {...value, deals: value.deals.map(deal => ({...refreshSampleName(deal),
    events: deal.events?.map(event => ({...event, text: event.text
      .replace(/^Демо-оплата /, "Оплата ").replace(/^Демо-выплата /, "Выплата ").replace(/ · демо$/, "")
      .replace(/^Исполнитель предложил версию \d+: /, "Исполнитель предложил изменения: ")
      .replace(/^Клиент согласовал версию \d+/, "Клиент согласовал изменения условий")
      .replace(/^Клиент отклонил версию \d+/, "Клиент отклонил изменения условий")
      .replace(/^Исполнитель отозвал предложение версии \d+/, "Исполнитель отозвал предложение изменений")})),
    stages: deal.stages.map(stage => ({...stage, values: Object.fromEntries(Object.entries(stage.values || {}).map(([key, field]) => [key,
      Array.isArray(field) ? field.map(file => file && typeof file === "object" && !file.id && seedFiles.has(file.name) ? {...file, name: seedFiles.get(file.name)} : file) : field
    ]))})),
  }))};
}
export function migrateDemoIdentity(value) {
  if (typeof value === "string") return DEMO_NAMES.reduce((text, [from, to]) => text.replaceAll(from, to), value);
  if (Array.isArray(value)) return value.map(migrateDemoIdentity);
  if (value && typeof value === "object") return refreshSavedLabels(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, migrateDemoIdentity(item)])));
  return value;
}
