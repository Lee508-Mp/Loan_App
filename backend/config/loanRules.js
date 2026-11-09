// ===== BUSINESS RULES. Edit this file to change what the company offers. =====

// Interest: a flat % of the amount borrowed, charged once for the whole period.
// Use `days` for short periods or `months` for calendar months.
// These rates are PLACEHOLDERS. Set the real ones before going live.
const TERMS = {
  "1 week":  { days: 7,   rate: 15 },
  "2 weeks": { days: 14,  rate: 25 },
  "3 weeks": { days: 21,  rate: 35 },
  "1 month": { months: 1, rate: 40 },
};
const PERIODS = Object.keys(TERMS);

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 150000;

const COLLATERAL_TYPES = ["Vehicle", "Land or property", "Electronics", "Household items", "Livestock", "Business stock or equipment", "Other"];
const STATUSES = ["new", "contacted", "approved", "rejected", "repaid", "cancelled"];
const CONTACT_METHODS = ["whatsapp", "email"];
// Bump this whenever you change frontend/views/terms.html. Each application records the version it accepted.
const COMPANY_NAME = "Kandoz Investment Limited"; // shown on receipts and in messages. Change it to your company name
const RECEIPT_PREFIX = "KIL";                      // receipt numbers look like KIL-2026-0007
const TERMS_VERSION = "1.1";
const DUE_SOON_DAYS = 3; // the dashboard warns about loans due within this many days

module.exports = { TERMS, PERIODS, MIN_AMOUNT, MAX_AMOUNT, COLLATERAL_TYPES, STATUSES, CONTACT_METHODS, COMPANY_NAME, RECEIPT_PREFIX, TERMS_VERSION, DUE_SOON_DAYS };
