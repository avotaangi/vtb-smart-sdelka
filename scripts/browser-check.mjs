// Run with PLAYWRIGHT_MODULE set to the available Playwright module, or install it locally.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true });
const mobile = process.env.MOBILE_CHECK === "1";
const output = mobile ? "artifacts/mobile" : "artifacts";
const context = await browser.newContext({
    viewport: mobile ? { width: 375, height: 812 } : { width: 1440, height: 1000 },
    isMobile: mobile,
    hasTouch: mobile,
  }),
  page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.APP_BASE_URL || "http://127.0.0.1:5178",
  key = "vtb-smart-deal:prototype:v1";
const db = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const dialog = () => page.getByRole("dialog").last();
const role = async (name) => {
  await page
    .locator(".role-switch")
    .getByRole("button", { name, exact: true })
    .click();
};
const close = async () => {
  await dialog()
    .getByRole("button", { name: "Закрыть окно", exact: true })
    .click();
};
const stage = async (name) => {
  await page
    .locator(".stage-tile")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
};
const photo = (n) => ({
  name: `Фото-${n}.png`,
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7hkAAAAASUVORK5CYII=",
    "base64",
  ),
});
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Мои смарт-сделки" })
    .waitFor();
  checks.push("desktop overview");
  await page.goto(base + "/#/briefs");
  await page.getByRole("button", { name: "Создать бриф", exact: true }).click();
  await dialog()
    .getByLabel("Название брифа", { exact: true })
    .fill("Бриф тестового проекта");
  await dialog()
    .getByLabel("Описание для клиента")
    .fill("Расскажите о площадке и пожеланиях.");
  await dialog()
    .getByLabel("Название поля", { exact: true })
    .fill("Имя клиента");
  await dialog()
    .getByRole("button", { name: "Добавить поле", exact: true })
    .click();
  let fields = dialog().locator(".field-editor");
  await fields
    .nth(1)
    .getByLabel("Название поля", { exact: true })
    .fill("Фото площадки");
  await fields
    .nth(1)
    .getByLabel("Тип поля", { exact: true })
    .selectOption("photo");
  await fields.nth(1).getByLabel("Минимум файлов").fill("3");
  await dialog()
    .getByRole("button", { name: "Добавить поле", exact: true })
    .click();
  fields = dialog().locator(".field-editor");
  await fields
    .nth(2)
    .getByLabel("Название поля", { exact: true })
    .fill("Комментарий");
  await fields
    .nth(2)
    .getByLabel("Тип поля", { exact: true })
    .selectOption("textarea");
  await dialog()
    .getByRole("button", { name: "Сохранить бриф", exact: true })
    .click();
  checks.push("brief configuration: text + required three photos + textarea");
  await page
    .getByRole("button", {
      name: "Отправить: Бриф тестового проекта",
      exact: true,
    })
    .click();
  await dialog().getByRole("button", { name: "Открыть как клиент" }).click();
  await page.getByRole("button", { name: "Передать бриф исполнителю" }).click();
  assert.ok(
    (await page
      .getByText("Заполните обязательное поле", { exact: true })
      .count()) > 0,
  );
  await page.getByLabel("Имя клиента", { exact: false }).fill("Алина Орехова");
  await page
    .getByLabel("Комментарий", { exact: false })
    .fill("Белые цветы и зелень.");
  await page.locator("input[type=file]").setInputFiles([photo(1)]);
  await page.getByRole("button", { name: "Передать бриф исполнителю" }).click();
  await page.getByText("Добавьте не менее 3 файлов").waitFor();
  await page.locator("input[type=file]").setInputFiles([photo(2), photo(3)]);
  await page.getByText("Фото-3.png", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Передать бриф исполнителю" }).click();
  await page
    .getByRole("heading", { name: "Спасибо, ответы сохранены" })
    .waitFor();
  checks.push("brief validation, IndexedDB upload and client submission");
  await role("Исполнитель");
  await page.goto(base + "/?role=executor#/briefs");
  await page.getByRole("button", { name: "Собрать сделку" }).click();
  await page
    .getByLabel("Название сделки", { exact: true })
    .fill("Тестовая свадьба");
  assert.equal(
    await page.getByLabel("Имя клиента", { exact: true }).inputValue(),
    "Алина Орехова",
  );
  await page.getByRole("button", { name: "Перейти к этапам" }).click();
  if (mobile) await page.getByRole("button", { name: "Выбрать этап" }).click();
  await page
    .getByRole("button", { name: "Добавить этап", exact: true })
    .click();
  await page
    .getByLabel("Название этапа", { exact: true })
    .fill("Дополнительная консультация");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Удалить этап", exact: true }).click();
  if (mobile) await page.getByRole("button", { name: "Выбрать этап" }).click();
  await page
    .locator(mobile ? ".stage-picker-list .stage-nav" : ".stage-sidebar .stage-nav")
    .filter({ hasText: "Фотоотчёт и расчёт" })
    .click();
  await page.getByLabel("Период", { exact: true }).selectOption("months");
  await page.getByLabel("Количество", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: mobile ? "Сохранить" : "Сохранить черновик", exact: true })
    .click();
  let data = await db(),
    newDeal = data.deals.find((d) => d.name === "Тестовая свадьба");
  assert.equal(newDeal.status, "draft");
  assert.equal(newDeal.stages.length, 7);
  assert.equal(newDeal.stages.at(-1).deadline.unit, "months");
  checks.push("draft saved with custom deadline; adding and removing a stage");
  await role("Клиент");
  await page.goto(base + "/?role=client#/deals");
  assert.equal(
    await page.getByText("Тестовая свадьба", { exact: true }).count(),
    0,
  );
  await role("Исполнитель");
  await page.goto(base + `/?role=executor#/builder/${newDeal.id}`);
  if (mobile) {
    await page.locator(".mobile-builder-actions").getByRole("button", { name: "Далее", exact: true }).click();
    await page.locator(".mobile-builder-actions").getByRole("button", { name: "Далее", exact: true }).click();
  }
  await page
    .getByRole("button", { name: "Отправить клиенту", exact: true })
    .click();
  await dialog().getByRole("button", { name: "Открыть как клиент" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Согласовать условия", exact: true })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox", { name: /Я ознакомилась/ }).check();
  await page
    .getByRole("button", { name: "Согласовать условия", exact: true })
    .click();
  checks.push("draft privacy and explicit contract consent");
  await stage("Материалы площадки");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await dialog()
    .getByText("Заполните обязательные поля", { exact: false })
    .waitFor();
  await dialog()
    .getByLabel("Комментарий о площадке", { exact: false })
    .fill("Церемония у окон, ужин в зале.");
  await dialog()
    .locator("input[type=file]")
    .setInputFiles([photo(1), photo(2), photo(3)]);
  await dialog().getByText("Фото-3.png", { exact: true }).waitFor();
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Исполнитель");
  await stage("Материалы площадки");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  await role("Клиент");
  await stage("Предоплата");
  await dialog()
    .getByRole("button", { name: /Оплатить/ })
    .click();
  await dialog()
    .getByRole("button", { name: "Подтвердить оплату" })
    .click();
  await page
    .getByRole("heading", { name: "Оплата этапа", exact: true })
    .waitFor({ state: "hidden" });
  await close();
  data = await db();
  newDeal = data.deals.find((d) => d.id === newDeal.id);
  assert.equal(newDeal.stages.find((s) => s.id === "w-pay").paid, true);
  checks.push("materials acceptance opens advance payment");
  await role("Исполнитель");
  await stage("Концепция оформления");
  await dialog()
    .getByLabel("Ссылка на концепцию", { exact: false })
    .fill("https://example.ru/concept");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Клиент");
  await stage("Концепция оформления");
  await dialog().getByRole("button", { name: "Нужны доработки" }).click();
  await dialog()
    .getByLabel("Что нужно исправить")
    .fill("Добавьте вариант без арки.");
  await dialog().getByRole("button", { name: "Передать замечания" }).click();
  await role("Исполнитель");
  await stage("Концепция оформления");
  await dialog()
    .getByText("Добавьте вариант без арки.", { exact: false })
    .waitFor();
  await dialog()
    .getByLabel("Ссылка на концепцию", { exact: false })
    .fill("https://example.ru/concept-v2");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Клиент");
  await stage("Концепция оформления");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  checks.push("rework with preserved material and successful re-acceptance");
  await stage("Примеры и пожелания");
  await dialog()
    .getByLabel("Ваши пожелания", { exact: false })
    .fill("Оставляем белые цветы.");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Исполнитель");
  await stage("Примеры и пожелания");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  await stage("Согласование деталей");
  await dialog()
    .getByLabel("Финальная схема", { exact: false })
    .fill("https://example.ru/plan");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Клиент");
  await stage("Согласование деталей");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  checks.push("parallel branches unlock their shared dependent stage");
  await role("Исполнитель");
  await stage("Монтаж и приёмка");
  await dialog()
    .getByLabel("Комментарий о готовности", { exact: false })
    .fill("Все зоны готовы.");
  await dialog()
    .locator("input[type=file]")
    .setInputFiles([photo(1), photo(2)]);
  await dialog().getByText("Фото-2.png", { exact: true }).waitFor();
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Клиент");
  await stage("Монтаж и приёмка");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  await stage("Фотоотчёт и расчёт");
  await dialog()
    .getByText(
      "Этап откроется после завершения зависимостей и связанных оплат",
    )
    .waitFor();
  await close();
  await stage("Монтаж и приёмка");
  await dialog()
    .getByRole("button", { name: /Оплатить/ })
    .click();
  await dialog()
    .getByRole("button", { name: "Подтвердить оплату" })
    .click();
  await page
    .getByRole("heading", { name: "Оплата этапа", exact: true })
    .waitFor({ state: "hidden" });
  await close();
  checks.push(
    "fixed payment after acceptance keeps next stage blocked until confirmation",
  );
  await role("Исполнитель");
  await stage("Фотоотчёт и расчёт");
  await dialog()
    .getByLabel("Ссылка на фотоотчёт", { exact: false })
    .fill("https://example.ru/report");
  await dialog()
    .getByRole("button", { name: "Передать на приёмку", exact: true })
    .click();
  await role("Клиент");
  await stage("Фотоотчёт и расчёт");
  await dialog()
    .getByRole("button", { name: "Принять результат", exact: true })
    .click();
  await stage("Фотоотчёт и расчёт");
  await dialog()
    .getByRole("button", { name: /Оплатить/ })
    .click();
  await dialog()
    .getByRole("button", { name: "Подтвердить оплату" })
    .click();
  await page
    .getByRole("heading", { name: "Оплата этапа", exact: true })
    .waitFor({ state: "hidden" });
  await close();
  data = await db();
  newDeal = data.deals.find((d) => d.id === newDeal.id);
  assert.equal(newDeal.status, "completed");
  assert.equal(newDeal.stages.filter((s) => s.paid).length, 3);
  assert.equal(
    newDeal.events.filter((e) => e.text.startsWith("Оплата ")).length,
    3,
  );
  checks.push(
    "all seven stages and three payments complete, without duplicate payment events",
  );
  await page.reload();
  assert.equal(
    (await db()).deals.find((d) => d.id === newDeal.id).status,
    "completed",
  );
  checks.push("persistence after reload");
  await page.goto(base + "/?role=client#/calendar");
  await page
    .getByLabel("Проект или сделка")
    .selectOption("Свадьба Алины Ореховой");
  assert.ok((await page.locator(".calendar-event").count()) > 0);
  await page.screenshot({
    path: `${output}/calendar-client.png`,
    fullPage: true,
  });
  checks.push("multi-contractor client calendar");
  const overflow = [];
  for (const size of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    for (const p of [
      "",
      "deals",
      "briefs",
      "builder",
      "calendar",
      "finance",
      "deal/wedding",
    ]) {
      await page.goto(base + "/?role=executor#/" + p);
      await page.waitForTimeout(60);
      const widths = await page.evaluate(() => [
        innerWidth,
        document.documentElement.scrollWidth,
      ]);
      if (widths[1] > widths[0]) overflow.push({ size, p, widths });
    }
  }
  assert.deepEqual(overflow, []);
  assert.deepEqual(errors, []);
  checks.push(
    "seven pages across four viewports without horizontal page overflow or JavaScript errors",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page
    .getByRole("navigation", { name: "Мобильная навигация" })
    .getByRole("button", { name: "Календарь", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Календарь проектов", exact: true })
    .waitFor();
  checks.push("mobile navigation");
  writeFileSync(
    `${output}/browser-check.json`,
    JSON.stringify({ passed: true, checks, errors, overflow }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }, null, 2));
} catch (e) {
  await page.screenshot({
    path: `${output}/browser-failure.png`,
    fullPage: true,
  });
  writeFileSync(
    `${output}/browser-check.json`,
    JSON.stringify({ passed: false, checks, errors, error: e.stack }, null, 2),
  );
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
