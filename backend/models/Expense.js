// MODEL: the expenses table. An "expense" is a running cost (transport, airtime, rent). A "loss" is loan money that will not come back.
const db = require("./database");

const Expense = {
  create(e) {
    const r = db.prepare(
      `INSERT INTO expenses (spent_on, kind, description, amount, loan_id, created_by)
       VALUES (@spentOn, @kind, @description, @amount, @loanId, @createdBy)`
    ).run({ spentOn: e.spentOn, kind: e.kind, description: e.description, amount: e.amount, loanId: e.loanId ?? null, createdBy: e.createdBy || "" });
    return Number(r.lastInsertRowid);
  },
  findById(id) {
    return db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  },
  list(from, to) {
    return db.prepare(
      `SELECT e.*, a.name AS loan_name FROM expenses e LEFT JOIN applications a ON a.id = e.loan_id
       WHERE e.spent_on BETWEEN ? AND ? ORDER BY e.spent_on DESC, e.id DESC`
    ).all(from, to);
  },
  remove(id) {
    return db.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0;
  },
  totals(from, to) {
    return db.prepare("SELECT kind, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE spent_on BETWEEN ? AND ? GROUP BY kind").all(from, to);
  },
  byMonth(from, to) {
    return db.prepare(
      "SELECT substr(spent_on, 1, 7) AS month, kind, COALESCE(SUM(amount), 0) AS total FROM expenses WHERE spent_on BETWEEN ? AND ? GROUP BY month, kind"
    ).all(from, to);
  },
};

module.exports = Expense;
