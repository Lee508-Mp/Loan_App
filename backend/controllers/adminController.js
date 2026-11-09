// CONTROLLER (admin): view, edit and delete applications, and the overdue alerts. All routes need a login.
const Application = require("../models/Application");
const { validateApplication } = require("../validators/applicationValidator");
const { decorateOverdue } = require("../services/loanCalculator");
const service = require("../services/applicationService");
const { markCollateral } = require("../services/receiptService");
const lifecycle = require("../services/lifecycleService");

const notFound = (res) => res.status(404).json({ error: "Application not found." });

exports.alerts = (req, res) => res.json(service.getAlerts());

exports.list = (req, res) =>
  res.json(service.listApplications({ status: req.query.status, text: req.query.search }));

exports.get = (req, res) => {
  const row = Application.findById(req.params.id);
  row ? res.json(decorateOverdue(row)) : notFound(res);
};

exports.update = (req, res) => {
  const existing = Application.findById(req.params.id);
  if (!existing) return notFound(res);
  // Fields left out of the request keep their current value
  const { errors, value } = validateApplication({ ...service.editDefaults(existing), ...req.body }, { admin: true });
  if (Object.keys(errors).length) return res.status(400).json({ error: "Please check the details.", errors });
  const out = service.updateApplication(existing, value);
  if (out.errors) return res.status(400).json({ error: Object.values(out.errors)[0], errors: out.errors });
  res.json(out.row);
};

const reply = (res, r) => (r.error ? res.status(r.status).json({ error: r.error, errors: r.errors }) : res.json(r.row));
const withLoan = (handler) => (req, res) => {
  const existing = Application.findById(req.params.id);
  existing ? reply(res, handler(existing, req.body || {})) : notFound(res);
};

// The money was handed to the customer (or undo a mistake with given: false)
exports.moneyGiven = withLoan((loan, b) => lifecycle.recordMoneyGiven(loan, { given: b.given !== false, date: b.date }));
// The customer repaid. The date and amount are saved, and the loan becomes "repaid"
exports.repayment = withLoan((loan, b) => lifecycle.recordRepayment(loan, { paidOn: b.paidOn, amountPaid: b.amountPaid, moneyGivenOn: b.moneyGivenOn }));
// The loan will not go ahead. It stays on record, so past reports never change
exports.cancel = withLoan((loan, b) => lifecycle.cancelLoan(loan, b.reason));

// The customer delivered the collateral (or undo a mistake with received: false). Starts the repayment clock.
exports.collateral = (req, res) => {
  const existing = Application.findById(req.params.id);
  if (!existing) return notFound(res);
  const r = markCollateral(existing, { received: req.body?.received !== false, notes: req.body?.notes });
  r.error ? res.status(r.status).json({ error: r.error }) : res.json(r.row);
};

exports.remove = (req, res) => {
  const row = Application.findById(req.params.id);
  if (!row) return notFound(res);
  const blocked = lifecycle.deleteBlockReason(row); // loans with money given are kept on record
  if (blocked) return res.status(409).json({ error: blocked });
  Application.remove(req.params.id);
  res.json({ deleted: Number(req.params.id) });
};
