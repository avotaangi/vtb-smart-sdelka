import test from "node:test";
import assert from "node:assert/strict";
import { initialData } from "../src/seed.js";
import {
  paymentKopecks,
  paidAmount,
  validateDeal,
  depsReady,
  deadline,
  shiftMonths,
  fieldsErrors,
  roadmapLevels,
  visibleDeals,
  settleDeal,
} from "../src/model.js";
const sample = () => structuredClone(initialData().deals[0]);
test("mixed percentages and fixed payments equal 60 000 rubles, without floating totals", () => {
  const d = sample();
  assert.equal(
    d.stages.reduce((n, s) => n + paymentKopecks(d, s), 0),
    6000000,
  );
  assert.equal(paidAmount(d), 18000);
  assert.deepEqual(validateDeal(d), []);
});
test("payment percentages round to a kopeck", () => {
  const d = sample();
  d.price = 99.99;
  assert.equal(
    paymentKopecks(d, { payment: { mode: "percent", value: 33.33 } }),
    3333,
  );
});
test("mismatched payment total blocks sending", () => {
  const d = sample();
  d.price = 61000;
  assert.match(validateDeal(d).join(" "), /Сумма платежей/);
});
test("cyclic dependencies block sending", () => {
  const d = sample();
  d.stages[0].deps = ["w-report"];
  assert.match(validateDeal(d).join(" "), /цикл/);
});
test("parallel branches are available after a confirmed advance payment", () => {
  const d = sample();
  assert.ok(
    depsReady(
      d,
      d.stages.find((s) => s.id === "w-concept"),
    ),
  );
  assert.ok(
    depsReady(
      d,
      d.stages.find((s) => s.id === "w-refs"),
    ),
  );
  const levels = roadmapLevels(d);
  assert.deepEqual(
    levels[2].map((s) => s.id),
    ["w-concept", "w-refs"],
  );
});
test("accepted stage with unpaid payment keeps dependent work blocked", () => {
  const d = sample();
  d.stages.find((s) => s.id === "w-pay").paid = false;
  assert.equal(
    depsReady(
      d,
      d.stages.find((s) => s.id === "w-concept"),
    ),
    false,
  );
});
test("deadline relative to completion uses the actual completion date", () => {
  const d = sample();
  d.stages.find((s) => s.id === "w-pay").completedDate = "2026-10-10";
  assert.equal(
    deadline(
      d,
      d.stages.find((s) => s.id === "w-concept"),
    ),
    "2026-10-15",
  );
});
test("deadline without a known completion anchor remains unresolved", () => {
  const d = sample();
  d.stages.find((s) => s.id === "w-pay").completedDate = undefined;
  assert.equal(
    deadline(
      d,
      d.stages.find((s) => s.id === "w-concept"),
    ),
    null,
  );
});
test("calendar months clamp to the last valid day", () => {
  assert.equal(shiftMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(shiftMonths("2026-03-31", -1), "2026-02-28");
});
test("required photo count and valid URL are enforced", () => {
  const d = sample(),
    fields = d.stages[0].fields;
  assert.match(
    fieldsErrors(fields, {
      "m-comment": "Зал",
      "m-photo": [{ name: "1.jpg" }],
    })["m-photo"],
    /3/,
  );
  assert.equal(
    Object.keys(
      fieldsErrors(fields, { "m-comment": "Зал", "m-photo": [1, 2, 3] }),
    ).length,
    0,
  );
  assert.ok(
    fieldsErrors([{ id: "url", type: "link", required: true }], {
      url: "javascript:alert(1)",
    }).url,
  );
});
test("relative end deadline requires the project end date", () => {
  const d = sample();
  d.endDate = "";
  assert.match(validateDeal(d).join(" "), /дату окончания/);
});
test("client cannot see executor drafts or other clients orders", () => {
  const db = initialData();
  db.deals.push({ ...sample(), id: "draft", status: "draft" });
  assert.deepEqual(
    visibleDeals(db.deals, "client").map((d) => d.id),
    ["wedding", "photo", "host"],
  );
  assert.deepEqual(
    visibleDeals(db.deals, "executor").map((d) => d.id),
    ["wedding", "brand", "salon", "draft"],
  );
});
test("deal closes only after all results and payments are complete", () => {
  const d = sample();
  d.stages = d.stages.map((s) => ({ ...s, status: "accepted", paid: true }));
  assert.equal(settleDeal(d).status, "completed");
  d.stages.at(-1).paid = false;
  assert.equal(settleDeal(d).status, "active");
});
