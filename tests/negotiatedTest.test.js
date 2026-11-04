require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { TERMS } = require("../backend/config/loanRules");
const { calculateLoan } = require("../backend/services/loanCalculator");
const { validateApplication } = require("../backend/validators/applicationValidator");
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");

// These tests read the standard rate from your settings, so they keep working when you change your rates.
const PERIOD = Object.keys(TERMS)[1];
const STANDARD = TERMS[PERIOD].rate;
const NEGOTIATED = STANDARD > 5 ? STANDARD - 5 : 1; // a rate lower than the standard one

test("calculateLoan: a negotiated rate replaces the standard rate", () => {
  const std = calculateLoan(1000, PERIOD, "2026-10-20");
  assert.equal(std.interestRate, STANDARD);
  const neg = calculateLoan(1000, PERIOD, "2026-10-20", 10);
  assert.deepEqual([neg.interestRate, neg.interestAmount, neg.totalRepayment], [10, 100, 1100]);
  assert.equal(neg.dueDate, std.dueDate); // the due date does not depend on the rate
  assert.equal(calculateLoan(1000, PERIOD, "2026-10-20", 0).totalRepayment, 1000); // 0% is allowed
  assert.equal(calculateLoan(1000, PERIOD, "2026-10-20", 12.5).interestAmount, 125);
});

const base = { name: "Jane Banda", phone: "0971234567", amount: 1000, period: PERIOD, collateralType: "Vehicle", status: "contacted" };
test("validator: negotiated rate rules (admin edits only)", () => {
  const rate = (negotiatedRate) => validateApplication({ ...base, negotiatedRate }, { admin: true });
  for (const empty of [undefined, null, "", "  "]) assert.equal(rate(empty).value.negotiatedRate, null);
  assert.equal(rate("12.5").value.negotiatedRate, 12.5);
  assert.equal(rate(10).value.negotiatedRate, 10);
  assert.equal(rate(0).value.negotiatedRate, 0);
  for (const bad of ["abc", "-1", 101, "5%"]) assert.ok(rate(bad).errors.negotiatedRate, String(bad));
  // the public form can never set it
  assert.equal(validateApplication({ ...base, acceptedTerms: true, negotiatedRate: 1 }).value.negotiatedRate, undefined);
});

seedAdmin();
const server = app.listen(0);
const baseUrl = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());
const json = { "Content-Type": "application/json" };
let cookie, id;
const call = (url, method = "GET", body, extra = {}) =>
  fetch(baseUrl + url, { method, headers: { ...json, ...extra, ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
const edit = (extra = {}) => ({ name: "Jane Banda", phone: "+260971234567", amount: 1000, period: PERIOD, status: "contacted", notes: "", ...extra });

test("setup: an application arrives with the standard rate, and the public cannot choose a rate", async () => {
  const r = await call("/api/applications", "POST", { ...base, acceptedTerms: true, negotiatedRate: 1, interestRate: 1 });
  assert.equal(r.status, 201);
  const out = await r.json();
  id = out.id;
  assert.equal(out.terms.interestRate, STANDARD);
  const login = await call("/api/admin/login", "POST", { username: "admin", password: "TestPass12345" });
  cookie = login.headers.get("set-cookie").split(";")[0];
  const row = await (await call(`/api/admin/applications/${id}`)).json();
  assert.equal(row.negotiated_rate, null);
  assert.equal(row.interest_rate, STANDARD);
  assert.equal(row.standard_rate, STANDARD);
});

test("admin sets a negotiated rate: interest and total are recalculated", async () => {
  const r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ negotiatedRate: NEGOTIATED }))).json();
  assert.equal(r.negotiated_rate, NEGOTIATED);
  assert.equal(r.interest_rate, NEGOTIATED);
  assert.equal(r.interest_amount, Math.round(1000 * NEGOTIATED) / 100);
  assert.equal(r.total_repayment, 1000 + Math.round(1000 * NEGOTIATED) / 100);
  assert.equal(r.standard_rate, STANDARD); // the standard rate is still known
});

test("editing something else keeps the negotiated rate; the other routes do not wipe it", async () => {
  let r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ negotiatedRate: NEGOTIATED, notes: "agreed by phone" }))).json();
  assert.deepEqual([r.interest_rate, r.notes], [NEGOTIATED, "agreed by phone"]);
  // a request that leaves the field out (like Mark repaid or Approve) keeps it
  r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved" }))).json();
  assert.equal(r.negotiated_rate, NEGOTIATED);
  assert.equal(r.interest_rate, NEGOTIATED);
});

test("changing the amount recalculates using the negotiated rate", async () => {
  const r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", amount: 2000, negotiatedRate: NEGOTIATED }))).json();
  assert.equal(r.interest_rate, NEGOTIATED);
  assert.equal(r.total_repayment, 2000 + Math.round(2000 * NEGOTIATED) / 100);
});

test("clearing the field returns to the standard rate", async () => {
  const r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", amount: 2000, negotiatedRate: "" }))).json();
  assert.equal(r.negotiated_rate, null);
  assert.equal(r.interest_rate, STANDARD);
  assert.equal(r.total_repayment, 2000 + Math.round(2000 * STANDARD) / 100);
});

test("bad rates are rejected", async () => {
  for (const bad of ["abc", -5, 150]) {
    const r = await call(`/api/admin/applications/${id}`, "PUT", edit({ negotiatedRate: bad }));
    assert.equal(r.status, 400, String(bad));
    assert.ok((await r.json()).errors.negotiatedRate);
  }
});