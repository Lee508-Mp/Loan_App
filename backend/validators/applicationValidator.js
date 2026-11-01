// Server-side validation. Never trust the browser: Postman or an attacker can skip your JavaScript.
const { PERIODS, MIN_AMOUNT, MAX_AMOUNT, COLLATERAL_TYPES, STATUSES, CONTACT_METHODS } = require("../config/loanRules");
const { isValidDate } = require("../services/loanCalculator");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalisePhone(v) {
  const d = String(v || "").replace(/[\s()-]/g, "");
  if (/^\+260\d{9}$/.test(d)) return d;
  if (/^260\d{9}$/.test(d)) return "+" + d;
  if (/^0\d{9}$/.test(d)) return "+260" + d.slice(1);
  return null;
}

// For GET /api/loan-terms?amount=..&period=.. Returns { amount, period } or null.
function validateTermsQuery(q = {}) {
  const amount = Number(String(q.amount ?? "").replace(/[,\s]/g, ""));
  const ok = Number.isInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT && PERIODS.includes(q.period);
  return ok ? { amount, period: q.period } : null;
}

// Returns { errors, value }. If errors is empty, value is clean and safe to store.
function validateApplication(body, { admin = false } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const errors = {};
  const value = {};

  const amount = Number(String(b.amount ?? "").replace(/[,\s]/g, ""));
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT)
    errors.amount = `Amount must be a whole number between K${MIN_AMOUNT} and K${MAX_AMOUNT}.`;
  else value.amount = amount;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!/^[A-Za-z][A-Za-z\s'.-]{1,79}$/.test(name)) errors.name = "Enter a valid full name (letters only).";
  else value.name = name;

  const phone = normalisePhone(b.phone);
  if (!phone) errors.phone = "Enter a valid Zambian phone number.";
  else value.phone = phone;

  if (!PERIODS.includes(b.period)) errors.period = "Choose a valid repayment period.";
  else value.period = b.period;

  // Collateral: the public form must choose a type. Admins may leave old records as "" (not specified).
  const ct = b.collateralType;
  if (COLLATERAL_TYPES.includes(ct)) value.collateralType = ct;
  else if (admin && (ct === "" || ct === undefined)) value.collateralType = "";
  else errors.collateralType = "Choose the type of collateral.";

  const details = typeof b.collateralDetails === "string" ? b.collateralDetails.replace(/\s+/g, " ").trim() : "";
  if (details.length > 200) errors.collateralDetails = "Collateral details must be 200 characters or fewer.";
  else value.collateralDetails = details;

  // Public applicants must accept the Terms and Conditions (admin edits do not touch this).
  if (!admin && b.acceptedTerms !== true) errors.acceptedTerms = "You must accept the Terms and Conditions before applying.";

  // How the applicant wants to send the application. Missing = whatsapp, so older clients keep working.
  const method = b.contactMethod ?? "whatsapp";
  if (!CONTACT_METHODS.includes(method)) errors.contactMethod = "Choose WhatsApp or email.";
  else value.contactMethod = method;

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (value.contactMethod === "email" || email) {
    if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    else value.email = email;
  } else value.email = "";

  if (admin) {
    if (b.dueDate !== undefined && b.dueDate !== "") {
      if (!isValidDate(b.dueDate)) errors.dueDate = "Enter a valid due date.";
      else value.dueDate = b.dueDate;
    }
    if (!STATUSES.includes(b.status)) errors.status = "Invalid status.";
    else value.status = b.status;
    const notes = typeof b.notes === "string" ? b.notes.trim() : "";
    if (notes.length > 500) errors.notes = "Notes must be 500 characters or fewer.";
    else value.notes = notes;
  }
  return { errors, value };
}

module.exports = { validateApplication, validateTermsQuery, normalisePhone };
