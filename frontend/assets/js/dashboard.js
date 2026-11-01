let rows = [];
let editingId = null;


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
  $("alertBar").hidden = n === 0 && a.dueSoon.length === 0;
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
  $("soonNote").textContent = a.dueSoon.length
    ? `Due in the next 3 days: ${a.dueSoon.map((r) => `${r.name} (${formatDate(r.due_date)})`).join(", ")}`
    : "";
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
      cell(`${formatMoney(r.total_repayment)} (${r.interest_rate}%)`, "num"),
      cell(formatDate(r.due_date)),
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
  $("ePeriod").value = r.period; $("eMethod").value = r.contact_method; $("eEmail").value = r.email;
  $("eCollateral").value = r.collateral_type; $("eCollateralDetails").value = r.collateral_details;
  $("eStatus").value = r.status; $("eDue").value = r.due_date; $("eNotes").value = r.notes;
  $("eTerms").textContent =
    `Now: ${r.interest_rate}% interest, ${formatMoney(r.total_repayment)} to repay. ` +
    `Interest and total change only if you change the amount or period. Approving a loan restarts the due date from today.` +
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
        name: $("eName").value, phone: $("ePhone").value, amount: $("eAmount").value,
        period: $("ePeriod").value, contactMethod: $("eMethod").value, email: $("eEmail").value,
        collateralType: $("eCollateral").value, collateralDetails: $("eCollateralDetails").value,
        status: $("eStatus").value, dueDate: $("eDue").value, notes: $("eNotes").value,
      }),
    });
    $("editDialog").close();
    load();
  } catch (err) { $("editErr").textContent = err.message; }
});
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
