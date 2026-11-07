// CONTROLLER (admin): view, edit and delete applications, and the overdue alerts. All routes need a login.
const Application = require("../models/Application");
const { validateApplication } = require("../validators/applicationValidator");
const { decorateOverdue } = require("../services/loanCalculator");
const service = require("../services/applicationService");
const { markCollateral } = require("../services/receiptService");

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
  res.json(service.updateApplication(existing, value));
};

// The customer delivered the collateral (or undo a mistake with received: false). Starts the repayment clock.
exports.collateral = (req, res) => {
  const existing = Application.findById(req.params.id);
  if (!existing) return notFound(res);
  const r = markCollateral(existing, { received: req.body?.received !== false, notes: req.body?.notes });
  r.error ? res.status(r.status).json({ error: r.error }) : res.json(r.row);
};

exports.remove = (req, res) =>
  Application.remove(req.params.id) ? res.json({ deleted: Number(req.params.id) }) : notFound(res);
