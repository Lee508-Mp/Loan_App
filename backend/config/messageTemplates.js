// THE WORDING OF THE MESSAGES. Change the text here and restart. Staff can still edit each message before sending it.
const { COMPANY_NAME } = require("./loanRules");

const money = (n) => "K" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const day = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const firstName = (row) => (row.name || "").split(" ")[0] || "there";
const collateral = (row) => row.collateral_type + (row.collateral_details ? ` (${row.collateral_details})` : "");
const rate = (row) => `${row.interest_rate}%` + (row.negotiated_rate != null ? " (the rate we agreed with you)" : "");

// Sent when the loan is approved and the collateral has been accepted.
function approval(row) {
  return [
    `Hello ${firstName(row)}, good news from ${COMPANY_NAME}. Your loan application (Ref #${row.id}) has been approved.`,
    "",
    `Amount you are borrowing: ${money(row.amount)}`,
    `Interest rate: ${rate(row)}`,
    `Interest: ${money(row.interest_amount)}`,
    `Total you will repay: ${money(row.total_repayment)}`,
    `Repayment period: ${row.period}`,
    `Collateral accepted: ${collateral(row)}`,
    "",
    "The money will be given to you once you deliver the collateral to us. Your repayment date will be confirmed on your receipt when we receive it.",
    "",
    "Thank you,",
    COMPANY_NAME,
  ].join("\n");
}

// Sent after the collateral has been received. Contains the link to the customer's receipt.
function receipt(row, { link, receiptNumber }) {
  return [
    `Hello ${firstName(row)}, we have received your collateral (${collateral(row)}) for loan Ref #${row.id}. Thank you.`,
    "",
    `Your receipt ${receiptNumber}: ${link}`,
    "",
    `Amount borrowed: ${money(row.amount)}`,
    `Interest rate: ${rate(row)}`,
    `Total to repay: ${money(row.total_repayment)}`,
    `Repay by: ${day(row.due_date)}`,
    "",
    COMPANY_NAME,
  ].join("\n");
}

module.exports = { approval, receipt };
