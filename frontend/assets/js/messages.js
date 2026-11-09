// The "Messages" window for an approved loan:
//   1. write the approval message   2. record that the collateral arrived   3. write the receipt message
// Every message can be edited before it opens in WhatsApp, and every sent message is logged.
// Reuses $ and formatDate (common.js), and api() and load() (dashboard.js). Classic scripts share one global scope.
let loanRow = null;    // the application the window is about
let draftKind = null;  // "approval" or "receipt": which message is in the text box

function loanSay(text, isError) {
  $("loanMsg").textContent = text;
  $("loanMsg").style.color = isError ? "var(--err)" : "";
}

function el(tag, text, className) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;     // textContent, never innerHTML, so submitted text cannot run as code
  if (className) e.className = className;
  return e;
}

function openLoanDialog(row) {
  loanRow = row;
  draftKind = null;
  $("loanTitle").textContent = `Loan #${row.id}: ${row.name}`;
  $("draftBox").hidden = true;
  $("fallbackLink").hidden = true;
  loanSay("");
  renderLoan();
  $("loanDialog").showModal();
  loadSent();
}

function renderLoan() {
  const r = loanRow, box = $("collateralBox");
  box.replaceChildren();
  $("draftApproval").disabled = r.status !== "approved";
  $("draftReceipt").disabled = !r.collateral_received_at;

  if (r.collateral_received_at) {
    box.append(el("p", `Collateral received on ${formatDate(r.collateral_received_at)}. The repayment date is ${formatDate(r.due_date)}.` +
      (r.collateral_notes ? ` Notes: ${r.collateral_notes}` : "")));
    const link = el("a", "Open the receipt");
    link.href = "/receipt/" + r.receipt_token; link.target = "_blank"; link.rel = "noopener";
    const undo = el("button", "Undo (recorded by mistake)", "btn danger small");
    undo.type = "button";
    undo.addEventListener("click", () => setCollateral(false));
    box.append(link, undo);
  } else if (r.status === "approved") {
    const label = el("label", null, "field");
    label.htmlFor = "collNotes";
    label.append(el("span", "Collateral notes (serial number, plate number, condition)"));
    const input = el("input"); input.id = "collNotes"; input.type = "text"; input.maxLength = 300;
    label.append(input);
    const save = el("button", "Collateral received", "btn small");
    save.type = "button";
    save.addEventListener("click", () => setCollateral(true));
    box.append(label, save, el("p", "Pressing this starts the repayment clock today and creates the receipt.", "hint"));
  } else {
    box.append(el("p", "Approve the loan first.", "hint"));
  }
  renderMoney();
}

// Step 3: the day the money was handed to the customer. It comes after the collateral.
function renderMoney() {
  const r = loanRow, box = $("moneyBox");
  box.replaceChildren();
  if (r.money_given_on) {
    box.append(el("p", `Money given on ${formatDate(r.money_given_on)}.`));
    if (r.status === "approved") {
      const undo = el("button", "Undo (recorded by mistake)", "btn danger small");
      undo.type = "button";
      undo.addEventListener("click", () => setMoney(false));
      box.append(undo);
    }
  } else if (r.status === "approved" && r.collateral_received_at) {
    const label = el("label", null, "field");
    label.htmlFor = "moneyDate";
    label.append(el("span", "Date the money was given (leave empty for today)"));
    const input = el("input"); input.id = "moneyDate"; input.type = "date";
    label.append(input);
    const save = el("button", "Money given", "btn small");
    save.type = "button";
    save.addEventListener("click", () => setMoney(true));
    box.append(label, save, el("p", "Saves the day you handed the money to the customer.", "hint"));
  } else {
    box.append(el("p", r.status === "approved" ? "Record that the collateral was received first." : "Approve the loan first.", "hint"));
  }
}

async function setMoney(given) {
  if (!given && !confirm("Undo the money given record?")) return;
  try {
    const date = given ? $("moneyDate").value : "";
    loanRow = await api(`/api/admin/applications/${loanRow.id}/money-given`, { method: "POST", body: JSON.stringify({ given, date }) });
    renderLoan();
    loanSay(given ? "Money given recorded." : "The money given record was removed.");
    load();       // refresh the table behind the window
  } catch (err) { loanSay(err.message, true); }
}

async function setCollateral(received) {
  if (!received && !confirm("Undo the collateral record? The receipt link will stop working until you record it again.")) return;
  try {
    const notes = received ? $("collNotes").value : "";
    loanRow = await api(`/api/admin/applications/${loanRow.id}/collateral-received`, { method: "POST", body: JSON.stringify({ received, notes }) });
    renderLoan();
    $("draftBox").hidden = true;
    loanSay(received ? "Collateral recorded. The repayment clock started today." : "The collateral record was removed.");
    load();       // refresh the table behind the window
    loadSent();
  } catch (err) { loanSay(err.message, true); }
}

async function draft(kind) {
  try {
    const d = await api(`/api/admin/applications/${loanRow.id}/message?kind=${kind}`);
    draftKind = kind;
    $("draftLabel").textContent = kind === "approval" ? "Approval message (you can edit it)" : "Receipt message (you can edit it)";
    $("draftText").value = d.text;
    $("draftPhone").textContent = d.phone;
    $("fallbackLink").hidden = true;
    $("draftBox").hidden = false;
    loanSay("");
    renderSent(d.history);
  } catch (err) { loanSay(err.message, true); }
}

function renderSent(history) {
  const list = $("sentList");
  list.replaceChildren();
  if (!history.length) { list.append(el("li", "Nothing sent yet.")); return; }
  history.forEach((m) => list.append(el("li",
    `${m.kind === "approval" ? "Approval" : "Receipt"} message, ${new Date(m.created_at).toLocaleString()}, by ${m.admin_username}`)));
}

// The list of sent messages comes with a draft, so ask for whichever draft is possible for this loan.
async function loadSent() {
  try {
    const kind = loanRow.status === "approved" && !loanRow.collateral_received_at ? "approval" : "receipt";
    renderSent((await api(`/api/admin/applications/${loanRow.id}/message?kind=${kind}`)).history);
  } catch { renderSent([]); }
}

$("draftApproval").addEventListener("click", () => draft("approval"));
$("draftReceipt").addEventListener("click", () => draft("receipt"));

$("sendDraft").addEventListener("click", async () => {
  const win = window.open("", "_blank");   // opened straight away so the browser does not block it
  if (win) win.opener = null;
  try {
    const out = await api(`/api/admin/applications/${loanRow.id}/messages`, {
      method: "POST", body: JSON.stringify({ kind: draftKind, text: $("draftText").value }),
    });
    if (win) win.location.href = out.url;
    else { $("fallbackLink").href = out.url; $("fallbackLink").hidden = false; }
    loanSay("Message logged. Press Send inside WhatsApp.");
    loadSent();
  } catch (err) {
    if (win) win.close();
    loanSay(err.message, true);
  }
});

$("closeLoan").addEventListener("click", () => $("loanDialog").close());
