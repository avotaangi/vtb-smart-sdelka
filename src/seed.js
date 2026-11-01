import { blankStage, shiftDays, today } from "./model.js";
const field = (
  id,
  label,
  type = "text",
  role = "client",
  required = true,
  min = 1,
) => ({
  id,
  label,
  type,
  role,
  required,
  min,
  options: "Минимализм, Классика, Ботанический",
});
const stage = (id, name, settings = {}) => ({
  ...blankStage(),
  id,
  name,
  ...settings,
});
export function initialData() {
  const now = today(),
    end = shiftDays(now, 13);
  const wedding = {
    id: "wedding",
    name: "Оформление свадьбы с Алиной Ореховой",
    group: "Свадьба Алины Ореховой",
    client: "Алина Орехова",
    clientId: "anna",
    executor: "Алина Игнатова",
    executorId: "elena",
    category: "Декор и события",
    price: 60000,
    startDate: shiftDays(now, -3),
    endDate: end,
    status: "active",
    version: 1,
    briefId: "decor",
    briefValues: {
      "b-name": "Алина Орехова",
      "b-date": end,
      "b-style": "Ботанический",
      "b-budget": "60000",
      "b-comment":
        "Камерная свадьба на 40 гостей с зеленью, белыми цветами и тёплым светом",
    },
    events: [
      {
        id: "e1",
        text: "Алина согласовала условия сделки",
        time: shiftDays(now, -3),
      },
      {
        id: "e2",
        text: "Предоплата 18 000 ₽ подтверждена",
        time: shiftDays(now, -2),
      },
    ],
    stages: [
      stage("w-materials", "Материалы площадки", {
        type: "materials",
        owner: "client",
        comment:
          "Пришлите фотографии зала и расскажите, где будут церемония и ужин",
        fields: [
          field("m-comment", "Комментарий о площадке", "textarea"),
          field("m-photo", "Фотографии площадки", "photo", "client", true, 3),
        ],
        status: "accepted",
        completedDate: shiftDays(now, -3),
        values: {
          "m-comment": "Церемония у панорамных окон, ужин в основном зале",
          "m-photo": [
            { name: "Зал.jpg" },
            { name: "Терраса.jpg" },
            { name: "Вход.jpg" },
          ],
        },
      }),
      stage("w-pay", "Предоплата", {
        type: "payment",
        owner: "client",
        comment:
          "После оплаты начинаем подготовку концепции и сбор примеров",
        deps: ["w-materials"],
        payment: { mode: "percent", value: 30, trigger: "before" },
        status: "accepted",
        paid: true,
        completedDate: shiftDays(now, -2),
      }),
      stage("w-concept", "Концепция оформления", {
        comment:
          "Подготовлю палитру, эскиз зоны церемонии и список материалов – включены две итерации правок",
        deps: ["w-pay"],
        fields: [
          field("c-link", "Ссылка на концепцию", "link", "executor"),
          field(
            "c-note",
            "Комментарий к концепции",
            "textarea",
            "executor",
            false,
          ),
        ],
        deadline: {
          mode: "relative",
          count: 5,
          unit: "days",
          direction: "after",
          anchor: "w-pay",
        },
      }),
      stage("w-refs", "Примеры и пожелания", {
        type: "materials",
        owner: "client",
        comment:
          "Выберите, что нравится в примерах, и опишите детали, которые важно учесть",
        deps: ["w-pay"],
        fields: [
          field("r-comment", "Ваши пожелания", "textarea"),
          field(
            "r-photo",
            "Примеры оформления",
            "photo",
            "client",
            false,
          ),
        ],
        deadline: { mode: "date", date: shiftDays(now, 3) },
      }),
      stage("w-plan", "Согласование деталей", {
        type: "approval",
        comment:
          "Зафиксируем финальную композицию, материалы и схему расстановки",
        deps: ["w-concept", "w-refs"],
        fields: [field("p-link", "Финальная схема", "link", "executor")],
        deadline: {
          mode: "relative",
          count: 5,
          unit: "days",
          direction: "before",
          anchor: "end",
        },
      }),
      stage("w-install", "Монтаж и приёмка", {
        comment:
          "Оформим площадку и передадим фотографии готовых зон на приёмку",
        deps: ["w-plan"],
        fields: [
          field("i-note", "Комментарий о готовности", "textarea", "executor"),
          field(
            "i-photo",
            "Фото готового оформления",
            "photo",
            "executor",
            true,
            2,
          ),
        ],
        deadline: {
          mode: "relative",
          count: 2,
          unit: "days",
          direction: "before",
          anchor: "end",
        },
        payment: { mode: "fixed", value: 24000, trigger: "acceptance" },
      }),
      stage("w-report", "Фотоотчёт и расчёт", {
        comment: "Передам фотоотчёт по оформлению и закроем проект",
        deps: ["w-install"],
        fields: [field("f-link", "Ссылка на фотоотчёт", "link", "executor")],
        deadline: {
          mode: "relative",
          count: 3,
          unit: "days",
          direction: "after",
          anchor: "end",
        },
        payment: { mode: "percent", value: 30, trigger: "acceptance" },
      }),
    ],
  };
  const simple = (
    id,
    name,
    client,
    executor,
    executorId,
    price,
    offset,
    group = "",
  ) => ({
    id,
    name,
    client,
    clientId: client === "Алина Орехова" ? "anna" : "other",
    executor,
    executorId,
    group,
    category: "Услуги",
    price,
    startDate: now,
    endDate: shiftDays(now, offset + 5),
    status: "active",
    version: 1,
    briefValues: {},
    events: [],
    stages: [
      stage(`${id}-s1`, "Подготовка и согласование", {
        comment: "Согласуем детали и подготовим результат",
        fields: [
          field(
            `${id}-comment`,
            "Комментарий к результату",
            "textarea",
            "executor",
          ),
        ],
        deadline: { mode: "date", date: shiftDays(now, offset) },
        payment: { mode: "percent", value: 50, trigger: "acceptance" },
      }),
      stage(`${id}-s2`, "Передача результата", {
        comment: "Передадим готовые материалы и завершим заказ",
        deps: [`${id}-s1`],
        fields: [
          field(`${id}-link`, "Ссылка на результат", "link", "executor"),
        ],
        deadline: { mode: "date", date: shiftDays(now, offset + 5) },
        payment: { mode: "percent", value: 50, trigger: "acceptance" },
      }),
    ],
  });
  return {
    schema: 1,
    deals: [
      wedding,
      simple(
        "brand",
        "Оформление витрины с Ольгой Шавочкиной",
        "Ольга Шавочкина",
        "Алина Игнатова",
        "elena",
        35000,
        2,
      ),
      simple(
        "salon",
        "Декор открытия студии с Полиной Поповой",
        "Полина Попова",
        "Алина Игнатова",
        "elena",
        45000,
        6,
      ),
      simple(
        "photo",
        "Свадебная фотосъёмка с Алиной Ореховой",
        "Алина Орехова",
        "Ольга Шавочкина",
        "alex",
        50000,
        13,
        "Свадьба Алины Ореховой",
      ),
      simple(
        "host",
        "Ведение свадьбы с Алиной Ореховой",
        "Алина Орехова",
        "Полина Попова",
        "dmitry",
        30000,
        8,
        "Свадьба Алины Ореховой",
      ),
    ],
    briefs: [
      {
        id: "decor",
        name: "Оформление события",
        description:
          "Расскажите о событии, чтобы я предложила состав работ и этапы",
        fields: [
          field("b-name", "Ваше имя"),
          field("b-date", "Дата события", "date"),
          field("b-style", "Стиль оформления", "select"),
          field("b-budget", "Бюджет, ₽", "money"),
          field("b-photo", "Фотографии площадки", "photo", "client", false, 3),
          field("b-comment", "Пожелания и детали", "textarea"),
        ],
      },
    ],
    briefSubmissions: [],
  };
}
