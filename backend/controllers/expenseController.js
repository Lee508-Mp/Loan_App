// CONTROLLER (admin): expenses and losses, which the profit report subtracts. Needs a login.
const Expense = require("../models/Expense");
const { validateExpense } = require("../validators/expenseValidator");
const { parseRange } = require("../services/reportService");

exports.list = (req, res) => {
  const range = parseRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });
  res.json(Expense.list(range.from, range.to));
};

exports.create = (req, res) => {
  const { errors, value } = validateExpense(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], errors });
  const id = Expense.create({ ...value, createdBy: req.admin.username });
  res.status(201).json(Expense.findById(id));
};

exports.remove = (req, res) =>
  Expense.remove(req.params.id) ? res.json({ deleted: Number(req.params.id) }) : res.status(404).json({ error: "Entry not found." });
