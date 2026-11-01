// Pure calculation and date helpers. No database, no Express, so they are easy to test.
const env = require("../config/env");
const { TERMS } = require("../config/loanRules");

const round2 = (n) => Math.round(n * 100) / 100;
const dateInTZ = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: env.timezone }); // YYYY-MM-DD
const createdDate = (row) => dateInTZ(new Date(row.created_at.replace(" ", "T") + "Z"));

function isValidDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso, n) { // Jan 31 + 1 month = Feb 28 (never spills into March)
  const [y, m, day] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
const daysBetween = (fromIso, toIso) =>
  Math.round((new Date(toIso + "T00:00:00Z") - new Date(fromIso + "T00:00:00Z")) / 86400000);

function calculateLoan(amount, period, startDate = dateInTZ()) {
  const t = TERMS[period];
  if (!t) return null;
  const interestAmount = round2((amount * t.rate) / 100);
  return {
    amount, period,
    interestRate: t.rate,
    interestAmount,
    totalRepayment: round2(amount + interestAmount),
    startDate,
    dueDate: t.days ? addDays(startDate, t.days) : addMonths(startDate, t.months),
  };
}

// Overdue = approved, not yet repaid, and the due date is before today.
function decorateOverdue(row) {
  const today = dateInTZ();
  const overdue = row.status === "approved" && row.due_date !== "" && row.due_date < today;
  return { ...row, overdue, days_overdue: overdue ? daysBetween(row.due_date, today) : 0 };
}

module.exports = { round2, dateInTZ, createdDate, isValidDate, addDays, addMonths, daysBetween, calculateLoan, decorateOverdue };
