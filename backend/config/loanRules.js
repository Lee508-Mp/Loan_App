// ===== BUSINESS RULES. Edit this file to change what the company offers. =====

// Interest: a flat % of the amount borrowed, charged once for the whole period.
// Use `days` for short periods or `months` for calendar months.
// These rates are PLACEHOLDERS. Set the real ones before going live.
const TERMS = {
  "1 week":  { days: 7,   rate: 5 },
  "2 weeks": { days: 14,  rate: 8 },
  "3 weeks": { days: 21,  rate: 12 },
  "1 month": { months: 1, rate: 15 },
};
const PERIODS = Object.keys(TERMS);

const MIN_AMOUNT = 500;
const MAX_AMOUNT = 50000;

const COLLATERAL_TYPES = ["Vehicle", "Land or property", "Electronics", "Household items", "Livestock", "Business stock or equipment", "Other"];
const STATUSES = ["new", "contacted", "approved", "rejected", "repaid"];
const CONTACT_METHODS = ["whatsapp", "email"];
// Bump this whenever you change frontend/views/terms.html. Each application records the version it accepted.
const TERMS_VERSION = "1.0";
const DUE_SOON_DAYS = 3; // the dashboard warns about loans due within this many days

module.exports = { TERMS, PERIODS, MIN_AMOUNT, MAX_AMOUNT, COLLATERAL_TYPES, STATUSES, CONTACT_METHODS, TERMS_VERSION, DUE_SOON_DAYS };
