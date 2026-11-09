require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { TERMS, TERMS_VERSION } = require("../backend/config/loanRules");
const repay = (amount, period) => amount + (amount * TERMS[period].rate) / 100; // total to repay at the standard rate
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");

seedAdmin();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const json = { "Content-Type": "application/json" };
const post = (url, body, headers = {}) => fetch(base + url, { method: "POST", headers: { ...json, ...headers }, body: JSON.stringify(body) });
let cookie, id;
const authed = (url, method = "GET", body) =>
  fetch(base + url, { method, headers: { ...json, Cookie: cookie }, body: body && JSON.stringify(body) });

const application = { name: "Jane Banda", phone: "0971234567", amount: 1000, period: "1 week", collateralType: "Vehicle", acceptedTerms: true, nrc: "123456/78/1", location: "Kabwe" };

test("pages and assets are served; the dashboard is protected", async () => {
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/admin/login")).status, 200);
  assert.equal((await fetch(base + "/assets/css/style.css")).status, 200);
  assert.equal((await fetch(base + "/assets/js/common.js")).status, 200);
  const terms = await fetch(base + "/terms");
  assert.equal(terms.status, 200);
  assert.match(await terms.text(), /Terms and Conditions/);
  assert.equal((await fetch(base + "/assets/js/terms.js")).status, 200);
  const r = await fetch(base + "/admin", { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /\/admin\/login$/);
  assert.equal((await fetch(base + "/nope")).status, 404);
});

test("admin API needs a login", async () => {
  for (const url of ["/api/admin/applications", "/api/admin/alerts", "/api/admin/me"])
    assert.equal((await fetch(base + url)).status, 401, url);
});

test("live calculator", async () => {
  const ok = await (await fetch(base + "/api/loan-terms?amount=1000&period=2%20weeks")).json();
  assert.deepEqual([ok.interestRate, ok.totalRepayment], [TERMS["2 weeks"].rate, repay(1000, "2 weeks")]);
  assert.equal((await fetch(base + "/api/loan-terms?amount=10&period=2%20weeks")).status, 400);
});

test("bad submissions are rejected", async () => {
  assert.equal((await post("/api/applications", { name: "X" })).status, 400);
  const { collateralType, ...noCollateral } = application;
  assert.equal((await post("/api/applications", noCollateral)).status, 400);
  const { acceptedTerms, ...notAccepted } = application;
  const r = await post("/api/applications", notAccepted);
  assert.equal(r.status, 400);
  assert.ok((await r.json()).errors.acceptedTerms);
  assert.equal((await post("/api/applications", { ...application, acceptedTerms: "true" })).status, 400);
  const badJson = await fetch(base + "/api/applications", { method: "POST", headers: json, body: "{nope" });
  assert.equal(badJson.status, 400);
});

test("submit: the server decides the terms, not the browser", async () => {
  const r = await post("/api/applications", { ...application, totalRepayment: 1, dueDate: "2020-01-01", interestRate: 0 });
  assert.equal(r.status, 201);
  const out = await r.json();
  assert.equal(out.terms.totalRepayment, repay(1000, "1 week"));
  assert.notEqual(out.terms.dueDate, "2020-01-01");
  id = out.id;
});

test("email route saves the application even when email is not set up", async () => {
  const out = await (await post("/api/applications", { ...application, contactMethod: "email", email: "a@b.co" })).json();
  assert.equal(out.emailSent, false);
  assert.ok(out.id);
});

test("login", async () => {
  assert.equal((await post("/api/admin/login", { username: "admin", password: "wrong" })).status, 401);
  const r = await post("/api/admin/login", { username: "admin", password: "TestPass12345" });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/i);
  assert.equal((await authed("/api/admin/me")).status, 200);
  assert.equal((await fetch(base + "/admin", { headers: { Cookie: cookie } })).status, 200);
});

test("the acceptance is recorded with the application", async () => {
  const row = await (await authed(`/api/admin/applications/${id}`)).json();
  assert.equal(row.terms_version, TERMS_VERSION);
  assert.match(row.terms_accepted_at, /^\d{4}-\d{2}-\d{2}T/);
});

const edit = (extra = {}) => ({ name: "Jane Banda", phone: "+260971234567", amount: 1000, period: "1 week", status: "contacted", notes: "", ...extra });

test("approve, receive the collateral, go overdue, alert, repay", async () => {
  // approved but no collateral yet: the clock has not started, so it can never be overdue
  let r = await (await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", dueDate: "2026-01-01" }))).json();
  assert.equal(r.overdue, false);
  assert.equal((await (await authed("/api/admin/alerts")).json()).overdue.length, 0);
  // the collateral arrives, then the due date passes
  assert.equal((await authed(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true })).status, 200);
  r = await (await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", dueDate: "2026-01-01" }))).json();
  assert.equal(r.overdue, true);
  assert.ok(r.days_overdue > 0);
  const alerts = await (await authed("/api/admin/alerts")).json();
  assert.equal(alerts.overdue.length, 1);
  assert.equal(alerts.overdueTotal, repay(1000, "1 week"));
  const filtered = await (await authed("/api/admin/applications?status=overdue")).json();
  assert.equal(filtered.length, 1);
  // the money was handed over, then the customer repaid
  assert.equal((await authed(`/api/admin/applications/${id}/money-given`, "POST", {})).status, 200);
  await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "repaid" }));
  assert.equal((await (await authed("/api/admin/alerts")).json()).overdue.length, 0);
});

test("approving restarts the due date from today", async () => {
  const other = (await (await post("/api/applications", { ...application, period: "3 weeks" })).json()).id;
  const r = await (await authed(`/api/admin/applications/${other}`, "PUT", edit({ period: "3 weeks", status: "approved" }))).json();
  const { dateInTZ, addDays } = require("../backend/services/loanCalculator");
  assert.equal(r.due_date, addDays(dateInTZ(), 21));
  assert.equal(r.approved_at, dateInTZ());
});

test("editing notes never changes interest; changing the period does", async () => {
  const db = require("../backend/models/database");
  db.prepare("UPDATE applications SET interest_rate = 99, total_repayment = 1990 WHERE id = ?").run(id);
  let r = await (await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "repaid", notes: "paid in full" }))).json();
  assert.deepEqual([r.interest_rate, r.total_repayment, r.notes], [99, 1990, "paid in full"]);
  r = await (await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "repaid", period: "2 weeks" }))).json();
  assert.deepEqual([r.interest_rate, r.total_repayment], [TERMS["2 weeks"].rate, repay(1000, "2 weeks")]);
});

test("bad edits are rejected; delete works once", async () => {
  assert.equal((await authed(`/api/admin/applications/${id}`, "PUT", edit({ status: "hacked" }))).status, 400);
  assert.equal((await authed(`/api/admin/applications/${id}`, "PUT", edit({ dueDate: "2026-13-45" }))).status, 400);
  assert.equal((await authed("/api/admin/applications/99999", "PUT", edit())).status, 404);
  // money was given on this loan, so it is kept on record
  assert.equal((await authed(`/api/admin/applications/${id}`, "DELETE")).status, 409);
  assert.equal((await authed("/api/admin/applications/99999", "DELETE")).status, 404);
  // a loan that never had money given can be deleted, once
  const spare = (await (await post("/api/applications", application)).json()).id;
  assert.equal((await authed(`/api/admin/applications/${spare}`, "DELETE")).status, 200);
  assert.equal((await authed(`/api/admin/applications/${spare}`, "DELETE")).status, 404);
});

test("logout", async () => {
  assert.equal((await fetch(base + "/api/admin/logout", { method: "POST" })).status, 200);
});
