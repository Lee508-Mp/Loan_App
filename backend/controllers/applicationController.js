// CONTROLLER (public): the loan calculator and the application form. No login needed.
const { validateApplication, validateTermsQuery } = require("../validators/applicationValidator");
const { calculateLoan } = require("../services/loanCalculator");
const { submitApplication } = require("../services/applicationService");

exports.getTerms = (req, res) => {
  const q = validateTermsQuery(req.query);
  if (!q) return res.status(400).json({ error: "Enter a valid amount and repayment period." });
  res.json(calculateLoan(q.amount, q.period));
};

exports.submit = async (req, res) => {
  const { errors, value } = validateApplication(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: "Please check your details.", errors });
  res.status(201).json(await submitApplication(value));
};
