// The customer's receipt. The secret token is the last part of the address: /receipt/<token>
const token = window.location.pathname.split("/").filter(Boolean).pop();

function show(id, text) { $(id).textContent = text; }

async function loadReceipt() {
  try {
    const res = await fetch("/api/receipts/" + encodeURIComponent(token));
    if (!res.ok) throw new Error("This receipt link is not valid. Please check the link you were sent.");
    const r = await res.json();

    document.title = `Receipt ${r.receiptNumber}`;
    show("company", r.company);
    show("receiptNumber", r.receiptNumber);
    show("issuedOn", formatDate(r.issuedOn));
    show("reference", "#" + r.reference);
    show("customerName", r.customerName);
    show("nrc", r.nrc || "Not recorded");
    show("location", r.location || "Not recorded");
    show("amount", formatMoney(r.amount));
    show("period", r.period);
    show("interestRate", r.interestRate + "%" + (r.negotiated ? " (the rate agreed with you)" : ""));
    show("interestAmount", formatMoney(r.interestAmount));
    show("totalRepayment", formatMoney(r.totalRepayment));
    show("dueDate", formatDate(r.dueDate));
    show("collateralType", r.collateralType || "Not recorded");
    if (r.collateralDetails) { show("collateralDetails", r.collateralDetails); $("detailsRow").hidden = false; }
    if (r.collateralNotes) { show("collateralNotes", r.collateralNotes); $("notesRow").hidden = false; }

    $("status").hidden = true;
    $("receipt").hidden = false;
  } catch (err) {
    $("status").textContent = err.message;
    $("status").style.color = "var(--err)";
  }
}

$("printBtn").addEventListener("click", () => window.print());
loadReceipt();
