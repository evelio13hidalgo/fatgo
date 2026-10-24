/* ================= FORMS =================
   The two forms that write data: the profile/setup form and the daily
   weigh-in. Also the day-picker chips both forms share. */

// day pickers (days off + training days): toggle chips, read the active ones on submit
["offdays", "traindays"].forEach((id) =>
  $(id).addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-day]");
    if (btn) btn.classList.toggle("active");
    if (id === "traindays") $("traindays-msg").classList.add("hidden");
  }));

const readDays = (id) =>
  [...document.querySelectorAll(`#${id} button.active`)].map((b) => Number(b.dataset.day));

$("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const trainDays = readDays("traindays");
  if (trainDays.length < 3 || trainDays.length > 5) {
    $("traindays-msg").classList.remove("hidden");
    $("traindays-msg").scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const p = {
    age: Number($("age").value),
    sex: $("sex").value,
    height: readHeightCm(),
    weight: displayToKg(Number($("weight").value)),
    bodyfat: Number($("bodyfat").value) || null,
    wake: $("wake").value,
    wakeOff: $("wake-off").value,
    gymTime: $("gym-time").value,
    offDays: readDays("offdays"),
    activity: Number($("activity").value),
    days: trainDays.length,
    trainDays,
    split: $("split").value,
    pace: Number($("pace").value),
  };
  store.setProfile(p);
  tlView = null; // re-pick the tab that matches today
  showDashboard(p);
  window.scrollTo(0, 0);
});

$("edit-profile-btn").addEventListener("click", () => {
  const p = store.getProfile();
  if (p) {
    $("age").value = p.age;
    $("sex").value = p.sex;
    fillHeightInputs(p.height);
    $("weight").value = kgToDisplay(p.weight);
    $("bodyfat").value = p.bodyfat || "";
    $("wake").value = p.wake;
    $("wake-off").value = p.wakeOff;
    $("gym-time").value = p.gymTime;
    document.querySelectorAll("#offdays button").forEach((b) =>
      b.classList.toggle("active", p.offDays.includes(Number(b.dataset.day))));
    document.querySelectorAll("#traindays button").forEach((b) =>
      b.classList.toggle("active", p.trainDays.includes(Number(b.dataset.day))));
    $("activity").value = p.activity;
    $("split").value = p.split;
    $("pace").value = String(p.pace);
  }
  $("dashboard").classList.add("hidden");
  $("setup").classList.remove("hidden");
  $("top-nav").classList.add("hidden");
});

$("log-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const log = store.getLog();
  const today = new Date().toISOString().slice(0, 10);
  const weight = displayToKg(Number($("log-weight").value));
  const existing = log.find((en) => en.date === today);
  if (existing) existing.weight = weight;
  else log.push({ date: today, weight });
  store.setLog(log);
  $("log-weight").value = "";
  drawChart();
});
