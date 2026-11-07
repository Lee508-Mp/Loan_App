// SERVICE: the business workflows. What happens when someone applies, and when an admin saves an edit.
// Controllers call these; these call the models. The "when does the repayment clock start" rules live here.
const Application = require("../models/Application");
const { calculateLoan, createdDate, dateInTZ, addDays, decorateOverdue, round2 } = require("./loanCalculator");
const { sendApplicationEmail } = require("./mailer");
const { DUE_SOON_DAYS, TERMS_VERSION } = require("../config/loanRules");

// A visitor applies. Interest, total and due date are worked out HERE, never trusted from the browser.
async function submitApplication(value) {
  const terms = calculateLoan(value.amount, value.period);
  const id = Application.create({ ...value, ...terms, termsAcceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });

  const result = { id, contactMethod: value.contactMethod, terms };
  if (value.contactMethod === "email") {
    const mail = await sendApplicationEmail({ id, ...value, ...terms });
    result.emailSent = mail.sent;
    if (!mail.sent) result.emailError = mail.reason;
  }
  return result;
}

// Values an admin edit keeps when the request leaves a field out.
const editDefaults = (e) => ({
  contactMethod: e.contact_method, email: e.email, dueDate: e.due_date,
  collateralType: e.collateral_type, collateralDetails: e.collateral_details,
  negotiatedRate: e.negotiated_rate, nrc: e.nrc, location: e.location,
});

// Decides interest, total and due date for an edit.
//  - Interest/total only change if the amount, period or negotiated rate changed (so changing rates later never alters old loans).
//  - Approving a loan restarts the due date from today. Changing the period moves it. Typing a date wins over both.
function planUpdate(existing, value, today = dateInTZ()) {
  const justApproved = value.status === "approved" && existing.status !== "approved";
  // The repayment clock starts when the collateral is received. Before that, dates count from approval (an estimate).
  const startDate = existing.collateral_received_at || (justApproved ? today : (existing.approved_at || createdDate(existing)));
  const terms = calculateLoan(value.amount, value.period, startDate, value.negotiatedRate);
  const termsChanged = value.amount !== existing.amount || value.period !== existing.period
    || value.negotiatedRate !== existing.negotiated_rate;
  const dueEdited = value.dueDate && value.dueDate !== existing.due_date;
  return {
    interestRate: termsChanged ? terms.interestRate : existing.interest_rate,
    interestAmount: termsChanged ? terms.interestAmount : existing.interest_amount,
    totalRepayment: termsChanged ? terms.totalRepayment : existing.total_repayment,
    dueDate: dueEdited ? value.dueDate
      : ((justApproved && !existing.collateral_received_at) || value.period !== existing.period) ? terms.dueDate : existing.due_date,
    approvedAt: justApproved ? today : existing.approved_at,
    negotiatedRate: value.negotiatedRate,
  };
}

function updateApplication(existing, value) {
  Application.update(existing.id, { ...value, ...planUpdate(existing, value) });
  return decorateOverdue(Application.findById(existing.id));
}

const listApplications = ({ status, text }) =>
  Application.search({ status, text, today: dateInTZ() }).map(decorateOverdue);

// Powers the dashboard's overdue banner.
function getAlerts() {
  const today = dateInTZ();
  const overdue = Application.findOverdue(today).map(decorateOverdue);
  const dueSoon = Application.findDueBetween(today, addDays(today, DUE_SOON_DAYS)).map(decorateOverdue);
  const awaitingCollateral = Application.findAwaitingCollateral().map(decorateOverdue);
  return { today, overdue, dueSoon, awaitingCollateral, overdueTotal: round2(overdue.reduce((sum, r) => sum + r.total_repayment, 0)) };
}

module.exports = { submitApplication, editDefaults, planUpdate, updateApplication, listApplications, getAlerts };
