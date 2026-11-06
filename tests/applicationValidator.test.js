const test = require("node:test");
const assert = require("node:assert/strict");
const { MIN_AMOUNT } = require("../backend/config/loanRules");
const { validateApplication, validateTermsQuery, normalisePhone, normaliseNrc } = require("../backend/validators/applicationValidator");

const good = { name: "Jane Banda", phone: "0971234567", amount: "5,000", period: "2 weeks", collateralType: "Vehicle", acceptedTerms: true,
  nrc: "123456/78/1", location: "Kabwe, Bwacha" };

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
  const { errors } = validateApplication({ name: "<b>", phone: "1", amount: MIN_AMOUNT - 1, period: "3 months" });
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

test("public applicants must accept the terms (admin edits are exempt)", () => {
  const { acceptedTerms, ...without } = good;
  assert.ok(validateApplication(without).errors.acceptedTerms);
  assert.ok(validateApplication({ ...good, acceptedTerms: "yes" }).errors.acceptedTerms); // must be exactly true
  assert.equal(validateApplication({ ...without, status: "new" }, { admin: true }).errors.acceptedTerms, undefined);
});

test("NRC: typed with or without slashes, spaces or dashes, saved as 123456/78/1", () => {
  for (const typed of ["123456/78/1", "123456781", "123456 78 1", "123456-78-1", " 123456/78/1 "])
    assert.equal(validateApplication({ ...good, nrc: typed }).value.nrc, "123456/78/1", typed);
  assert.equal(normaliseNrc("123456781"), "123456/78/1");
});
test("NRC: wrong shapes are rejected", () => {
  for (const bad of ["12345/78/1", "1234567/78/1", "abcdef/78/1", "123456/78", "", undefined, null, 123456781234])
    assert.ok(validateApplication({ ...good, nrc: bad }).errors.nrc, String(bad));
});
test("location: 2 to 100 characters, spaces tidied", () => {
  assert.equal(validateApplication({ ...good, location: "  Kabwe,   Bwacha " }).value.location, "Kabwe, Bwacha");
  for (const bad of ["", " ", "K", "x".repeat(101), undefined, 5]) assert.ok(validateApplication({ ...good, location: bad }).errors.location, String(bad));
});
test("NRC and location are required from the public form but optional in admin edits (older records)", () => {
  const { nrc, location, ...without } = good;
  const errors = validateApplication(without).errors;
  assert.ok(errors.nrc && errors.location);
  const admin = validateApplication({ ...without, status: "new" }, { admin: true });
  assert.equal(admin.errors.nrc, undefined);
  assert.equal(admin.errors.location, undefined);
  assert.deepEqual([admin.value.nrc, admin.value.location], ["", ""]);
  assert.ok(validateApplication({ ...without, nrc: "bad", status: "new" }, { admin: true }).errors.nrc); // but a wrong NRC is still refused
});
