// VALIDATOR: an expense or a loss entered in the Reports window.
const { isValidDate, dateInTZ, round2 } = require("../services/loanCalculator");
const Application = require("../models/Application");

const EXPENSE_KINDS = ["expense", "loss"];

// Returns { errors, value }. today is passed in so tests can control it.
function validateExpense(b = {}, today = dateInTZ()) {
  const errors = {};
  const value = {};

  const spentOn = b.spentOn === undefined || b.spentOn === null || String(b.spentOn).trim() === "" ? today : String(b.spentOn).trim();
  if (!isValidDate(spentOn)) errors.spentOn = "Enter a valid date.";
  else if (spentOn > today) errors.spentOn = "The date cannot be in the future.";
  else value.spentOn = spentOn;

  if (!EXPENSE_KINDS.includes(b.kind)) errors.kind = "Choose Expense or Loss.";
  else value.kind = b.kind;

  const description = typeof b.description === "string" ? b.description.replace(/\s+/g, " ").trim() : "";
  if (description.length < 2 || description.length > 200) errors.description = "Describe it in 2 to 200 characters.";
  else value.description = description;

  const amount = Number(String(b.amount ?? "").replace(/[,\s]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) errors.amount = "Enter an amount more than 0.";
  else value.amount = round2(amount);

  if (b.loanId !== undefined && b.loanId !== null && String(b.loanId).trim() !== "") {
    const id = Number(String(b.loanId).replace(/^#/, ""));
    if (!Number.isInteger(id) || id < 1 || !Application.findById(id)) errors.loanId = "There is no loan with that reference number.";
    else value.loanId = id;
  }
  return { errors, value };
}

module.exports = { validateExpense, EXPENSE_KINDS };
