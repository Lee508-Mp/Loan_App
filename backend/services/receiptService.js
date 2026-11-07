// SERVICE: recording that the collateral arrived, and the customer's receipt.
const crypto = require("crypto");
const Application = require("../models/Application");
const { COMPANY_NAME, RECEIPT_PREFIX } = require("../config/loanRules");
const { calculateLoan, dateInTZ, decorateOverdue } = require("./loanCalculator");

const receiptNumber = (row) =>
  `${RECEIPT_PREFIX}-${(row.collateral_received_at || dateInTZ()).slice(0, 4)}-${String(row.id).padStart(4, "0")}`;

// 123456/78/1 becomes ******/78/1, so a forwarded receipt does not expose the whole NRC
const maskNrc = (nrc) => (nrc && nrc.length === 11 ? "******/" + nrc.slice(7) : "");

// received true: the collateral arrived today. The repayment clock starts now (only the first time).
// received false: undo a mistake. The receipt link stops working until it is marked received again.
function markCollateral(existing, { received, notes }) {
  const cleanNotes = typeof notes === "string" ? notes.replace(/\s+/g, " ").trim() : "";
  if (cleanNotes.length > 300) return { status: 400, error: "Notes must be 300 characters or fewer." };

  if (!received) {
    Application.setCollateral(existing.id, { receivedAt: "", notes: "", token: existing.receipt_token, dueDate: existing.due_date });
    return { row: decorateOverdue(Application.findById(existing.id)) };
  }
  if (existing.status !== "approved") return { status: 400, error: "Approve the loan before recording the collateral." };

  const already = Boolean(existing.collateral_received_at);
  const receivedAt = already ? existing.collateral_received_at : dateInTZ();
  const dueDate = already ? existing.due_date : calculateLoan(existing.amount, existing.period, receivedAt).dueDate;
  Application.setCollateral(existing.id, {
    receivedAt, notes: cleanNotes, dueDate,
    token: existing.receipt_token || crypto.randomBytes(24).toString("hex"), // 48 hex characters: impossible to guess
  });
  return { row: decorateOverdue(Application.findById(existing.id)) };
}

// Only what the customer should see. No admin notes, no email, no full NRC.
function receiptFor(row) {
  return {
    company: COMPANY_NAME,
    receiptNumber: receiptNumber(row),
    reference: row.id,
    issuedOn: row.collateral_received_at,
    customerName: row.name,
    nrc: maskNrc(row.nrc),
    location: row.location,
    amount: row.amount,
    period: row.period,
    interestRate: row.interest_rate,
    negotiated: row.negotiated_rate != null,
    interestAmount: row.interest_amount,
    totalRepayment: row.total_repayment,
    dueDate: row.due_date,
    collateralType: row.collateral_type,
    collateralDetails: row.collateral_details,
    collateralNotes: row.collateral_notes,
  };
}

function findReceipt(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token)) return null;
  const row = Application.findByReceiptToken(token);
  return row && row.collateral_received_at ? receiptFor(row) : null;
}

module.exports = { receiptNumber, maskNrc, markCollateral, findReceipt };
