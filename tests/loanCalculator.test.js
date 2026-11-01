const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateLoan, addMonths, addDays, daysBetween, isValidDate, decorateOverdue } = require("../backend/services/loanCalculator");

test("1 week: flat 5%, due 7 days later", () => {
  const t = calculateLoan(1000, "1 week", "2026-10-20");
  assert.deepEqual([t.interestRate, t.interestAmount, t.totalRepayment, t.dueDate], [5, 50, 1050, "2026-10-27"]);
});
test("3 weeks: 12%, due 21 days later", () => {
  const t = calculateLoan(2000, "3 weeks", "2026-10-20");
  assert.deepEqual([t.interestAmount, t.totalRepayment, t.dueDate], [240, 2240, "2026-11-10"]);
});
test("1 month uses a calendar month", () => {
  assert.equal(calculateLoan(1000, "1 month", "2026-10-20").dueDate, "2026-11-20");
});
test("unknown period gives null", () => assert.equal(calculateLoan(1000, "5 years"), null));
test("month-end never spills over", () => {
  assert.equal(addMonths("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonths("2026-12-15", 12), "2027-12-15");
});
test("date helpers", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(daysBetween("2026-10-01", "2026-10-11"), 10);
  assert.ok(isValidDate("2026-02-28"));
  assert.ok(!isValidDate("2026-02-30"));
  assert.ok(!isValidDate("10/10/2026"));
});
test("overdue only when approved and past due", () => {
  assert.equal(decorateOverdue({ status: "approved", due_date: "2020-01-01" }).overdue, true);
  assert.equal(decorateOverdue({ status: "repaid", due_date: "2020-01-01" }).overdue, false);
  assert.equal(decorateOverdue({ status: "approved", due_date: "2999-01-01" }).overdue, false);
  assert.equal(decorateOverdue({ status: "new", due_date: "" }).overdue, false);
});
