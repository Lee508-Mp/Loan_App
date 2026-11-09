require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { dateInTZ, addDays } = require("../backend/services/loanCalculator");
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");

seedAdmin();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const json = { "Content-Type": "application/json" };
let cookie;
const call = (url, method = "GET", body, withCookie = true) =>
  fetch(base + url, { method, headers: { ...json, ...(withCookie && cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
const today = dateInTZ();
const yesterday = addDays(today, -1);
const tomorrow = addDays(today, 1);

const apply = async (name) => (await (await call("/api/applications", "POST", { name, phone: "0971234567", amount: 1000, period: "1 week",
  collateralType: "Vehicle", acceptedTerms: true, nrc: "123456/78/1", location: "Kabwe" })).json()).id;
const get = async (id) => (await call(`/api/admin/applications/${id}`)).json();
const edit = (extra = {}) => ({ name: "Jane Banda", phone: "+260971234567", amount: 1000, period: "1 week", status: "contacted", notes: "", ...extra });
const put = (id, extra) => call(`/api/admin/applications/${id}`, "PUT", edit(extra));
const approve = (id) => put(id, { status: "approved" });
const collateral = (id) => call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true });
const money = (id, body = {}) => call(`/api/admin/applications/${id}/money-given`, "POST", body);
const repay = (id, body = {}) => call(`/api/admin/applications/${id}/repayment`, "POST", body);
const cancel = (id, reason) => call(`/api/admin/applications/${id}/cancel`, "POST", { reason });
const del = (id) => call(`/api/admin/applications/${id}`, "DELETE");

let a, b, c, d; // four loans

test("setup: four customers apply and the admin logs in", async () => {
  [a, b, c, d] = [await apply("Loan A"), await apply("Loan B"), await apply("Loan C"), await apply("Loan D")];
  cookie = (await call("/api/admin/login", "POST", { username: "admin", password: "TestPass12345" })).headers.get("set-cookie").split(";")[0];
  assert.ok(cookie);
});

test("the new routes need a login", async () => {
  for (const u of ["money-given", "repayment", "cancel"]) assert.equal((await call(`/api/admin/applications/${a}/${u}`, "POST", {}, false)).status, 401, u);
});

test("money given: only after approval and after the collateral", async () => {
  assert.equal((await money(a)).status, 400);                      // not approved yet
  await approve(a);
  const early = await money(a);
  assert.equal(early.status, 400);
  assert.match((await early.json()).error, /collateral/i);         // collateral not received
  assert.equal((await collateral(a)).status, 200);
});

test("money given: dates are checked, and the default is today", async () => {
  assert.equal((await money(a, { date: tomorrow })).status, 400);        // not in the future
  assert.equal((await money(a, { date: yesterday })).status, 400);       // not before the collateral came in
  assert.equal((await money(a, { date: "2026-13-45" })).status, 400);
  const r = await money(a);                                              // no date: today
  assert.equal(r.status, 200);
  const row = await r.json();
  assert.deepEqual([row.money_given_on, row.status], [today, "approved"]);
});

test("the banner lists loans where the collateral is in but the money is not given", async () => {
  await approve(b); await collateral(b);
  const alerts = await (await call("/api/admin/alerts")).json();
  assert.deepEqual(alerts.awaitingMoney.map((r) => r.id), [b]);       // A already has its money, B does not
});

test("repayment: needs the money given date; older loans can supply it once", async () => {
  const noDate = await repay(b);
  assert.equal(noDate.status, 400);
  assert.match((await noDate.json()).error, /money was given/i);
  assert.equal((await repay(b, { moneyGivenOn: "2026-02-01", paidOn: "2026-01-15" })).status, 400);   // repaid before the money was given
  assert.equal((await repay(b, { moneyGivenOn: tomorrow })).status, 400);
  assert.equal((await repay(b, { moneyGivenOn: "2026-01-05", paidOn: "2026-01-20", amountPaid: "1,150" })).status, 200);
  const row = await get(b);
  assert.deepEqual([row.status, row.money_given_on, row.repaid_on, row.amount_paid], ["repaid", "2026-01-05", "2026-01-20", 1150]);
});

test("repayment: the date and the amount default to today and the total to repay", async () => {
  const total = (await get(a)).total_repayment;
  const row = await (await repay(a)).json();
  assert.deepEqual([row.status, row.repaid_on, row.amount_paid], ["repaid", today, total]);
  assert.equal((await repay(a)).status, 400);                          // already repaid
  assert.equal((await repay(c)).status, 400);                          // not approved
});

test("a different amount paid is kept as typed", async () => {
  await approve(c); await collateral(c); await money(c);
  const row = await (await repay(c, { amountPaid: 900 })).json();
  assert.equal(row.amount_paid, 900);
});

test("undo money given: not once repaid", async () => {
  assert.equal((await money(a, { given: false })).status, 400);        // A is repaid
  await approve(d); await collateral(d); await money(d);
  const row = await (await money(d, { given: false })).json();
  assert.equal(row.money_given_on, "");
});

test("the Edit window rules: the same checks apply", async () => {
  const e = await apply("Loan E");
  assert.equal((await put(e, { moneyGivenOn: today })).status, 400);                    // not approved
  assert.equal((await put(e, { status: "repaid" })).status, 400);                       // never approved
  await approve(e); await collateral(e); await money(e);
  assert.equal((await put(e, { status: "rejected" })).status, 400);                     // money has left
  assert.equal((await put(e, { status: "approved", repaidOn: today })).status, 200);    // a repaid date without "repaid" is cleared
  assert.equal((await get(e)).repaid_on, "");
  assert.equal((await put(e, { status: "repaid", repaidOn: tomorrow })).status, 400);
  assert.equal((await put(e, { status: "repaid", amountPaid: "abc" })).status, 400);
  const ok = await (await put(e, { status: "repaid", repaidOn: today, amountPaid: 1200 })).json();
  assert.deepEqual([ok.status, ok.repaid_on, ok.amount_paid], ["repaid", today, 1200]);
  const reopened = await (await put(e, { status: "approved" })).json();                 // a mistake can be reopened
  assert.deepEqual([reopened.status, reopened.repaid_on, reopened.amount_paid, reopened.money_given_on], ["approved", "", 0, today]);
});

test("deleting: blocked once money was given or the loan is repaid, allowed otherwise", async () => {
  assert.equal((await del(a)).status, 409);                            // repaid
  const given = await del(c);                                          // repaid too
  assert.equal(given.status, 409);
  assert.match((await given.json()).error, /kept on record/i);
  const loose = await apply("Loan F");                                 // never approved
  assert.equal((await del(loose)).status, 200);
  assert.equal((await del(loose)).status, 404);
});

test("cancelling: needs a reason, keeps the record, and cannot be done twice", async () => {
  const f = await apply("Loan G");
  await approve(f); await collateral(f); await money(f);
  assert.equal((await del(f)).status, 409);                            // money given: cannot delete
  assert.equal((await cancel(f, "")).status, 400);
  assert.equal((await cancel(f, "ab")).status, 400);
  const row = await (await cancel(f, "  Customer  never   collected  ")).json();
  assert.deepEqual([row.status, row.cancelled_on, row.cancel_reason, row.money_given_on], ["cancelled", today, "Customer never collected", today]);
  assert.equal((await cancel(f, "again")).status, 400);
  assert.equal((await del(f)).status, 409);                            // still on record
  assert.equal((await cancel(a, "x y z")).status, 400);                // a repaid loan cannot be cancelled
  assert.equal((await put(a, { status: "cancelled", cancelReason: "no" })).status, 400);
});

test("cancelling through Edit needs a reason too; reopening clears the cancel record", async () => {
  const g = await apply("Loan H");
  assert.equal((await put(g, { status: "cancelled" })).status, 400);
  assert.equal((await put(g, { status: "cancelled", cancelReason: "Customer changed their mind" })).status, 200);
  assert.equal((await get(g)).cancelled_on, today);
  const reopened = await (await put(g, { status: "contacted" })).json();
  assert.deepEqual([reopened.cancelled_on, reopened.cancel_reason], ["", ""]);
  assert.equal((await call("/api/admin/applications?status=cancelled")).status, 200);
});

test("repaid loans with no dates (older data) are listed so you can fill them in", async () => {
  const old = await apply("Loan I");
  const db = require("../backend/models/database");
  db.prepare("UPDATE applications SET status = 'repaid' WHERE id = ?").run(old);                 // how older loans look
  assert.ok((await (await call("/api/admin/alerts")).json()).missingDates.map((r) => r.id).includes(old));
  assert.equal((await put(old, { status: "repaid", moneyGivenOn: "2026-01-02", repaidOn: "2026-01-09", amountPaid: 1150 })).status, 200);
  assert.ok(!(await (await call("/api/admin/alerts")).json()).missingDates.map((r) => r.id).includes(old));
});
