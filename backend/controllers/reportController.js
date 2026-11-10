// CONTROLLER (admin): the profit report, on screen and as a CSV file. Needs a login.
const { parseRange, buildProfitReport, toCsv } = require("../services/reportService");
const { dateInTZ } = require("../services/loanCalculator");

exports.profit = (req, res) => {
  const today = dateInTZ();
  const range = parseRange(req.query, today);
  if (range.error) return res.status(400).json({ error: range.error });
  res.json({ today, ...buildProfitReport(range.from, range.to, today) });
};

exports.csv = (req, res) => {
  const today = dateInTZ();
  const range = parseRange(req.query, today);
  if (range.error) return res.status(400).json({ error: range.error });
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="profit-${range.from}-to-${range.to}.csv"`);
  res.send(toCsv(buildProfitReport(range.from, range.to, today), today));
};
