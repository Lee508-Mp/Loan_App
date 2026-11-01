const test = require("node:test");
const assert = require("node:assert/strict");
const { validateApplication, validateTermsQuery, normalisePhone } = require("../backend/validators/applicationValidator");

const good = { name: "Jane Banda", phone: "0971234567", amount: "5,000", period: "2 weeks", collateralType: "Vehicle" };

test("a good application passes and is cleaned", () => {
  const { errors, value } = validateApplication(good);
  assert.deepEqual(errors, {});
  assert.equal(value.amount, 5000);
  assert.equal(value.phone, "+260971234567");
  assert.equal(value.contactMethod, "whatsapp"); // default
});
test("phone formats", () => {
  assert.equal(normalisePhone("+260 97 123 4567"), "+260971234567");
  assert.equal(normalisePhone("260971234567"), "+260971234567");
  assert.equal(normalisePhone("12345"), null);
});
test("rejects bad amount, name, period and missing collateral", () => {
  const { errors } = validateApplication({ name: "<b>", phone: "1", amount: 100, period: "3 months" });
  for (const k of ["amount", "name", "phone", "period", "collateralType"]) assert.ok(errors[k], k);
});
test("email route needs a valid email", () => {
  assert.ok(validateApplication({ ...good, contactMethod: "email" }).errors.email);
  assert.deepEqual(validateApplication({ ...good, contactMethod: "email", email: "A@B.co" }).errors, {});
});
test("unknown contact method is rejected", () => {
  assert.ok(validateApplication({ ...good, contactMethod: "sms" }).errors.contactMethod);
});
test("admin mode needs a valid status and due date", () => {
  assert.ok(validateApplication(good, { admin: true }).errors.status);
  assert.ok(validateApplication({ ...good, status: "approved", dueDate: "2026-13-45" }, { admin: true }).errors.dueDate);
  assert.deepEqual(validateApplication({ ...good, status: "approved" }, { admin: true }).errors, {});
});
test("calculator query", () => {
  assert.deepEqual(validateTermsQuery({ amount: "1,000", period: "1 week" }), { amount: 1000, period: "1 week" });
  assert.equal(validateTermsQuery({ amount: "50", period: "1 week" }), null);
  assert.equal(validateTermsQuery({ amount: "1000", period: "9 years" }), null);
  assert.equal(validateTermsQuery(), null);
});
