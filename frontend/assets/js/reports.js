// The "Reports" window: profit for any dates, plus the expenses and losses that it subtracts.
// Reuses $, formatMoney, formatDate, plural (common.js) and api() (dashboard.js). Classic scripts share one global scope.
let repToday = null;   // today's date from the server (Zambia time), used for the quick buttons

const signedMoney = (n) => (n < 0 ? "-" + formatMoney(-n) : formatMoney(n));
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => d.toISOString().slice(0, 10);

function repSay(text, isError) {
  $("repMsg").textContent = text;
  $("repMsg").style.color = isError ? "var(--err)" : "";
}

function mk(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined && text !== null && text !== "") e.textContent = text; // textContent, never innerHTML
  if (className) e.className = className;
  return e;
}

// The ranges behind This week, This month, Last month and This year
function presetRange(name) {
  const t = new Date(repToday + "T00:00:00Z"), y = t.getUTCFullYear(), m = t.getUTCMonth();
  if (name === "week") return [isoOf(new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000)), repToday]; // Monday to today
  if (name === "month") return [`${y}-${pad2(m + 1)}-01`, repToday];
  if (name === "lastMonth") return [isoOf(new Date(Date.UTC(y, m - 1, 1))), isoOf(new Date(Date.UTC(y, m, 0)))];
  return [`${y}-01-01`, repToday];
}

async function loadReport(useDefault) {
  const q = new URLSearchParams();
  if (!useDefault) { if ($("repFrom").value) q.set("from", $("repFrom").value); if ($("repTo").value) q.set("to", $("repTo").value); }
  try {
    const r = await api("/api/admin/reports/profit?" + q);
    repToday = r.today;
    $("repFrom").value = r.from; $("repTo").value = r.to;
    $("repCsv").href = `/api/admin/reports/profit.csv?from=${r.from}&to=${r.to}`;
    repSay("");
    renderReport(r);
    loadExpenses(r.from, r.to);
  } catch (err) { repSay(err.message, true); }
}

function renderReport(r) {
  const cards = [
    ["Money given out", formatMoney(r.moneyGiven.total), plural(r.moneyGiven.count, "loan")],
    ["Collected from customers", formatMoney(r.collected.total), plural(r.collected.count, "loan") + " repaid"],
    ["Interest collected", signedMoney(r.interestCollected), `agreed: ${formatMoney(r.interestAgreed)}`],
    ["Expenses", formatMoney(r.expenses), ""],
    ["Losses", formatMoney(r.losses), ""],
    ["PROFIT", signedMoney(r.profit), "interest - expenses - losses", r.profit < 0 ? "loss" : "profit"],
    ["Interest expected", formatMoney(r.expected.interest), `${plural(r.expected.count, "loan")} still out on ${formatDate(r.to)}`],
    ["Overdue right now", formatMoney(r.overdueNow.total), plural(r.overdueNow.count, "loan")],
    ["Net cash", signedMoney(r.netCash), "collected - given - expenses"],
  ];
  const box = $("repCards");
  box.replaceChildren();
  cards.forEach(([label, value, sub, cls]) => {
    const c = mk("div", null, "rep-card" + (cls ? " " + cls : ""));
    c.append(mk("span", label), mk("b", value), mk("small", sub));
    box.append(c);
  });

  const notes = $("repNotes");
  notes.replaceChildren();
  if (r.undatedRepaid > 0)
    notes.append(mk("p", `${plural(r.undatedRepaid, "repaid loan")} ${r.undatedRepaid === 1 ? "has" : "have"} no dates, so this report cannot count ${r.undatedRepaid === 1 ? "it" : "them"}. Press Edit on ${r.undatedRepaid === 1 ? "that loan" : "those loans"} to add the dates.`, "rep-warn"));
  if (r.cancelledWithMoney.count > 0)
    notes.append(mk("p", `${plural(r.cancelledWithMoney.count, "loan")} cancelled in these dates had money given (${formatMoney(r.cancelledWithMoney.total)}). If that money will not come back, add it below as a Loss.`, "rep-warn"));

  fillTable($("repMonths"), ["Month", "Given", "Collected", "Interest", "Expenses", "Losses", "Profit"],
    r.months.map((m) => [m.month, formatMoney(m.given), formatMoney(m.collected), signedMoney(m.interestCollected), formatMoney(m.expenses), formatMoney(m.losses), signedMoney(m.profit)]));
  fillTable($("repPeriods"), ["Repayment period", "Loans repaid", "Interest collected"],
    r.byPeriod.length ? r.byPeriod.map((p) => [p.period, String(p.count), signedMoney(p.interest)]) : [["No loans repaid in these dates", "", ""]]);
  $("repBody").hidden = false;
}

function fillTable(table, headers, rows) {
  table.replaceChildren();
  const head = mk("tr");
  headers.forEach((h) => head.append(mk("th", h)));
  const thead = mk("thead"); thead.append(head);
  const tbody = mk("tbody");
  rows.forEach((row) => { const tr = mk("tr"); row.forEach((v, i) => tr.append(mk("td", v, i > 0 ? "num" : ""))); tbody.append(tr); });
  table.append(thead, tbody);
}

// ---------- expenses and losses ----------
async function loadExpenses(from, to) {
  try {
    const list = $("expList");
    const items = await api(`/api/admin/expenses?from=${from}&to=${to}`);
    list.replaceChildren();
    if (!items.length) { list.append(mk("li", "Nothing recorded for these dates.")); return; }
    items.forEach((e) => {
      const li = mk("li");
      const loan = e.loan_id ? ` (loan #${e.loan_id}${e.loan_name ? " " + e.loan_name : ""})` : "";
      li.append(mk("span", `${formatDate(e.spent_on)}: ${e.kind === "loss" ? "Loss" : "Expense"}, ${e.description}${loan}, ${formatMoney(e.amount)}`));
      const del = mk("button", "Delete", "btn danger small");
      del.type = "button";
      del.addEventListener("click", () => removeExpense(e));
      li.append(del);
      list.append(li);
    });
  } catch (err) { repSay(err.message, true); }
}

async function removeExpense(e) {
  if (!confirm(`Delete this entry?\n${e.description}, ${formatMoney(e.amount)}`)) return;
  try { await api("/api/admin/expenses/" + e.id, { method: "DELETE" }); loadReport(false); }
  catch (err) { repSay(err.message, true); }
}

$("expForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/expenses", { method: "POST", body: JSON.stringify({
      spentOn: $("expDate").value, kind: $("expKind").value, description: $("expDesc").value, amount: $("expAmount").value, loanId: $("expLoan").value }) });
    $("expForm").reset();
    repSay("Saved.");
    loadReport(false);          // the new entry changes the numbers
  } catch (err) { repSay(err.message, true); }
});

$("reportsBtn").addEventListener("click", () => { repSay(""); $("reportDialog").showModal(); loadReport(true); });
$("repShow").addEventListener("click", () => loadReport(false));
$("repClose").addEventListener("click", () => $("reportDialog").close());
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  if (!repToday) return;
  [$("repFrom").value, $("repTo").value] = presetRange(b.dataset.preset);
  loadReport(false);
}));
