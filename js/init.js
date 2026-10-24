/* ================= INIT =================
   auth.js decides when to enter the app (after the session check and, for
   logged-in users, after cloud data has been written to localStorage). */

window.enterApp = () => {
  units = JSON.parse(localStorage.getItem("fatgo-units") || '{"weight":"kg","height":"cm"}');
  applyUnits();
  const saved = store.getProfile();
  if (saved) showDashboard(saved);
  else $("setup").classList.remove("hidden");
};
