// ====== EDIT THIS: your WhatsApp number, country code first, digits only (Zambia = 260, no + and no leading 0)
const WHATSAPP_NUMBER = "260970000000";
const MIN_AMOUNT = 500;
const MAX_AMOUNT = 50000;

const form = $("loanForm"), review = $("review"), done = $("done");
let data = null; // holds the validated values

// ---- Terms gate: the form stays hidden until the visitor has accepted the Terms and Conditions
if (hasAcceptedTerms()) $("formPage").hidden = false;
else window.location.replace("/terms");

const getMethod = () => form.querySelector('input[name="method"]:checked').value;

function setError(inputId, errId, msg) {
  $(errId).textContent = msg;
  $(inputId).closest("label").classList.toggle("invalid", Boolean(msg));
  return !msg;
}

// ---- live loan calculator. The server owns the rates and date rules; this just shows its answer.

async function fetchTerms(amount, period) {
  const res = await fetch("/api/loan-terms?" + new URLSearchParams({ amount, period }));
  const out = await res.json();
  if (!res.ok) throw new Error(out.error);
  return out;
}
function showTerms(t) {
  $("terms").hidden = !t;
  if (!t) return;
  $("tRate").textContent = t.interestRate + "%";
  $("tInterest").textContent = formatMoney(t.interestAmount);
  $("tTotal").textContent = formatMoney(t.totalRepayment);
  $("tDate").textContent = formatDate(t.dueDate);
}
let termsTimer, termsRequest = 0;
function updateTerms() {
  clearTimeout(termsTimer);
  termsTimer = setTimeout(async () => {
    const raw = $("amount").value.replace(/[,\sK]/gi, ""), period = $("period").value;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < MIN_AMOUNT || n > MAX_AMOUNT || !period) return showTerms(null);
    const mine = ++termsRequest; // ignore answers that arrive after a newer keystroke
    try { const t = await fetchTerms(n, period); if (mine === termsRequest) showTerms(t); }
    catch { if (mine === termsRequest) showTerms(null); }
  }, 300);
}
$("amount").addEventListener("input", updateTerms);
$("period").addEventListener("change", updateTerms);

// ---- validators: each returns true if OK and shows the message if not
function checkAmount() {
  const raw = $("amount").value.replace(/[,\sK]/gi, "");
  if (!raw) return setError("amount", "amountErr", "Enter the amount you need.");
  if (!/^\d+$/.test(raw)) return setError("amount", "amountErr", "Use numbers only, like 5000.");
  const n = Number(raw);
  if (n < MIN_AMOUNT || n > MAX_AMOUNT)
    return setError("amount", "amountErr", `Amount must be between ${formatMoney(MIN_AMOUNT)} and ${formatMoney(MAX_AMOUNT)}.`);
  return setError("amount", "amountErr", "");
}
function checkName() {
  const v = $("name").value.trim();
  if (v.length < 2) return setError("name", "nameErr", "Enter your full name.");
  if (!/^[A-Za-z][A-Za-z\s'.-]+$/.test(v)) return setError("name", "nameErr", "Use letters only.");
  return setError("name", "nameErr", "");
}
function normalisePhone(v) {
  const d = v.replace(/[\s()-]/g, "");
  if (/^\+260\d{9}$/.test(d)) return d.slice(1);
  if (/^260\d{9}$/.test(d)) return d;
  if (/^0\d{9}$/.test(d)) return "260" + d.slice(1);
  return null;
}
function checkPhone() {
  return normalisePhone($("phone").value)
    ? setError("phone", "phoneErr", "")
    : setError("phone", "phoneErr", "Enter a Zambian number, like 0971 234 567.");
}
function checkPeriod() {
  return $("period").value
    ? setError("period", "periodErr", "")
    : setError("period", "periodErr", "Choose a repayment period.");
}
function checkCollateral() {
  return $("collateralType").value
    ? setError("collateralType", "collateralErr", "")
    : setError("collateralType", "collateralErr", "Choose the type of collateral.");
}
function checkEmail() {
  if (getMethod() !== "email") return setError("email", "emailErr", ""); // only needed for the email route
  const v = $("email").value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
    ? setError("email", "emailErr", "")
    : setError("email", "emailErr", "Enter a valid email address.");
}

[["amount", checkAmount], ["name", checkName], ["phone", checkPhone], ["period", checkPeriod], ["collateralType", checkCollateral], ["email", checkEmail]]
  .forEach(([id, fn]) => $(id).addEventListener("blur", fn));

// ---- show the email box only when "Email" is chosen
form.querySelectorAll('input[name="method"]').forEach((r) =>
  r.addEventListener("change", () => {
    $("emailField").hidden = getMethod() !== "email";
    checkEmail();
  })
);

// ---- step 1 -> step 2
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const results = [checkAmount(), checkName(), checkPhone(), checkPeriod(), checkCollateral(), checkEmail()];
  if (results.includes(false)) {
    form.querySelector(".invalid input, .invalid select")?.focus();
    return;
  }
  const method = getMethod();
  let terms;
  try { terms = await fetchTerms(Number($("amount").value.replace(/[,\sK]/gi, "")), $("period").value); }
  catch (err) {
    setError("amount", "amountErr", err.message === "Failed to fetch" ? "Cannot reach the server." : err.message);
    return;
  }
  data = {
    amount: Number($("amount").value.replace(/[,\sK]/gi, "")),
    name: $("name").value.trim(),
    phone: "+" + normalisePhone($("phone").value),
    period: $("period").value,
    collateralType: $("collateralType").value,
    collateralDetails: $("collateralDetails").value.trim(),
    acceptedTerms: hasAcceptedTerms(), // the server also requires this
    contactMethod: method,
    email: method === "email" ? $("email").value.trim() : "",
  };
  $("rAmount").textContent = formatMoney(data.amount);
  $("rName").textContent = data.name;
  $("rPhone").textContent = data.phone;
  $("rPeriod").textContent = data.period;
  $("rCollateral").textContent = data.collateralType + (data.collateralDetails ? ` (${data.collateralDetails})` : "");
  $("rRate").textContent = terms.interestRate + "%";
  $("rTotal").textContent = formatMoney(terms.totalRepayment);
  $("rDue").textContent = formatDate(terms.dueDate);
  $("rMethod").textContent = method === "email" ? "Email" : "WhatsApp";
  $("rEmailRow").hidden = method !== "email";
  $("rEmail").textContent = data.email;

  const send = $("sendBtn");
  send.textContent = method === "email" ? "Send by email" : "Send on WhatsApp";
  send.classList.toggle("wa", method === "whatsapp");
  $("confirm").checked = false;
  $("confirmErr").textContent = "";
  $("sendErr").textContent = "";
  showStep(2);
});

$("editBtn").addEventListener("click", () => showStep(1));

function showStep(n) {
  form.hidden = n !== 1;
  review.hidden = n !== 2;
  done.hidden = n !== 3;
  $("stepDot1").classList.toggle("active", n === 1);
  $("stepDot2").classList.toggle("active", n !== 1);
  if (n === 1) { $("amount").focus(); }
  else (n === 2 ? review : done).querySelector("h2").scrollIntoView({ block: "start" });
}

// ---- step 2 -> save to database -> route by chosen method
$("sendBtn").addEventListener("click", async () => {
  if (!$("confirm").checked) {
    $("confirmErr").textContent = "Tick the box to confirm your details.";
    return;
  }
  const btn = $("sendBtn"), label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sending...";
  $("sendErr").textContent = "";
  try {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json();
    if (!res.ok) throw new Error((out.errors && Object.values(out.errors)[0]) || out.error || "Could not save.");

    if (data.contactMethod === "whatsapp") {
      const message =
        `Hello, I would like to apply for a loan.\n\n` +
        `Reference: #${out.id}\n` +
        `Name: ${data.name}\n` +
        `Phone: ${data.phone}\n` +
        `Amount: ${formatMoney(data.amount)}\n` +
        `Repayment period: ${data.period}\n` +
        `Collateral: ${data.collateralType}${data.collateralDetails ? " (" + data.collateralDetails + ")" : ""}\n` +
        `Interest rate: ${out.terms.interestRate}%\n` +
        `Total to repay: ${formatMoney(out.terms.totalRepayment)}\n` +
        `Estimated repayment date: ${formatDate(out.terms.dueDate)}`;
      window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      return;
    }
    // Email route: the server already tried to send it
    if (out.emailSent) {
      $("doneTitle").textContent = "Application sent";
      $("doneText").textContent = `Your application (reference #${out.id}) was emailed to us. We will reply to ${data.email}.`;
    } else {
      $("doneTitle").textContent = "Application saved";
      $("doneText").textContent =
        `We saved your application (reference #${out.id}), but the email could not be sent. ` +
        `We can still see it and will contact you on ${data.phone}. You can also go back and choose WhatsApp.`;
    }
    showStep(3);
  } catch (err) {
    $("sendErr").textContent = err.message === "Failed to fetch" ? "Cannot reach the server. Is it running?" : err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

$("againBtn").addEventListener("click", () => { form.reset(); $("emailField").hidden = true; showTerms(null); showStep(1); });
