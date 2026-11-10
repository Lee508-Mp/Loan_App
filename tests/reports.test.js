require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { dateInTZ, addDays } = require("../backend/services/loanCalculator");
const { monthsBetween } = require("../backend/services/reportService");
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");
const db = require("../backend/models/database");

seedAdmin();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const json = { "Content-Type": "application/json" };
let cookie;
const call = (url, method = "GET", body, withCookie = true) =>
  fetch(base + url, { method, headers: { ...json, ...(withCookie && cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
const report = async (from, to) => (await call(`/api/admin/reports/profit?from=${from}&to=${to}`)).json();
const today = dateInTZ();

// Six loans with known dates. We write the dates straight into the database, because this test is about the sums.
const L = {};
const apply = async () => (await (await call("/api/applications", "POST", { name: "Jane Banda", phone: "0971234567", amount: 1000, period: "1 week",
  collateralType: "Vehicle", acceptedTerms: true, nrc: "123456/78/1", location: "Kabwe" })).json()).id;
const set = (id, f) => db.prepare(`UPDATE applications SET amount=@amount, interest_amount=@interest, total_repayment=@total, period=@period, status=@status,
  money_given_on=@given, repaid_on=@repaid, amount_paid=@paid, cancelled_on=@cancelled, collateral_received_at=@collateral, due_date=@due WHERE id=@id`)
  .run({ amount: 1000, interest: 100, total: 1100, period: "1 week", status: "approved", given: "", repaid: "", paid: 0, cancelled: "", collateral: "", due: "", ...f, id });

test("setup: six loans with known dates, and three expenses", async () => {
  for (const k of ["L1", "L2", "L3", "L4", "L5", "L6"]) L[k] = await apply();
  cookie = (await call("/api/admin/login", "POST", { username: "admin", password: "TestPass12345" })).headers.get("set-cookie").split(";")[0];
  set(L.L1, { status: "repaid", given: "2026-03-05", repaid: "2026-03-20", paid: 1100 });
  set(L.L2, { status: "repaid", given: "2026-03-10", repaid: "2026-04-02", paid: 1100 });
  set(L.L3, { amount: 2000, interest: 200, total: 2200, given: "2026-04-15", collateral: "2026-04-14", due: "2026-04-22" });   // still out, and overdue
  set(L.L4, { amount: 500, interest: 50, total: 550, status: "cancelled", given: "2026-03-25", cancelled: "2026-04-10" });
  set(L.L5, { period: "2 weeks", status: "repaid", given: "2026-04-01", repaid: "2026-04-08", paid: 1050 });                    // paid less interest than agreed
  set(L.L6, { status: "repaid" });                                                                                              // an older repaid loan with no dates
  for (const e of [{ spentOn: "2026-03-12", kind: "expense", description: "Transport", amount: 200 },
                   { spentOn: "2026-04-05", kind: "loss", description: "Loan 4 will not come back", amount: 500, loanId: L.L4 },
                   { spentOn: "2026-04-06", kind: "expense", description: "Airtime", amount: 50 }])
    assert.equal((await call("/api/admin/expenses", "POST", e)).status, 201);
});

test("every report and expense route needs a login", async () => {
  for (const [m, u] of [["GET", "/api/admin/reports/profit"], ["GET", "/api/admin/reports/profit.csv"], ["GET", "/api/admin/expenses"],
                        ["POST", "/api/admin/expenses"], ["DELETE", "/api/admin/expenses/1"]])
    assert.equal((await call(u, m, {}, false)).status, 401, u);
});

test("March: money given, interest collected, expenses, profit", async () => {
  const r = await report("2026-03-01", "2026-03-31");
  assert.deepEqual([r.moneyGiven.count, r.moneyGiven.total], [3, 2500]);                  // L1 + L2 + L4 (a cancelled loan still gave out money)
  assert.deepEqual([r.collected.count, r.collected.total, r.interestCollected, r.interestAgreed], [1, 1100, 100, 100]);
  assert.deepEqual([r.expenses, r.losses, r.profit, r.netCash], [200, 0, -100, -1600]);
  assert.deepEqual(r.expected, { count: 1, principal: 1000, interest: 100, total: 1100 }); // L2 was repaid after 31 March, so it was still out
  assert.deepEqual(r.cancelledWithMoney, { count: 0, total: 0 });
  assert.equal(r.months.length, 1);
});

test("April: short payment, a loss, and a loan that is still out", async () => {
  const r = await report("2026-04-01", "2026-04-30");
  assert.deepEqual([r.moneyGiven.count, r.moneyGiven.total], [2, 3000]);                  // L3 + L5
  assert.deepEqual([r.collected.count, r.collected.total, r.interestCollected, r.interestAgreed], [2, 2150, 150, 200]); // L5 paid 50 interest, not 100
  assert.deepEqual([r.expenses, r.losses, r.profit, r.netCash], [50, 500, -400, -900]);
  assert.deepEqual(r.expected, { count: 1, principal: 2000, interest: 200, total: 2200 });
  assert.deepEqual(r.cancelledWithMoney, { count: 1, total: 500 });                       // a reminder to record the loss
  assert.deepEqual(r.byPeriod.map((p) => [p.period, p.count, p.interest]), [["1 week", 1, 100], ["2 weeks", 1, 50]]);
  assert.deepEqual(r.months[0], { month: "2026-04", given: 3000, collected: 2150, interestCollected: 150, expenses: 50, losses: 500, profit: -400 });
});

test("March to April together, month by month, and the loans the report cannot count", async () => {
  const r = await report("2026-03-01", "2026-04-30");
  assert.deepEqual([r.moneyGiven.total, r.collected.total, r.interestCollected, r.expenses, r.losses, r.profit], [5500, 3250, 250, 250, 500, -500]);
  assert.deepEqual(r.months.map((m) => [m.month, m.profit]), [["2026-03", -100], ["2026-04", -400]]);
  assert.equal(r.months.reduce((s, m) => s + m.profit, 0), r.profit);                    // the months add up to the total
  assert.equal(r.undatedRepaid, 1);                                                      // L6 has no dates
  assert.deepEqual(r.overdueNow, { count: 1, total: 2200 });                             // L3 is overdue today
});

test("an empty range gives zeros, and a missing range means this month so far", async () => {
  const r = await report("2020-01-01", "2020-01-31");
  assert.deepEqual([r.moneyGiven.total, r.collected.total, r.profit, r.months.length], [0, 0, 0, 1]);
  const def = await (await call("/api/admin/reports/profit")).json();
  assert.deepEqual([def.from, def.to, def.today], [today.slice(0, 8) + "01", today, today]);
});

test("bad ranges are refused", async () => {
  for (const q of ["from=2026-13-01&to=2026-04-30", "from=abc&to=2026-04-30", "from=2026-05-01&to=2026-04-01", "from=2020-01-01&to=2026-12-31"])
    assert.equal((await call(`/api/admin/reports/profit?${q}`)).status, 400, q);
});

test("monthsBetween", () => {
  assert.deepEqual(monthsBetween("2026-11-20", "2027-02-03"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
});

test("CSV: a file with the totals and the detail, safe to open in Excel", async () => {
  assert.equal((await call("/api/admin/expenses", "POST", { spentOn: "2026-04-07", kind: "expense", description: "=SUM(1,2)", amount: 10 })).status, 201);
  const res = await call("/api/admin/reports/profit.csv?from=2026-03-01&to=2026-04-30");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(res.headers.get("content-disposition"), /attachment; filename="profit-2026-03-01-to-2026-04-30\.csv"/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);                       // the marker that helps Excel read it as UTF-8
  const csv = bytes.toString("utf8").replace(/^\uFEFF/, "");
  assert.ok(csv.startsWith("Profit report"));
  for (const part of ["Interest collected,250", "Loans repaid in this period", "Money given in this period", "Expenses and losses", "2026-03,", "Jane Banda"])
    assert.ok(csv.includes(part), part);
  assert.ok(csv.includes('"\'=SUM(1,2)"'), "a formula in text is defused");              // starts with ' and is quoted because of the comma
  assert.equal((await call("/api/admin/reports/profit.csv?from=bad&to=2026-04-30")).status, 400);
});

test("expenses: checks, the loan link, listing and deleting", async () => {
  const add = (extra) => call("/api/admin/expenses", "POST", { spentOn: today, kind: "expense", description: "Rent", amount: 100, ...extra });
  for (const bad of [{ kind: "gift" }, { description: " " }, { description: "x" }, { amount: 0 }, { amount: -5 }, { amount: "abc" }, { spentOn: addDays(today, 1) },
                     { spentOn: "2026-13-01" }, { loanId: 99999 }])
    assert.equal((await add(bad)).status, 400, JSON.stringify(bad));
  const ok = await (await add({ amount: "1,200.50", loanId: `#${L.L4}`, description: "  Rent   for   November " })).json();
  assert.deepEqual([ok.amount, ok.loan_id, ok.description, ok.created_by, ok.kind], [1200.5, L.L4, "Rent for November", "admin", "expense"]);
  const list = await (await call(`/api/admin/expenses?from=${today}&to=${today}`)).json();
  assert.deepEqual(list.map((e) => [e.id, e.loan_name]), [[ok.id, "Jane Banda"]]);
  assert.equal((await call(`/api/admin/expenses/${ok.id}`, "DELETE")).status, 200);
  assert.equal((await call(`/api/admin/expenses/${ok.id}`, "DELETE")).status, 404);
});
