// SERVICE: the life of a loan after approval: money given, repaid, cancelled.
// One function, resolveLifecycle, holds all the rules. Both the Edit window and the quick buttons use it,
// so the dates and amounts that the profit report relies on always add up.
const Application = require("../models/Application");
const { decorateOverdue, dateInTZ, isValidDate, round2 } = require("./loanCalculator");

const fail = (status, error) => ({ status, error });

// existing = the loan as saved. input = the values to change (leave a key out to keep it).
// Returns { errors } if something does not add up, or { values } to save.
function resolveLifecycle(existing, input = {}, { total = existing.total_repayment, today = dateInTZ(), checkCollateralOrder = false } = {}) {
  const errors = {};
  const pick = (key, current) => (input[key] === undefined ? current : input[key]);

  const status = pick("status", existing.status);
  const moneyGivenOn = pick("moneyGivenOn", existing.money_given_on) || "";
  let repaidOn = pick("repaidOn", existing.repaid_on) || "";
  let amountPaid = Number(pick("amountPaid", existing.amount_paid)) || 0;
  const cancelReason = String(pick("cancelReason", existing.cancel_reason) ?? "").trim();
  let cancelledOn = existing.cancelled_on;

  // Money given
  if (moneyGivenOn) {
    if (!["approved", "repaid", "cancelled"].includes(status)) errors.moneyGivenOn = "Money can only be given on an approved loan.";
    else if (moneyGivenOn > today) errors.moneyGivenOn = "The money given date cannot be in the future.";
    else if (checkCollateralOrder && existing.collateral_received_at && moneyGivenOn < existing.collateral_received_at)
      errors.moneyGivenOn = `The money cannot be given before the collateral was received (${existing.collateral_received_at}).`;
  }
  // Once money has left, the loan cannot go back to "not approved"
  if (existing.money_given_on && ["new", "contacted", "rejected"].includes(status))
    errors.status = "Money was given on this loan. Mark it repaid or cancel it instead.";

  // Repaid
  if (status === "repaid") {
    if (!["approved", "repaid"].includes(existing.status)) errors.status = "Approve the loan before marking it repaid.";
    if (!moneyGivenOn) errors.moneyGivenOn = errors.moneyGivenOn || "Enter the date the money was given before marking the loan repaid.";
    repaidOn = repaidOn || today;
    if (repaidOn > today) errors.repaidOn = "The repaid date cannot be in the future.";
    else if (moneyGivenOn && repaidOn < moneyGivenOn) errors.repaidOn = "The loan cannot be repaid before the money was given.";
    amountPaid = amountPaid > 0 ? round2(amountPaid) : round2(total); // the total to repay is the default
    if (!(amountPaid > 0)) errors.amountPaid = "Amount paid must be more than 0.";
  } else {
    repaidOn = "";
    amountPaid = 0;
  }

  // Cancelled
  if (status === "cancelled") {
    if (existing.status === "repaid") errors.status = "A repaid loan cannot be cancelled.";
    if (cancelReason.length < 3) errors.cancelReason = "Give a reason for cancelling (at least 3 characters).";
    cancelledOn = existing.cancelled_on || today;
  } else {
    cancelledOn = "";
  }

  if (Object.keys(errors).length) return { errors };
  return { values: { status, moneyGivenOn, repaidOn, amountPaid, cancelledOn, cancelReason: status === "cancelled" ? cancelReason : "" } };
}

function finish(existing, input, options) {
  const r = resolveLifecycle(existing, input, options);
  if (r.errors) return { status: 400, error: Object.values(r.errors)[0], errors: r.errors };
  Application.setLifecycle(existing.id, r.values);
  return { row: decorateOverdue(Application.findById(existing.id)) };
}

// The money was handed to the customer. Only after approval, and after the collateral is in.
function recordMoneyGiven(existing, { given = true, date } = {}) {
  if (!given) {
    if (existing.status === "repaid") return fail(400, "This loan is repaid. Change its status first if the money given date was wrong.");
    return finish(existing, { moneyGivenOn: "" });
  }
  if (existing.status !== "approved") return fail(400, "Approve the loan before giving the money.");
  if (!existing.collateral_received_at) return fail(400, "Record that the collateral was received first. The money is given after the collateral.");
  const day = date || dateInTZ();
  if (!isValidDate(day)) return fail(400, "Enter a valid date.");
  return finish(existing, { moneyGivenOn: day }, { checkCollateralOrder: true });
}

// The customer repaid. For an older loan with no money given date, that date can be supplied here once.
function recordRepayment(existing, { paidOn, amountPaid, moneyGivenOn } = {}) {
  if (existing.status === "repaid") return fail(400, "This loan is already marked repaid.");
  if (existing.status !== "approved") return fail(400, "Only an approved loan can be repaid.");
  const input = { status: "repaid" };
  if (moneyGivenOn && !existing.money_given_on) {
    if (!isValidDate(moneyGivenOn)) return fail(400, "Enter a valid money given date.");
    input.moneyGivenOn = moneyGivenOn;
  }
  if (paidOn) {
    if (!isValidDate(paidOn)) return fail(400, "Enter a valid repaid date.");
    input.repaidOn = paidOn;
  }
  const amount = amountPaid === undefined || amountPaid === null || amountPaid === "" ? 0 : Number(String(amountPaid).replace(/[,\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return fail(400, "Enter the amount paid as a number.");
  input.amountPaid = amount;
  return finish(existing, input);
}

// The loan will not go ahead. It is kept on record (never deleted), with the reason.
function cancelLoan(existing, reason) {
  if (existing.status === "repaid") return fail(400, "A repaid loan cannot be cancelled.");
  if (existing.status === "cancelled") return fail(400, "This loan is already cancelled.");
  return finish(existing, { status: "cancelled", cancelReason: typeof reason === "string" ? reason.replace(/\s+/g, " ") : "" });
}

// Why a loan cannot be deleted, or null if it can. Past reports must never change.
function deleteBlockReason(row) {
  if (row.money_given_on) return "Money was given on this loan, so it is kept on record. Use Cancel loan if it will not go ahead.";
  if (row.status === "repaid") return "Repaid loans are kept on record.";
  return null;
}

module.exports = { resolveLifecycle, recordMoneyGiven, recordRepayment, cancelLoan, deleteBlockReason };
