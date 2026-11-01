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
const call = (cookie, url, method = "GET", body) =>
  fetch(base + url, { method, headers: { ...json, ...(cookie ? { Cookie: cookie } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
const login = async (username, password) => {
  const r = await call(null, "/api/admin/login", "POST", { username, password });
  return { status: r.status, cookie: r.status === 200 ? r.headers.get("set-cookie").split(";")[0] : null };
};

const PASS = "TestPass12345";
let owner, staffId, staffA, staffB;

test("the admins API needs a login", async () => {
  for (const [m, u] of [["GET", "/api/admin/admins"], ["POST", "/api/admin/admins"], ["POST", "/api/admin/change-password"]])
    assert.equal((await call(null, u, m, {})).status, 401, u);
});

test("an admin can add a colleague, with checks", async () => {
  owner = (await login("admin", PASS)).cookie;
  assert.equal((await call(owner, "/api/admin/admins", "POST", { username: "staff1", password: "short" })).status, 400);
  assert.equal((await call(owner, "/api/admin/admins", "POST", { username: "a b", password: "LongEnough123" })).status, 400);
  const ok = await call(owner, "/api/admin/admins", "POST", { username: "staff1", password: "StaffPass123" });
  assert.equal(ok.status, 201);
  staffId = (await ok.json()).id;
  assert.equal((await call(owner, "/api/admin/admins", "POST", { username: "STAFF1", password: "StaffPass123" })).status, 400); // same name
  const list = await (await call(owner, "/api/admin/admins")).json();
  assert.deepEqual(list.map((a) => a.username), ["admin", "staff1"]);
  assert.ok(!JSON.stringify(list).includes("password")); // hashes are never sent
});

test("both admins see the SAME applications", async () => {
  staffA = (await login("staff1", "StaffPass123")).cookie;
  staffB = (await login("staff1", "StaffPass123")).cookie; // a second device
  const applied = await call(null, "/api/applications", "POST", {
    name: "Jane Banda", phone: "0971234567", amount: 1000, period: "1 week", collateralType: "Vehicle", acceptedTerms: true });
  assert.equal(applied.status, 201);
  const a = await (await call(owner, "/api/admin/applications")).json();
  const b = await (await call(staffA, "/api/admin/applications")).json();
  assert.equal(a.length, 1);
  assert.deepEqual(a, b);
});

test("changing your own password: needs the current one, ends your other logins, keeps this one", async () => {
  const wrong = await call(staffA, "/api/admin/change-password", "POST", { currentPassword: "nope-nope-nope", newPassword: "NewStaffPass1" });
  assert.equal(wrong.status, 400); // 400, so the dashboard does not throw you out
  assert.equal((await call(staffA, "/api/admin/change-password", "POST", { currentPassword: "StaffPass123", newPassword: "short" })).status, 400);
  const ok = await call(staffA, "/api/admin/change-password", "POST", { currentPassword: "StaffPass123", newPassword: "NewStaffPass1" });
  assert.equal(ok.status, 200);
  staffA = ok.headers.get("set-cookie").split(";")[0];
  assert.equal((await call(staffA, "/api/admin/me")).status, 200);  // this browser stays signed in
  assert.equal((await call(staffB, "/api/admin/me")).status, 401);  // the other device is signed out
  assert.equal((await login("staff1", "StaffPass123")).status, 401); // old password is dead
  assert.equal((await login("staff1", "NewStaffPass1")).status, 200);
});

test("resetting a colleague's password signs them out; you cannot reset your own this way", async () => {
  assert.equal((await call(owner, `/api/admin/admins/${staffId}/password`, "PUT", { newPassword: "short" })).status, 400);
  assert.equal((await call(owner, "/api/admin/admins/99999/password", "PUT", { newPassword: "ResetPass1234" })).status, 404);
  assert.equal((await call(owner, `/api/admin/admins/${staffId}/password`, "PUT", { newPassword: "ResetPass1234" })).status, 200);
  assert.equal((await call(staffA, "/api/admin/me")).status, 401);
  assert.equal((await login("staff1", "NewStaffPass1")).status, 401);
  staffA = (await login("staff1", "ResetPass1234")).cookie;
  assert.ok(staffA);
  const me = await (await call(owner, "/api/admin/me")).json();
  assert.equal((await call(owner, `/api/admin/admins/${me.id}/password`, "PUT", { newPassword: "ResetPass1234" })).status, 400);
});

test("deleting an admin logs them out at once; you cannot delete yourself", async () => {
  const me = await (await call(owner, "/api/admin/me")).json();
  assert.equal((await call(owner, `/api/admin/admins/${me.id}`, "DELETE")).status, 400);
  assert.equal((await call(owner, `/api/admin/admins/${staffId}`, "DELETE")).status, 200);
  assert.equal((await call(staffA, "/api/admin/applications")).status, 401); // their session died with the account
  assert.equal((await call(owner, `/api/admin/admins/${staffId}`, "DELETE")).status, 404);
  assert.equal((await login("staff1", "ResetPass1234")).status, 401);
  assert.equal((await call(owner, "/api/admin/admins")).status, 200); // the owner is unaffected
});
