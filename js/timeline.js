/* ================= TIMELINE ================= */

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + mins + 1440) % 1440;
  const hh = String(Math.floor(t / 60)).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// trainAt: minutes after wake-up when the user can actually train (from their
// after-work availability on work days). Meals after training shift with it.
function timeline(w, trainAt, trainWhy) {
  const dinnerAt = trainAt + 90;
  const kitchenAt = Math.max(840, dinnerAt + 60);
  const sleepAt = Math.max(960, kitchenAt + 90);
  return [
    { at: 0, what: "Wake up — weigh yourself, drink water", why: "Morning weight (before food) is your most consistent data point." },
    { at: 60, what: "First meal — high protein", why: "Protein has the highest thermic effect: your body burns ~20-30% of its calories just digesting it. This is the closest thing to 'kick-starting' your metabolism." },
    { at: 300, what: "Lunch — protein + carbs + veg", why: "Keeps energy stable and hunger down through the afternoon." },
    { at: trainAt, what: "Train (on training days)", why: trainWhy },
    { at: dinnerAt, what: "Dinner — biggest protein hit + carbs", why: "Eating carbs after training refills muscle fuel instead of being stored as fat." },
    { at: kitchenAt, what: "Kitchen closed", why: "Stopping ~2-3h before bed improves sleep, and poor sleep raises hunger hormones the next day." },
    { at: sleepAt, what: "Sleep — aim for 7-9h", why: "Studies show short sleep makes the weight you lose come from muscle instead of fat." },
  ]
    .sort((a, b) => a.at - b.at)
    .map((s) => ({ time: addMinutes(w, s.at), what: s.what, why: s.why }));
}

/* Two schedules: work days and days off, each with its own wake-up time.
   p.offDays holds getDay() indices (Sun=0). The tab matching today opens first. */

const dayList = (days) =>
  [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(" · ");

let tlView = null; // "work" | "off" — which schedule the timeline shows

function renderTimeline(p) {
  const offDays = p.offDays || [];
  const workDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !offDays.includes(d));
  const bothUsed = offDays.length > 0 && workDays.length > 0;

  if (!tlView) tlView = offDays.includes(new Date().getDay()) ? "off" : "work";
  if (!bothUsed) tlView = workDays.length ? "work" : "off";

  $("tl-tabs").classList.toggle("hidden", !bothUsed);
  $("tl-tab-work").textContent = `Work days — up at ${p.wake} (${dayList(workDays)})`;
  $("tl-tab-off").textContent = `Days off — up at ${p.wakeOff} (${dayList(offDays)})`;
  $("tl-tab-work").classList.toggle("active", tlView === "work");
  $("tl-tab-off").classList.toggle("active", tlView === "off");

  const wake = tlView === "off" ? p.wakeOff : p.wake;
  const toMins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  // work days: train when the user said they're free after work; days off: late afternoon
  const trainAt = tlView === "off"
    ? 540
    : (toMins(p.gymTime) - toMins(p.wake) + 1440) % 1440;
  const trainWhy = tlView === "off"
    ? "Late afternoon is when strength and body temperature peak for most people — you'll lift more and burn more."
    : `You said you're free around ${p.gymTime} after work — a consistent slot you can actually hit beats a 'perfect' one you skip.`;
  $("timeline").innerHTML = timeline(wake, trainAt, trainWhy)
    .map((s) => `<div class="tl-item"><div class="tl-time">${s.time}</div><div><div class="tl-what">${s.what}</div><div class="tl-why">${s.why}</div></div></div>`)
    .join("");
}

$("tl-tabs").addEventListener("click", (evt) => {
  const tab = evt.target.closest("[data-tl]");
  if (!tab || tab.dataset.tl === tlView) return;
  tlView = tab.dataset.tl;
  renderTimeline(store.getProfile());
});
