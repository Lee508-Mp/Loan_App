// Terms page: the button stays disabled until the box is ticked. Accepting remembers it for this browser session
// and sends the visitor to the application form.
const box = $("acceptBox"), btn = $("acceptBtn");

if (hasAcceptedTerms()) box.checked = true; // came back to re-read the terms
btn.disabled = !box.checked;

box.addEventListener("change", () => {
  btn.disabled = !box.checked;
  $("acceptErr").textContent = "";
});

btn.addEventListener("click", () => {
  if (!box.checked) return;
  try {
    sessionStorage.setItem(TERMS_KEY, "yes");
  } catch {
    $("acceptErr").textContent = "Your browser blocked saving your choice. Please allow site storage and try again.";
    return;
  }
  window.location.href = "/";
});