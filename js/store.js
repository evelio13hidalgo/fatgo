/* ================= STORE =================
   Every read/write of saved data goes through here, so localStorage keys are
   named in exactly one place. queueSync (auth.js) mirrors changes to Supabase
   when the user is logged in; the ?. makes it a no-op in guest mode. */

// Profiles saved before schedules/splits existed get sensible defaults.
const TRAINDAY_DEFAULTS = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };

function upgradeProfile(p) {
  if (!p) return p;
  if (!p.wakeOff) p.wakeOff = p.wake;
  if (!p.offDays) p.offDays = [6, 0];
  if (!p.split) p.split = "full";
  if (!p.trainDays) p.trainDays = TRAINDAY_DEFAULTS[p.days] || TRAINDAY_DEFAULTS[3];
  if (!p.gymTime) p.gymTime = "18:00";
  if (!p.pace) p.pace = 0.8;
  return p;
}

const store = {
  getProfile: () => upgradeProfile(JSON.parse(localStorage.getItem("fatgo-profile") || "null")),
  setProfile: (p) => { localStorage.setItem("fatgo-profile", JSON.stringify(p)); window.queueSync?.(); },
  getLog: () => JSON.parse(localStorage.getItem("fatgo-log") || "[]"),
  setLog: (l) => { localStorage.setItem("fatgo-log", JSON.stringify(l)); window.queueSync?.(); },
};
