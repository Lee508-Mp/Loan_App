// The "Admins" window: list, add, delete, reset a colleague's password, change my own password.
// Reuses $, formatDate (common.js) and api() (dashboard.js). Classic scripts share one global scope.
let currentAdminId = null;

function say(text, isError) {
  $("adminMsg").textContent = text;
  $("adminMsg").style.color = isError ? "var(--err)" : "";
}

async function loadAdmins() {
  try {
    const [me, admins] = await Promise.all([api("/api/admin/me"), api("/api/admin/admins")]);
    currentAdminId = me.id;
    renderAdmins(admins);
  } catch (err) { say(err.message, true); }
}

function renderAdmins(admins) {
  const list = $("adminList"), select = $("resetTarget");
  list.replaceChildren();
  select.replaceChildren();
  admins.forEach((a) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const isMe = a.id === currentAdminId;
    label.textContent = a.username + (isMe ? " (you)" : "") + (a.created_at ? `, added ${formatDate(a.created_at.slice(0, 10))}` : "");
    li.append(label);
    if (!isMe) {
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn danger small"; del.textContent = "Delete";
      del.addEventListener("click", () => removeAdmin(a));
      li.append(del);
      const opt = document.createElement("option");
      opt.value = a.id; opt.textContent = a.username;
      select.append(opt);
    }
    list.append(li);
  });
  select.disabled = select.options.length === 0;
}

async function removeAdmin(a) {
  if (!confirm(`Delete the admin "${a.username}"? They will be logged out straight away.`)) return;
  try { await api("/api/admin/admins/" + a.id, { method: "DELETE" }); say(`"${a.username}" was deleted.`); loadAdmins(); }
  catch (err) { say(err.message, true); }
}

$("addAdminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("newAdminUser").value.trim();
  try {
    await api("/api/admin/admins", { method: "POST", body: JSON.stringify({ username, password: $("newAdminPass").value }) });
    $("addAdminForm").reset();
    say(`"${username}" was added. Give them the password in person or through a safe channel.`);
    loadAdmins();
  } catch (err) { say(err.message, true); }
});

$("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const target = $("resetTarget");
  if (!target.value) return say("There is no one else to reset.", true);
  try {
    await api(`/api/admin/admins/${target.value}/password`, { method: "PUT", body: JSON.stringify({ newPassword: $("resetPass").value }) });
    $("resetForm").reset();
    say(`New password set for "${target.selectedOptions[0].textContent}". Any devices they were signed in on are logged out.`);
  } catch (err) { say(err.message, true); }
});

$("changePassForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/admin/change-password", {
      method: "POST", body: JSON.stringify({ currentPassword: $("curPass").value, newPassword: $("myNewPass").value }),
    });
    $("changePassForm").reset();
    say("Your password was changed. Other devices signed in as you were logged out.");
  } catch (err) { say(err.message, true); }
});

$("adminsBtn").addEventListener("click", () => { say(""); $("adminsDialog").showModal(); loadAdmins(); });
$("closeAdmins").addEventListener("click", () => $("adminsDialog").close());
