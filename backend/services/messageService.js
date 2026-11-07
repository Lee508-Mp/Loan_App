// SERVICE: drafting the messages for customers, and logging the ones that were sent.
const Message = require("../models/Message");
const templates = require("../config/messageTemplates");
const { receiptNumber } = require("./receiptService");

const KINDS = ["approval", "receipt"];

// Fills in the template for this loan. The admin can edit the text before sending.
function buildDraft(row, kind, baseUrl) {
  if (!KINDS.includes(kind)) return { status: 400, error: "Choose the approval message or the receipt message." };
  if (kind === "approval" && row.status !== "approved")
    return { status: 400, error: "Set the loan to approved before sending the approval message." };
  if (kind === "receipt" && !row.collateral_received_at)
    return { status: 400, error: "Record that the collateral was received before sending the receipt." };
  const text = kind === "approval"
    ? templates.approval(row)
    : templates.receipt(row, { receiptNumber: receiptNumber(row), link: `${baseUrl}/receipt/${row.receipt_token}` });
  return { text, phone: row.phone, history: Message.listFor(row.id) };
}

// Logs the message that is about to be opened in WhatsApp, and returns the WhatsApp link.
function recordMessage(row, kind, text, adminUsername) {
  const check = buildDraft(row, kind, "");
  if (check.error) return check;
  const body = typeof text === "string" ? text.trim() : "";
  if (!body || body.length > 1500) return { status: 400, error: "The message must be between 1 and 1500 characters." };
  Message.create({ applicationId: row.id, kind, body, adminUsername });
  return { url: `https://wa.me/${row.phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}` };
}

module.exports = { buildDraft, recordMessage };
