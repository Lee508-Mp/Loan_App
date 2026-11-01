// Small helpers shared by every page. Loaded before the page's own script.
const $ = (id) => document.getElementById(id);
const formatMoney = (n) => "K" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const formatDate = (iso) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "Not set";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Has this visitor accepted the Terms and Conditions in this browser session?
const TERMS_KEY = "termsAccepted";
const hasAcceptedTerms = () => { try { return sessionStorage.getItem(TERMS_KEY) === "yes"; } catch { return false; } };
