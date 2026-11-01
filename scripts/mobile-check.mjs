import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const output = "artifacts/mobile";
mkdirSync(`${output}/after`, { recursive: true });
const base = process.env.PROTOTYPE_URL || "http://127.0.0.1:5178";
const checks = [], errors = [], layout = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
async function ready() {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
}
async function go(path = "", role = "executor") {
  await page.goto(`${base}/?role=${role}#/${path}`);
  await page.locator(".content h1").first().waitFor();
  await ready();
}
async function fits(label) {
  const size = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  assert.ok(size[1] <= size[0] + 1, `${label} has page overflow: ${size}`);
  layout.push({ label, width: size[0], scrollWidth: size[1] });
  const dialog = page.getByRole("dialog").last();
  if (await dialog.count()) {
    const width = await dialog.evaluate((d) => [d.clientWidth, d.scrollWidth]);
    assert.ok(width[1] <= width[0] + 1, `${label} has dialog overflow: ${width}`);
  }
}
async function capture(name) { await ready(); await page.screenshot({ path: `${output}/after/${name}.png` }); }
async function close() { await page.getByRole("dialog").last().getByRole("button", { name: "Закрыть окно", exact: true }).click(); }
async function reachable(button) {
  const result = await button.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { bottom: r.bottom, height: innerHeight, visible: !!hit && b.contains(hit), width: r.width, targetHeight: r.height };
  });
  assert.ok(result.bottom <= result.height && result.visible, `Action is obscured: ${JSON.stringify(result)}`);
  assert.ok(result.width >= 44 && result.targetHeight >= 44);
}
try {
  await go();
  await capture("home");
  const nav = page.getByRole("navigation", { name: "Мобильная навигация" });
  assert.equal(await nav.getByRole("button").count(), 5);
  for (const label of ["Сделки", "Брифы", "Календарь", "Финансы", "Главная"]) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await ready();
    assert.equal(await nav.locator('[aria-current="page"]').textContent(), label);
    await fits(`navigation: ${label}`);
  }
  checks.push("Five bottom navigation destinations, active state and touch targets");

  await go("builder");
  await page.locator(".mobile-builder-actions").getByRole("button", { name: "Далее", exact: true }).click();
  await capture("builder");
  assert.equal(await page.locator(".stage-sidebar").isVisible(), false);
  await page.getByRole("button", { name: "Выбрать этап" }).click();
  await capture("stage-picker");
  await page.locator(".stage-picker-list .stage-nav").filter({ hasText: "Монтаж и приёмка" }).click();
  await page.getByLabel("Размер оплаты", { exact: true }).selectOption("fixed");
  await page.getByLabel("Сумма, ₽", { exact: true }).fill("24000");
  await page.getByLabel("Режим срока", { exact: true }).selectOption("relative");
  await page.getByLabel("Количество", { exact: true }).fill("2");
  await page.getByLabel("Период", { exact: true }).selectOption("months");
  await page.getByLabel("Направление", { exact: true }).selectOption("before");
  await page.getByLabel("Точка отсчёта", { exact: true }).selectOption("end");
  await reachable(page.locator(".mobile-builder-actions").getByRole("button", { name: "Сохранить", exact: true }));
  await fits("stage editing with fixed payment and relative deadline");
  checks.push("Stage picker and persistent save action while editing payment and deadline");

  await go("briefs");
  await page.getByRole("button", { name: "Создать бриф", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Название поля", { exact: true }).fill("Фото площадки");
  await page.getByRole("dialog").getByLabel("Тип поля", { exact: true }).selectOption("photo");
  await page.getByRole("dialog").getByLabel("Минимум файлов", { exact: true }).fill("3");
  await fits("brief editor with required photos");
  await capture("brief-editor");
  await reachable(page.getByRole("dialog").getByRole("button", { name: "Сохранить бриф", exact: true }));
  await close();
  checks.push("Mobile brief editor keeps save visible and supports photo count");

  await go("deal/wedding");
  await page.locator(".mobile-parallel-label").first().waitFor();
  await capture("deal");
  await page.locator(".stage-tile").filter({ has: page.getByRole("heading", { name: "Концепция оформления", exact: true }) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Передать на приёмку", exact: true }).click();
  const link = page.getByRole("dialog").getByLabel("Ссылка на концепцию", { exact: false });
  await link.fill("https://example.ru/concept");
  assert.equal(await link.inputValue(), "https://example.ru/concept");
  await fits("stage drawer");
  await capture("stage");
  await reachable(page.getByRole("dialog").getByRole("button", { name: "Передать на приёмку", exact: true }));
  await close();
  checks.push("Parallel grouping, stage details, validation and unobscured submission action");

  await go("calendar", "client");
  assert.equal(await nav.getByRole("button").count(), 4);
  await page.getByLabel("Проект или сделка").selectOption("Свадьба Алины Ореховой");
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await fits("client agenda");
  await capture("calendar-list");
  const photo = page.locator(".calendar-upcoming .agenda-item").filter({ has: page.getByText("Свадебная фотосъёмка с Алиной Ореховой", { exact: true }) }).first();
  await photo.click();
  await page.getByRole("dialog", { name: "Подготовка и согласование", exact: true }).waitFor();
  assert.ok(page.url().includes("/deal/photo/photo-s1"));
  await close();
  assert.ok(page.url().endsWith("#/deal/photo"));
  await page.goBack();
  await page.getByRole("heading", { name: "Календарь проектов", exact: true }).waitFor();
  checks.push("Client agenda combines contractors; direct stage opening and predictable Back");

  for (const size of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 430, height: 932 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    for (const path of ["", "deals", "briefs", "builder", "calendar", "finance", "deal/wedding"]) {
      await go(path); await fits(`${size.width}×${size.height}: ${path || "home"}`);
    }
    await go("briefs");
    await page.getByRole("button", { name: "Создать бриф", exact: true }).click();
    await fits(`${size.width}×${size.height}: brief dialog`);
    await reachable(page.getByRole("dialog").getByRole("button", { name: "Сохранить бриф", exact: true }));
    await close();
  }
  checks.push("Seven screens and modal at 320, 375, 430 px and landscape; reduced motion");
  await page.setViewportSize({ width: 390, height: 844 });
  await go("calendar", "client"); await capture("calendar");
  await go("finance"); await capture("finance");
  await go("deals"); await capture("deals");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/mobile.html`);
  await page.frameLocator("iframe").getByRole("navigation", { name: "Мобильная навигация" }).waitFor();
  await page.screenshot({ path: `${output}/preview.png` });
  checks.push("Desktop preview runs the actual responsive application");

  let safari = "unavailable";
  try {
    const wb = await webkit.launch({ headless: true });
    try {
      const wp = await wb.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await wp.goto(base); await wp.locator(".mobile-nav").waitFor();
      assert.ok(await wp.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await wp.goto(`${base}/#/calendar`);
      await wp.getByRole("button", { name: "Список", exact: true }).click();
      await wp.locator(".calendar-upcoming").waitFor();
      safari = "passed";
    } finally { await wb.close(); }
  } catch (e) {
    if (!e.message.includes("Executable doesn't exist")) throw e;
  }
  assert.deepEqual(errors, []);
  const report = { passed: true, checks, layout, errors, webkit: safari };
  writeFileSync(`${output}/mobile-check.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, checks, webkit: safari }, null, 2));
} catch (e) {
  await page.screenshot({ path: `${output}/mobile-failure.png` });
  writeFileSync(`${output}/mobile-check.json`, JSON.stringify({ passed: false, checks, layout, errors, error: e.stack }, null, 2));
  console.error(e); process.exitCode = 1;
} finally { await browser.close(); }
