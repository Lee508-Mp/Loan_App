let rows = [];
let editingId = null;
let editingStandardRate = null;


// One helper for every API call. A 401 means the session ended, so go back to login.
async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (res.status === 401) { window.location.href = "/admin/login"; throw new Error("Session ended."); }
  const body = await res.json();
  if (!res.ok) throw new Error((body.errors && Object.values(body.errors)[0]) || body.error || "Request failed.");
  return body;
}

// Loads the table and the alerts together. Runs on page load, on filter changes, and every minute.
async function load() {
  const q = new URLSearchParams({ search: $("search").value.trim(), status: $("statusFilter").value });
  try {
    const [list, alerts] = await Promise.all([api("/api/admin/applications?" + q), api("/api/admin/alerts")]);
    rows = list;
    $("pageErr").textContent = "";
    render();
    renderAlerts(alerts);
  } catch (err) { $("pageErr").textContent = err.message; }
}

function renderAlerts(a) {
  const n = a.overdue.length;
  document.title = (n ? `(${n}) ` : "") + "Dashboard | Copperline Admin";   // count shows on the browser tab
  const waiting = a.awaitingCollateral || [];
  $("alertBar").hidden = n === 0 && a.dueSoon.length === 0 && waiting.length === 0;
  $("alertBar").classList.toggle("danger", n > 0);
  $("alertTitle").textContent = n
    ? `${plural(n, "overdue loan")}, ${formatMoney(a.overdueTotal)} owed`
    : "Nothing overdue";
  const list = $("alertList");
  list.replaceChildren();
  a.overdue.slice(0, 5).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `#${r.id} ${r.name} (${r.phone}) owes ${formatMoney(r.total_repayment)}, due ${formatDate(r.due_date)}, ${plural(r.days_overdue, "day")} overdue`;
    list.append(li);
  });
  if (n > 5) { const li = document.createElement("li"); li.textContent = `and ${n - 5} more`; list.append(li); }
  $("soonNote").textContent = [
    a.dueSoon.length ? `Due in the next 3 days: ${a.dueSoon.map((r) => `${r.name} (${formatDate(r.due_date)})`).join(", ")}` : "",
    waiting.length ? `Approved, waiting for collateral: ${waiting.map((r) => `${r.name} (#${r.id})`).join(", ")}` : "",
  ].filter(Boolean).join("  |  ");
  $("viewOverdue").hidden = n === 0;
}

function cell(text, cls, tip) {            // textContent (not innerHTML) so submitted text can never run as code
  const td = document.createElement("td");
  td.textContent = text;
  if (cls) td.className = cls;
  if (tip) td.title = tip; // hover to read the collateral details
  return td;
}
function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn small " + cls; b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  const tbody = $("rows");
  tbody.replaceChildren();
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.overdue) tr.className = "overdue";
    tr.append(
      cell("#" + r.id),
      cell(formatDate(r.created_at.slice(0, 10))),
      cell(r.name), cell(r.phone),
      cell(`${formatMoney(r.amount)} (${r.period})`, "num"),
      cell(`${formatMoney(r.total_repayment)} (${r.interest_rate}%${r.negotiated_rate != null ? ", negotiated" : ""})`, "num"),
      cell(r.status === "approved" && !r.collateral_received_at ? "Awaiting collateral" : formatDate(r.due_date)),
      cell(r.collateral_type || "Not specified", "", r.collateral_details),
      cell(r.contact_method === "email" ? "Email: " + r.email : "WhatsApp")
    );
    const st = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge s-" + (r.overdue ? "overdue" : r.status);
    badge.textContent = r.overdue ? `overdue ${r.days_overdue}d` : r.status;
    st.append(badge);

    const act = document.createElement("td");
    act.className = "row-actions";
    if (r.status === "approved" || r.status === "repaid") act.append(button("Messages", "ghost", () => openLoanDialog(r)));
    if (r.status === "approved") act.append(button("Mark repaid", "ghost", () => markRepaid(r)));
    act.append(button("Edit", "ghost", () => openEdit(r)), button("Delete", "danger", () => remove(r)));

    tr.append(st, act);
    tbody.append(tr);
  });
  $("count").textContent = plural(rows.length, "application");
  $("empty").hidden = rows.length > 0;
}

function openEdit(r) {
  editingId = r.id;
  $("editRef").textContent = "#" + r.id;
  $("eName").value = r.name; $("ePhone").value = r.phone; $("eAmount").value = r.amount;
  $("eNrc").value = r.nrc; $("eLocation").value = r.location;
  $("ePeriod").value = r.period; $("eMethod").value = r.contact_method; $("eEmail").value = r.email;
  $("eCollateral").value = r.collateral_type; $("eCollateralDetails").value = r.collateral_details;
  $("eStatus").value = r.status; $("eDue").value = r.due_date; $("eNotes").value = r.notes;
  editingStandardRate = r.standard_rate; $("eNegRate").value = r.negotiated_rate ?? ""; previewNegotiated();
  $("eTerms").textContent =
    `Now: ${r.interest_rate}% interest, ${formatMoney(r.total_repayment)} to repay. ` +
    `Interest and total change only if you change the amount, the period or the negotiated rate. Approving a loan restarts the due date from today.` +
    (r.terms_version ? ` Accepted Terms v${r.terms_version} on ${formatDate(r.terms_accepted_at.slice(0, 10))}.` : "");
  $("editErr").textContent = "";
  $("editDialog").showModal();
}

$("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/applications/" + editingId, {
      method: "PUT",
      body: JSON.stringify({
        name: $("eName").value, phone: $("ePhone").value, nrc: $("eNrc").value, location: $("eLocation").value, amount: $("eAmount").value,
        period: $("ePeriod").value, contactMethod: $("eMethod").value, email: $("eEmail").value,
        collateralType: $("eCollateral").value, collateralDetails: $("eCollateralDetails").value,
        negotiatedRate: $("eNegRate").value,
        status: $("eStatus").value, dueDate: $("eDue").value, notes: $("eNotes").value,
      }),
    });
    $("editDialog").close();
    load();
  } catch (err) { $("editErr").textContent = err.message; }
});
// Live preview in the Edit window. It is only a preview: the server works out the figures that get saved.
function previewNegotiated() {
  const el = $("eNegPreview");
  const text = $("eNegRate").value.trim();
  if (text === "") {
    el.textContent = editingStandardRate != null ? `Standard rate for the saved period: ${editingStandardRate}%. Leave this box empty to use it.` : "";
    return;
  }
  const rate = Number(text);
  const amount = Number($("eAmount").value.replace(/[,\s]/g, ""));
  if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !Number.isFinite(amount) || amount <= 0) {
    el.textContent = "Enter a rate from 0 to 100 and a valid amount.";
    return;
  }
  const interest = Math.round(amount * rate) / 100;
  el.textContent = `At ${rate}%: interest ${formatMoney(interest)}, total to repay ${formatMoney(Math.round((amount + interest) * 100) / 100)}.`;
}
$("eNegRate").addEventListener("input", previewNegotiated);
$("eAmount").addEventListener("input", previewNegotiated);

$("cancelEdit").addEventListener("click", () => $("editDialog").close());

async function markRepaid(r) {
  if (!confirm(`Mark loan #${r.id} from ${r.name} as repaid?`)) return;
  try {
    await api("/api/admin/applications/" + r.id, {
      method: "PUT",
      body: JSON.stringify({ name: r.name, phone: r.phone, amount: r.amount, period: r.period, status: "repaid", notes: r.notes }),
    });
    load();
  } catch (err) { $("pageErr").textContent = err.message; }
}

async function remove(r) {
  if (!confirm(`Delete application #${r.id} from ${r.name}? This cannot be undone.`)) return;
  try { await api("/api/admin/applications/" + r.id, { method: "DELETE" }); load(); }
  catch (err) { $("pageErr").textContent = err.message; }
}

$("logout").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin/login";
});
$("viewOverdue").addEventListener("click", () => { $("statusFilter").value = "overdue"; load(); });

let timer;
$("search").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 250); });
$("statusFilter").addEventListener("change", load);
load();
setInterval(load, 60000); // automatic re-check every minute while the dashboard is open