// SERVICE: the profit report. It only adds up what the database holds, using the dates and amounts recorded on each loan.
//   Interest collected = what customers paid back on loans repaid in the range, minus the money that was given on those loans.
//   Profit             = interest collected - expenses - losses.
// Interest is counted when it is PAID (cash basis), so interest on unpaid loans is shown separately as "expected".
const Application = require("../models/Application");
const Expense = require("../models/Expense");
const Report = require("../models/Report");
const { dateInTZ, daysBetween, isValidDate, round2 } = require("./loanCalculator");

const MAX_DAYS = 1830; // about 5 years

const defaultRange = (today) => ({ from: today.slice(0, 8) + "01", to: today }); // this month so far

// Returns { from, to } or { error }
function parseRange(query = {}, today = dateInTZ()) {
  const def = defaultRange(today);
  const from = query.from ? String(query.from) : def.from;
  const to = query.to ? String(query.to) : def.to;
  if (!isValidDate(from) || !isValidDate(to)) return { error: "Enter valid From and To dates." };
  if (from > to) return { error: "The From date must not be after the To date." };
  if (daysBetween(from, to) > MAX_DAYS) return { error: "Choose a range of 5 years or less." };
  return { from, to };
}

// ["2026-03", "2026-04", ...] for every month the range touches
function monthsBetween(from, to) {
  const out = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ey, em] = to.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function buildProfitReport(from, to, today = dateInTZ()) {
  const given = Report.given(from, to);
  const repaid = Report.repaid(from, to);
  const kinds = Object.fromEntries(Expense.totals(from, to).map((r) => [r.kind, r]));
  const expenses = round2(kinds.expense?.total || 0);
  const losses = round2(kinds.loss?.total || 0);

  const interestCollected = round2(repaid.collected - repaid.principal);
  const profit = round2(interestCollected - expenses - losses);

  const overdue = Application.findOverdue(today);
  const outstanding = Report.outstanding(to);
  const cancelled = Report.cancelled(from, to);

  // Month by month
  const rows = Object.fromEntries(monthsBetween(from, to).map((m) => [m, { month: m, given: 0, collected: 0, interestCollected: 0, expenses: 0, losses: 0, profit: 0 }]));
  Report.givenByMonth(from, to).forEach((r) => { rows[r.month].given = round2(r.total); });
  Report.repaidByMonth(from, to).forEach((r) => { rows[r.month].collected = round2(r.collected); rows[r.month].interestCollected = round2(r.collected - r.principal); });
  Expense.byMonth(from, to).forEach((r) => { rows[r.month][r.kind === "loss" ? "losses" : "expenses"] = round2(r.total); });
  const months = Object.values(rows).map((r) => ({ ...r, profit: round2(r.interestCollected - r.expenses - r.losses) }));

  return {
    from, to,
    moneyGiven: { count: given.count, total: round2(given.total) },
    collected: { count: repaid.count, total: round2(repaid.collected) },
    interestCollected,
    interestAgreed: round2(repaid.agreed),              // what the loans were supposed to earn. Compare it with interestCollected
    expenses, losses, profit,
    netCash: round2(repaid.collected - given.total - expenses), // cash in minus cash out (losses are not extra cash out)
    expected: { count: outstanding.count, principal: round2(outstanding.principal), interest: round2(outstanding.interest), total: round2(outstanding.total) },
    overdueNow: { count: overdue.length, total: round2(overdue.reduce((sum, r) => sum + r.total_repayment, 0)) },
    cancelledWithMoney: { count: cancelled.count, total: round2(cancelled.total) },
    undatedRepaid: Report.undatedRepaid(),
    months,
    byPeriod: Report.byPeriod(from, to).map((r) => ({ period: r.period, count: r.count, principal: round2(r.principal), interest: round2(r.interest) })),
  };
}

// ---------- CSV for your accountant ----------
// Text that starts with = + - @ could run as a formula in Excel, so it gets a ' in front. Numbers are written as they are.
const cell = (v) => {
  if (typeof v === "number") return String(v);
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (...cells) => cells.map(cell).join(",");

function toCsv(r, today = dateInTZ()) {
  const out = [
    line("Profit report"), line("From", r.from), line("To", r.to), line("Created", today), "",
    line("Summary", "Amount (K)"),
    line("Money given out", r.moneyGiven.total), line("Loans given (number)", r.moneyGiven.count),
    line("Collected from customers", r.collected.total), line("Loans repaid (number)", r.collected.count),
    line("Interest collected", r.interestCollected), line("Interest that was agreed on those loans", r.interestAgreed),
    line("Expenses", r.expenses), line("Losses", r.losses), line("PROFIT", r.profit),
    line("Net cash (collected - given - expenses)", r.netCash),
    line("Interest expected from loans still out", r.expected.interest), line("Loans still out (number)", r.expected.count),
    line("Overdue right now (total to repay)", r.overdueNow.total), "",
    line("Month by month"), line("Month", "Money given", "Collected", "Interest collected", "Expenses", "Losses", "Profit"),
    ...r.months.map((m) => line(m.month, m.given, m.collected, m.interestCollected, m.expenses, m.losses, m.profit)), "",
    line("Loans repaid in this period"), line("Ref", "Name", "Money given on", "Repaid on", "Amount given", "Amount paid", "Interest collected"),
    ...Report.repaidLoans(r.from, r.to).map((l) => line(l.id, l.name, l.money_given_on, l.repaid_on, l.amount, l.amount_paid, round2(l.amount_paid - l.amount))), "",
    line("Money given in this period"), line("Ref", "Name", "Money given on", "Amount"),
    ...Report.givenLoans(r.from, r.to).map((l) => line(l.id, l.name, l.money_given_on, l.amount)), "",
    line("Expenses and losses"), line("Date", "Type", "Description", "Amount", "Loan ref"),
    ...Expense.list(r.from, r.to).map((e) => line(e.spent_on, e.kind, e.description, e.amount, e.loan_id ?? "")),
  ];
  return "\uFEFF" + out.join("\r\n") + "\r\n"; // the first character helps Excel read the file as UTF-8
}

module.exports = { parseRange, monthsBetween, buildProfitReport, toCsv, MAX_DAYS };
