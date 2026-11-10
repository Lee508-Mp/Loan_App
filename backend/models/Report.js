// MODEL: the questions the profit report asks the database. All dates are YYYY-MM-DD text, so BETWEEN works on them.
const db = require("./database");

const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);

const Report = {
  // Money handed to customers in the range (this includes loans that were cancelled later)
  given: (from, to) =>
    one("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM applications WHERE money_given_on BETWEEN ? AND ?", from, to),

  // Loans repaid in the range: what came back, the money originally given, and the interest that was agreed
  repaid: (from, to) =>
    one(`SELECT COUNT(*) AS count, COALESCE(SUM(amount_paid), 0) AS collected, COALESCE(SUM(amount), 0) AS principal,
                COALESCE(SUM(interest_amount), 0) AS agreed
         FROM applications WHERE status = 'repaid' AND repaid_on BETWEEN ? AND ?`, from, to),

  // Loans still out on the last day of the range: money given by then, not repaid by then, not cancelled
  outstanding: (at) =>
    one(`SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS principal, COALESCE(SUM(interest_amount), 0) AS interest,
                COALESCE(SUM(total_repayment), 0) AS total
         FROM applications
         WHERE money_given_on <> '' AND money_given_on <= ? AND (repaid_on = '' OR repaid_on > ?)
           AND status <> 'cancelled' AND NOT (status = 'repaid' AND repaid_on = '')`, at, at),

  // Loans cancelled in the range after money was given: the money may need to be recorded as a loss
  cancelled: (from, to) =>
    one(`SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM applications
         WHERE status = 'cancelled' AND money_given_on <> '' AND cancelled_on BETWEEN ? AND ?`, from, to),

  // Repaid loans that are missing a date, so the report cannot count them
  undatedRepaid: () =>
    one("SELECT COUNT(*) AS count FROM applications WHERE status = 'repaid' AND (money_given_on = '' OR repaid_on = '')").count,

  givenByMonth: (from, to) =>
    all("SELECT substr(money_given_on, 1, 7) AS month, COALESCE(SUM(amount), 0) AS total FROM applications WHERE money_given_on BETWEEN ? AND ? GROUP BY month", from, to),

  repaidByMonth: (from, to) =>
    all(`SELECT substr(repaid_on, 1, 7) AS month, COALESCE(SUM(amount_paid), 0) AS collected, COALESCE(SUM(amount), 0) AS principal
         FROM applications WHERE status = 'repaid' AND repaid_on BETWEEN ? AND ? GROUP BY month`, from, to),

  byPeriod: (from, to) =>
    all(`SELECT period, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS principal, COALESCE(SUM(amount_paid - amount), 0) AS interest
         FROM applications WHERE status = 'repaid' AND repaid_on BETWEEN ? AND ? GROUP BY period ORDER BY interest DESC`, from, to),

  // The detail lists that go into the CSV for your accountant
  repaidLoans: (from, to) =>
    all(`SELECT id, name, money_given_on, repaid_on, amount, amount_paid FROM applications
         WHERE status = 'repaid' AND repaid_on BETWEEN ? AND ? ORDER BY repaid_on, id`, from, to),
  givenLoans: (from, to) =>
    all("SELECT id, name, money_given_on, amount FROM applications WHERE money_given_on BETWEEN ? AND ? ORDER BY money_given_on, id", from, to),
};

module.exports = Report;
