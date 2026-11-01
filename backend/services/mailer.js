const nodemailer = require("nodemailer");
const { mail } = require("../config/env");

// Only create the transporter if email is configured in .env
const transporter = mail.host && mail.to
  ? nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.port === 465,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    })
  : null;

// Sends the application to the company inbox (MAIL_TO). Reply-To is the applicant, so you can just hit Reply.
// We never send mail to the applicant's address, so nobody can use the form to spam other people.
async function sendApplicationEmail(app) {
  if (!transporter) return { sent: false, reason: "Email is not set up on the server yet." };
  try {
    await transporter.sendMail({
      from: mail.from || mail.user,
      to: mail.to,
      replyTo: app.email,
      subject: `New loan application #${app.id}: K${app.amount}`,
      text:
        `New loan application #${app.id}\n\n` +
        `Name: ${app.name}\nPhone: ${app.phone}\nEmail: ${app.email}\n` +
        `Amount: K${app.amount}\nRepayment period: ${app.period}\n` +
        `Collateral: ${app.collateralType}${app.collateralDetails ? " (" + app.collateralDetails + ")" : ""}\n` +
        `Interest rate: ${app.interestRate}%\nTotal to repay: K${app.totalRepayment}\nEstimated repayment date: ${app.dueDate}\n`,
    });
    return { sent: true };
  } catch (err) {
    console.error("Email failed:", err.message);
    return { sent: false, reason: "The email could not be sent." };
  }
}

module.exports = { sendApplicationEmail };
