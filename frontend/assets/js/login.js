$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginErr").textContent = "";
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    window.location.href = "/admin";
  } catch (err) {
    $("loginErr").textContent = err.message === "Failed to fetch" ? "Cannot reach the server." : err.message;
  }
});
