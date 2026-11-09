// Two small windows: "Mark repaid" (date and amount paid) and "Cancel loan" (the reason).
// Reuses $, formatMoney (common.js), and api() and load() (dashboard.js). Classic scripts share one global scope.
let lifeRow = null;   // the loan the open window is about

function openRepayDialog(row) {
  lifeRow = row;
  $("repayTitle").textContent = `Mark loan #${row.id} repaid (${row.name})`;
  $("repayTotal").textContent = `Total to repay: ${formatMoney(row.total_repayment)}. Change the amount below if the customer paid a different amount.`;
  $("repayAmount").value = row.total_repayment;
  $("repayDate").value = "";                                   // empty means today
  $("repayGiven").value = "";
  $("repayGivenField").hidden = Boolean(row.money_given_on);   // only older loans without a money given date are asked
  $("repayErr").textContent = "";
  $("repayDialog").showModal();
}

$("repayForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/api/admin/applications/${lifeRow.id}/repayment`, {
      method: "POST",
      body: JSON.stringify({ paidOn: $("repayDate").value, amountPaid: $("repayAmount").value, moneyGivenOn: $("repayGiven").value }),
    });
    $("repayDialog").close();
    load();
  } catch (err) { $("repayErr").textContent = err.message; }
});
$("repayClose").addEventListener("click", () => $("repayDialog").close());

function openCancelDialog(row) {
  lifeRow = row;
  $("cancelTitle").textContent = `Cancel loan #${row.id} (${row.name})`;
  $("cancelReason").value = "";
  $("cancelErr").textContent = "";
  $("cancelDialog").showModal();
}

$("cancelForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api(`/api/admin/applications/${lifeRow.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: $("cancelReason").value }) });
    $("cancelDialog").close();
    load();
  } catch (err) { $("cancelErr").textContent = err.message; }
});
$("cancelClose").addEventListener("click", () => $("cancelDialog").close());
