// MODEL: every SQL statement that touches the applications table lives here (and only here).
const db = require("./database");
const { STATUSES } = require("../config/loanRules");

const OVERDUE_WHERE = "status = 'approved' AND due_date <> '' AND due_date < ?";

const Application = {
  create(d) {
    const r = db.prepare(
      `INSERT INTO applications (name, phone, nrc, location, amount, period, contact_method, email, collateral_type, collateral_details,
                                 interest_rate, interest_amount, total_repayment, due_date,
                                 terms_accepted_at, terms_version)
       VALUES (@name, @phone, @nrc, @location, @amount, @period, @contactMethod, @email, @collateralType, @collateralDetails,
               @interestRate, @interestAmount, @totalRepayment, @dueDate,
               @termsAcceptedAt, @termsVersion)`
    ).run({
      name: d.name, phone: d.phone, nrc: d.nrc, location: d.location, amount: d.amount, period: d.period,
      contactMethod: d.contactMethod, email: d.email,
      collateralType: d.collateralType, collateralDetails: d.collateralDetails,
      interestRate: d.interestRate, interestAmount: d.interestAmount,
      totalRepayment: d.totalRepayment, dueDate: d.dueDate,
      termsAcceptedAt: d.termsAcceptedAt, termsVersion: d.termsVersion,
    });
    return Number(r.lastInsertRowid);
  },

  findById(id) {
    return db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
  },

  // status may be a normal status or "overdue". text searches name and phone.
  search({ status, text, today }) {
    const where = [], params = [];
    if (status === "overdue") { where.push(OVERDUE_WHERE); params.push(today); }
    else if (STATUSES.includes(status)) { where.push("status = ?"); params.push(status); }
    if (text) {
      const like = `%${String(text).slice(0, 50)}%`;
      where.push("(name LIKE ? OR phone LIKE ?)");
      params.push(like, like);
    }
    const sql = `SELECT * FROM applications ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 500`;
    return db.prepare(sql).all(...params);
  },

  findOverdue(today) {
    return db.prepare(`SELECT * FROM applications WHERE ${OVERDUE_WHERE} ORDER BY due_date ASC`).all(today);
  },

  findDueBetween(fromDate, toDate) {
    return db.prepare(
      "SELECT * FROM applications WHERE status = 'approved' AND due_date >= ? AND due_date <= ? ORDER BY due_date ASC"
    ).all(fromDate, toDate);
  },

  update(id, d) {
    db.prepare(
      `UPDATE applications SET name=@name, phone=@phone, nrc=@nrc, location=@location, amount=@amount, period=@period,
         contact_method=@contactMethod, email=@email, collateral_type=@collateralType, collateral_details=@collateralDetails,
         status=@status, notes=@notes, interest_rate=@interestRate, interest_amount=@interestAmount,
         total_repayment=@totalRepayment, due_date=@dueDate, approved_at=@approvedAt,
         negotiated_rate=@negotiatedRate WHERE id=@id`
    ).run({
      name: d.name, phone: d.phone, nrc: d.nrc, location: d.location, amount: d.amount, period: d.period,
      contactMethod: d.contactMethod, email: d.email,
      collateralType: d.collateralType, collateralDetails: d.collateralDetails,
      status: d.status, notes: d.notes,
      interestRate: d.interestRate, interestAmount: d.interestAmount, totalRepayment: d.totalRepayment,
      dueDate: d.dueDate, approvedAt: d.approvedAt, negotiatedRate: d.negotiatedRate ?? null, id,
    });
  },

  remove(id) {
    return db.prepare("DELETE FROM applications WHERE id = ?").run(id).changes > 0;
  },
};

module.exports = Application;