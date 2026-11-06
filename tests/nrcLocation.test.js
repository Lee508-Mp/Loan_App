require("./helpers/testEnv"); // first: sets up a throwaway database
const test = require("node:test");
const assert = require("node:assert/strict");
const env = require("../backend/config/env");
env.assertReady();
const { seedAdmin } = require("../backend/services/authService");
const app = require("../backend/app");

seedAdmin();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const json = { "Content-Type": "application/json" };
let cookie, id;
const call = (url, method = "GET", body) =>
  fetch(base + url, { method, headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });

const applicant = { name: "Jane Banda", phone: "0971234567", amount: 1000, period: "1 week", collateralType: "Vehicle", acceptedTerms: true };
const edit = (extra = {}) => ({ name: "Jane Banda", phone: "+260971234567", amount: 1000, period: "1 week", status: "contacted", notes: "", ...extra });

test("the public form cannot be sent without an NRC or a location", async () => {
  const noNrc = await call("/api/applications", "POST", { ...applicant, location: "Kabwe" });
  assert.equal(noNrc.status, 400);
  assert.ok((await noNrc.json()).errors.nrc);
  const noLocation = await call("/api/applications", "POST", { ...applicant, nrc: "123456/78/1" });
  assert.equal(noLocation.status, 400);
  assert.ok((await noLocation.json()).errors.location);
});

test("an application is saved with a tidy NRC and location", async () => {
  const r = await call("/api/applications", "POST", { ...applicant, nrc: "123456781", location: "  Kabwe,   Bwacha " });
  assert.equal(r.status, 201);
  id = (await r.json()).id;
  const login = await call("/api/admin/login", "POST", { username: "admin", password: "TestPass12345" });
  cookie = login.headers.get("set-cookie").split(";")[0];
  const row = await (await call(`/api/admin/applications/${id}`)).json();
  assert.deepEqual([row.nrc, row.location], ["123456/78/1", "Kabwe, Bwacha"]);
});

test("an admin edit that leaves them out keeps them (Mark repaid and Approve do this)", async () => {
  const r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ notes: "called" }))).json();
  assert.deepEqual([r.nrc, r.location, r.notes], ["123456/78/1", "Kabwe, Bwacha", "called"]);
});

test("an admin can correct them, but not with a wrong NRC", async () => {
  const ok = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ nrc: "987654 32 1", location: "Lusaka" }))).json();
  assert.deepEqual([ok.nrc, ok.location], ["987654/32/1", "Lusaka"]);
  const bad = await call(`/api/admin/applications/${id}`, "PUT", edit({ nrc: "12345" }));
  assert.equal(bad.status, 400);
  assert.ok((await bad.json()).errors.nrc);
});

test("older records without an NRC can still be edited", async () => {
  const r = await (await call(`/api/admin/applications/${id}`, "PUT", edit({ nrc: "", location: "" }))).json();
  assert.deepEqual([r.nrc, r.location], ["", ""]);
});
