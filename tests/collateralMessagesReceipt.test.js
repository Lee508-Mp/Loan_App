require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { TERMS, COMPANY_NAME, RECEIPT_PREFIX } = require("../backend/config/loanRules");
const { dateInTZ, addDays } = require("../backend/services/loanCalculator");
const { maskNrc } = require("../backend/services/receiptService");
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");

seedAdmin();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const json = { "Content-Type": "application/json" };
let cookie, id, token;
const call = (url, method = "GET", body, withCookie = true) =>
  fetch(base + url, { method, headers: { ...json, ...(withCookie && cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
const edit = (extra = {}) => ({ name: "Jane Banda", phone: "+260971234567", amount: 1000, period: "1 week", status: "contacted", notes: "", ...extra });
const total = 1000 + (1000 * TERMS["1 week"].rate) / 100;

test("setup: a customer applies and the admin logs in", async () => {
  const r = await call("/api/applications", "POST", { name: "Jane Banda", phone: "0971234567", amount: 1000, period: "1 week",
    collateralType: "Vehicle", collateralDetails: "Toyota Corolla", acceptedTerms: true, nrc: "123456/78/1", location: "Kabwe" });
  assert.equal(r.status, 201);
  id = (await r.json()).id;
  cookie = (await call("/api/admin/login", "POST", { username: "admin", password: "TestPass12345" })).headers.get("set-cookie").split(";")[0];
});

test("the new admin routes need a login", async () => {
  for (const [m, u] of [["POST", "/collateral-received"], ["GET", "/message?kind=approval"], ["POST", "/messages"]])
    assert.equal((await call(`/api/admin/applications/${id}${u}`, m, {}, false)).status, 401, u);
});

test("collateral cannot be recorded, and messages cannot be drafted, before approval", async () => {
  assert.equal((await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true })).status, 400);
  assert.equal((await call(`/api/admin/applications/${id}/message?kind=approval`)).status, 400);
  assert.equal((await call(`/api/admin/applications/${id}/message?kind=receipt`)).status, 400);
});

test("approval message: filled in with the loan figures, editable, and logged", async () => {
  await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", negotiatedRate: 10 }));
  const d = await (await call(`/api/admin/applications/${id}/message?kind=approval`)).json();
  assert.equal(d.phone, "+260971234567");
  for (const part of ["Hello Jane", COMPANY_NAME, "K1,000", "10% (the rate we agreed with you)", "K1,100", "Toyota Corolla",
                      "once you deliver the collateral"]) assert.ok(d.text.includes(part), part);
  assert.equal(d.history.length, 0);

  const edited = d.text + "\n\nPlease call before you come.";
  const sent = await call(`/api/admin/applications/${id}/messages`, "POST", { kind: "approval", text: edited });
  assert.equal(sent.status, 201);
  const url = (await sent.json()).url;
  assert.ok(url.startsWith("https://wa.me/260971234567?text="));
  assert.ok(decodeURIComponent(url).includes("Please call before you come.")); // the admin's edit is what gets sent
  const again = await (await call(`/api/admin/applications/${id}/message?kind=approval`)).json();
  assert.deepEqual([again.history.length, again.history[0].kind, again.history[0].admin_username], [1, "approval", "admin"]);
  assert.equal((await call(`/api/admin/applications/${id}/messages`, "POST", { kind: "approval", text: "  " })).status, 400);
  assert.equal((await call(`/api/admin/applications/${id}/messages`, "POST", { kind: "hello", text: "hi" })).status, 400);
});

test("approved but no collateral yet: the clock has not started and the loan is listed as waiting", async () => {
  const row = await (await call(`/api/admin/applications/${id}`)).json();
  assert.deepEqual([row.collateral_received_at, row.receipt_token, row.overdue], ["", "", false]);
  const alerts = await (await call("/api/admin/alerts")).json();
  assert.deepEqual(alerts.awaitingCollateral.map((r) => r.id), [id]);
  assert.equal((await call(`/api/admin/applications/${id}/message?kind=receipt`)).status, 400); // no receipt message yet
});

test("collateral received: the clock starts today and the receipt link is created", async () => {
  const r = await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true, notes: "  Plate  ABC 1234, good condition " });
  assert.equal(r.status, 200);
  const row = await r.json();
  const today = dateInTZ();
  assert.equal(row.collateral_received_at, today);
  assert.equal(row.due_date, addDays(today, 7));
  assert.equal(row.collateral_notes, "Plate ABC 1234, good condition");
  assert.match(row.receipt_token, /^[a-f0-9]{48}$/);
  token = row.receipt_token;
  assert.equal((await (await call("/api/admin/alerts")).json()).awaitingCollateral.length, 0);
  // pressing it again does not move the date or change the link
  const second = await (await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true })).json();
  assert.deepEqual([second.collateral_received_at, second.receipt_token], [today, token]);
});

test("the receipt message holds the receipt link", async () => {
  const d = await (await call(`/api/admin/applications/${id}/message?kind=receipt`)).json();
  assert.ok(d.text.includes(`${base}/receipt/${token}`));
  assert.ok(d.text.includes(`${RECEIPT_PREFIX}-${dateInTZ().slice(0, 4)}-${String(id).padStart(4, "0")}`));
  assert.ok(d.text.includes("K1,100"));
});

test("the customer's receipt opens with the link alone, and shows only what it should", async () => {
  const page = await fetch(`${base}/receipt/${token}`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
  const r = await fetch(`${base}/api/receipts/${token}`); // no login, no cookie
  assert.equal(r.status, 200);
  const receipt = await r.json();
  assert.deepEqual([receipt.customerName, receipt.amount, receipt.interestRate, receipt.negotiated, receipt.totalRepayment, receipt.collateralType],
    ["Jane Banda", 1000, 10, true, 1100, "Vehicle"]);
  assert.equal(receipt.nrc, "******/78/1");               // the full NRC is never on the receipt
  assert.equal(receipt.issuedOn, dateInTZ());
  const text = JSON.stringify(receipt);
  for (const secret of ["123456/78/1", "0971234567", "260971234567", "admin", "email", "notes"]) assert.ok(!text.includes(secret) || secret === "notes", secret);
  assert.ok(!("phone" in receipt) && !("email" in receipt) && !("notes" in receipt)); // no phone, no email, no private admin notes
  assert.match(r.headers.get("cache-control"), /no-store/);
});

test("guessing does not work", async () => {
  for (const bad of ["abc", "0".repeat(48), "f".repeat(48), "a".repeat(47), "../etc/passwd", token.toUpperCase()])
    assert.equal((await fetch(`${base}/api/receipts/${encodeURIComponent(bad)}`)).status, 404, bad);
});

test("overdue now counts from the collateral date", async () => {
  const row = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", negotiatedRate: 10, dueDate: "2026-01-01" }))).json();
  assert.equal(row.overdue, true);
  assert.equal((await (await call("/api/admin/alerts")).json()).overdue.length, 1);
  await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "repaid", negotiatedRate: 10 }));
  assert.equal((await (await call("/api/admin/alerts")).json()).overdue.length, 0);
});

test("undoing the collateral stops the receipt link until it is recorded again", async () => {
  await call(`/api/admin/applications/${id}`, "PUT", edit({ status: "approved", negotiatedRate: 10 }));
  const undone = await (await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: false })).json();
  assert.equal(undone.collateral_received_at, "");
  assert.equal((await fetch(`${base}/api/receipts/${token}`)).status, 404);
  const back = await (await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true })).json();
  assert.equal(back.receipt_token, token);                       // the same link works again
  assert.equal((await fetch(`${base}/api/receipts/${token}`)).status, 200);
});

test("long notes are refused and deleting a loan removes its messages", async () => {
  assert.equal((await call(`/api/admin/applications/${id}/collateral-received`, "POST", { received: true, notes: "x".repeat(301) })).status, 400);
  const db = require("../backend/models/database");
  assert.ok(db.prepare("SELECT COUNT(*) c FROM messages WHERE application_id = ?").get(id).c >= 1);
  assert.equal((await call(`/api/admin/applications/${id}`, "DELETE")).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM messages WHERE application_id = ?").get(id).c, 0);
  assert.equal((await fetch(`${base}/api/receipts/${token}`)).status, 404);
});

test("maskNrc", () => {
  assert.equal(maskNrc("123456/78/1"), "******/78/1");
  assert.equal(maskNrc(""), "");
});
