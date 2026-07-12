// Fatgo v1 — all data lives in localStorage, you are test user #1.

const $ = (id) => document.getElementById(id);

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

/* ================= UNITS =================
   Profile and log always store kg + cm; units only affect inputs and display. */

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

let units = JSON.parse(localStorage.getItem("fatgo-units") || '{"weight":"kg","height":"cm"}');

const round1 = (n) => Math.round(n * 10) / 10;
const kgToDisplay = (kg) => (units.weight === "lb" ? round1(kg / KG_PER_LB) : round1(kg));
const displayToKg = (v) => (units.weight === "lb" ? round1(v * KG_PER_LB) : v);

function readHeightCm() {
  if (units.height === "ftin") {
    return round1((Number($("height-ft").value) * 12 + Number($("height-in").value || 0)) * CM_PER_IN);
  }
  return Number($("height").value);
}

function fillHeightInputs(cm) {
  if (units.height === "ftin") {
    const inches = cm / CM_PER_IN;
    $("height-ft").value = Math.floor(inches / 12);
    $("height-in").value = round1(inches % 12);
  } else {
    $("height").value = round1(cm);
  }
}

function applyUnits() {
  document.querySelectorAll(".unit-toggle").forEach((tg) => {
    tg.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b.dataset.unit === units[tg.dataset.for]));
  });

  const lb = units.weight === "lb";
  const w = $("weight");
  w.min = lb ? 77 : 35;
  w.max = lb ? 550 : 250;
  w.placeholder = lb ? "180" : "82";
  const logW = $("log-weight");
  logW.min = w.min;
  logW.max = w.max;
  logW.placeholder = `Today's weight (${units.weight})`;

  const imperial = units.height === "ftin";
  $("height").classList.toggle("hidden", imperial);
  $("height").required = !imperial;
  $("height-ftin").classList.toggle("hidden", !imperial);
  $("height-ft").required = imperial;
}

document.querySelectorAll(".unit-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const field = btn.closest(".unit-toggle").dataset.for;
    const next = btn.dataset.unit;
    if (units[field] === next) return;

    // convert whatever is already typed so the value survives the switch
    if (field === "weight" && $("weight").value) {
      const v = Number($("weight").value);
      $("weight").value = round1(next === "lb" ? v / KG_PER_LB : v * KG_PER_LB);
    }
    if (field === "height") {
      const cm = units.height === "ftin"
        ? ($("height-ft").value ? readHeightCm() : null)
        : ($("height").value ? Number($("height").value) : null);
      units[field] = next;
      if (cm) fillHeightInputs(cm);
    } else {
      units[field] = next;
    }

    localStorage.setItem("fatgo-units", JSON.stringify(units));
    window.queueSync?.();
    applyUnits();
    drawChart();
  });
});

/* ================= CALCULATIONS ================= */

// BMR: Katch-McArdle when body fat % is known (uses lean mass, more accurate),
// otherwise Mifflin-St Jeor.
function bmr(p) {
  if (p.bodyfat) {
    const leanMass = p.weight * (1 - p.bodyfat / 100);
    return 370 + 21.6 * leanMass;
  }
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

const PACE_LINES = {
  0.9: "A relaxed ~10% deficit — slower fat loss, but the easiest plan to stay on.",
  0.8: "A ~20% calorie deficit — built to lose roughly 0.5-1% of body weight per week while keeping muscle.",
  0.75: "An aggressive ~25% deficit — faster results; protein and sleep matter even more here.",
};

function targets(p) {
  const maintenance = bmr(p) * p.activity;
  const calories = Math.round(maintenance * (p.pace || 0.8)); // deficit size the user picked
  const protein = Math.round(p.weight * 1.8);     // 1.8 g/kg preserves lean mass in a deficit
  const fat = Math.round((calories * 0.25) / 9);  // 25% of calories from fat
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { maintenance: Math.round(maintenance), calories, protein, fat, carbs };
}

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

/* ================= WORKOUTS ================= */

// ex(dbName, label) renders a clickable exercise that opens its demo + instructions.
// dbName must match a "name" in exercises.json exactly.
const ex = (dbName, label) =>
  `<button type="button" class="ex-link" data-ex="${dbName}">${label || dbName}</button>`;

const LIFTS = {
  fullA: [
    `${ex("Barbell Squat", "Squat")} or ${ex("Leg Press", "leg press")} — 3×8`,
    `${ex("Barbell Bench Press - Medium Grip", "Bench press")} or ${ex("Pushups", "push-ups")} — 3×8`,
    `${ex("Bent Over Barbell Row", "Bent-over row")} — 3×10`,
    `${ex("Plank")} — 3×45s`,
  ],
  fullB: [
    `${ex("Barbell Deadlift", "Deadlift")} or ${ex("Romanian Deadlift", "hip hinge")} — 3×6`,
    `${ex("Standing Military Press", "Overhead press")} — 3×8`,
    `${ex("Full Range-Of-Motion Lat Pulldown", "Lat pulldown")} or ${ex("Pullups", "pull-ups")} — 3×10`,
    `${ex("Bodyweight Walking Lunge", "Walking lunges")} — 3×12`,
  ],
  upper: [
    `${ex("Barbell Bench Press - Medium Grip", "Bench press")} — 3×8`,
    `${ex("Bent Over Barbell Row", "Row")} — 3×10`,
    `${ex("Standing Military Press", "Overhead press")} — 3×10`,
    `${ex("Full Range-Of-Motion Lat Pulldown", "Lat pulldown")} — 3×10`,
    `${ex("Barbell Curl", "Curls")} + ${ex("Triceps Pushdown", "triceps")} — 2×12 each`,
  ],
  lower: [
    `${ex("Barbell Squat", "Squat")} — 3×8`,
    `${ex("Romanian Deadlift", "Romanian deadlift")} — 3×10`,
    `${ex("Leg Press", "Leg press")} — 3×12`,
    `${ex("Standing Calf Raises", "Calf raises")} + core — 3×15`,
  ],
  push: [
    `${ex("Barbell Bench Press - Medium Grip", "Bench press")} — 4×8`,
    `${ex("Standing Military Press", "Overhead press")} — 3×10`,
    `${ex("Incline Dumbbell Press", "Incline dumbbell press")} — 3×10`,
    `${ex("Side Lateral Raise", "Lateral raises")} — 3×15`,
    `${ex("Triceps Pushdown", "Triceps pushdown")} — 3×12`,
  ],
  pull: [
    `${ex("Barbell Deadlift", "Deadlift")} — 3×6`,
    `${ex("Full Range-Of-Motion Lat Pulldown", "Lat pulldown")} or ${ex("Pullups", "pull-ups")} — 3×10`,
    `${ex("Seated Cable Rows", "Cable row")} — 3×10`,
    `${ex("Face Pull", "Face pulls")} — 3×15`,
    `${ex("Barbell Curl", "Curls")} — 3×12`,
  ],
  legs: [
    `${ex("Barbell Squat", "Squat")} — 3×8`,
    `${ex("Romanian Deadlift", "Romanian deadlift")} — 3×10`,
    `${ex("Leg Press", "Leg press")} — 3×12`,
    `${ex("Lying Leg Curls", "Leg curls")} — 3×12`,
    `${ex("Standing Calf Raises", "Calf raises")} — 3×15`,
  ],
  chest: [
    `${ex("Barbell Bench Press - Medium Grip", "Bench press")} — 4×8`,
    `${ex("Incline Dumbbell Press", "Incline dumbbell press")} — 3×10`,
    `${ex("Dumbbell Flyes", "Dumbbell flyes")} — 3×12`,
    `${ex("Cable Crossover", "Cable crossover")} or ${ex("Pushups", "push-ups")} — 2×15`,
  ],
  back: [
    `${ex("Barbell Deadlift", "Deadlift")} — 3×6`,
    `${ex("Full Range-Of-Motion Lat Pulldown", "Lat pulldown")} or ${ex("Pullups", "pull-ups")} — 3×10`,
    `${ex("Bent Over Barbell Row", "Bent-over row")} — 3×10`,
    `${ex("Seated Cable Rows", "Cable row")} — 3×12`,
  ],
  shoulders: [
    `${ex("Standing Military Press", "Overhead press")} — 4×8`,
    `${ex("Side Lateral Raise", "Lateral raises")} — 3×15`,
    `${ex("Front Dumbbell Raise", "Front raises")} — 3×12`,
    `${ex("Reverse Flyes", "Reverse flyes")} — 3×15`,
  ],
  arms: [
    `${ex("Barbell Curl", "Barbell curls")} — 3×10`,
    `${ex("Close-Grip Barbell Bench Press", "Close-grip bench")} — 3×10`,
    `${ex("Hammer Curls", "Hammer curls")} — 3×12`,
    `${ex("Triceps Pushdown", "Triceps pushdown")} — 3×12`,
    `${ex("Bench Dips", "Bench dips")} — 2×max`,
  ],
  chestTri: [
    `${ex("Barbell Bench Press - Medium Grip", "Bench press")} — 4×8`,
    `${ex("Incline Dumbbell Press", "Incline dumbbell press")} — 3×10`,
    `${ex("Dumbbell Flyes", "Dumbbell flyes")} — 3×12`,
    `${ex("Triceps Pushdown", "Triceps pushdown")} — 3×12`,
  ],
  backBi: [
    `${ex("Barbell Deadlift", "Deadlift")} — 3×6`,
    `${ex("Full Range-Of-Motion Lat Pulldown", "Lat pulldown")} or ${ex("Pullups", "pull-ups")} — 3×10`,
    `${ex("Seated Cable Rows", "Cable row")} — 3×10`,
    `${ex("Barbell Curl", "Curls")} — 3×12`,
  ],
  legsShoulders: [
    `${ex("Barbell Squat", "Squat")} — 3×8`,
    `${ex("Romanian Deadlift", "Romanian deadlift")} — 3×10`,
    `${ex("Standing Military Press", "Overhead press")} — 3×10`,
    `${ex("Side Lateral Raise", "Lateral raises")} — 3×15`,
  ],
  shouldersArms: [
    `${ex("Standing Military Press", "Overhead press")} — 4×8`,
    `${ex("Side Lateral Raise", "Lateral raises")} — 3×15`,
    `${ex("Barbell Curl", "Curls")} — 3×12`,
    `${ex("Triceps Pushdown", "Triceps pushdown")} — 3×12`,
  ],
  cardio: ["30-40 min brisk walk, incline treadmill, or cycling (zone 2 — you can still talk)"],
};

const SPLIT_NOTES = {
  full: "Full body 3×/week is the most evidence-backed way to start — every muscle gets trained often.",
  ul: "Upper / Lower — each half of the body gets hit twice a week with more exercises per session.",
  ppl: "Push / Pull / Legs — pushing muscles, pulling muscles, and legs each get their own day.",
  bro: "Bro split — one muscle group per session, maximum volume and focus per body part.",
};

// Sessions are defined per split and per week-count, then mapped onto the
// days the user actually picked — no more hardcoded Mon/Wed/Fri.
function workoutPlan(p) {
  const s = (name, items) => ({ name, items });
  const L = LIFTS;
  const sessions = {
    full: {
      3: [s("Full body A", L.fullA), s("Full body B", L.fullB), s("Full body A", L.fullA)],
      4: [s("Full body A", L.fullA), s("Full body B", L.fullB), s("Full body A", L.fullA), s("Full body B", L.fullB)],
      5: [s("Full body A", L.fullA), s("Full body B", L.fullB), s("Easy cardio", L.cardio), s("Full body A", L.fullA), s("Full body B", L.fullB)],
    },
    ul: {
      3: [s("Upper body", L.upper), s("Lower body", L.lower), s("Upper body", L.upper)],
      4: [s("Upper body", L.upper), s("Lower body", L.lower), s("Upper body", L.upper), s("Lower body", L.lower)],
      5: [s("Upper body", L.upper), s("Lower body", L.lower), s("Easy cardio", L.cardio), s("Upper body", L.upper), s("Lower body", L.lower)],
    },
    ppl: {
      3: [s("Push", L.push), s("Pull", L.pull), s("Legs", L.legs)],
      4: [s("Push", L.push), s("Pull", L.pull), s("Legs", L.legs), s("Upper body", L.upper)],
      5: [s("Push", L.push), s("Pull", L.pull), s("Legs", L.legs), s("Upper body", L.upper), s("Lower body", L.lower)],
    },
    bro: {
      3: [s("Chest & triceps", L.chestTri), s("Back & biceps", L.backBi), s("Legs & shoulders", L.legsShoulders)],
      4: [s("Chest", L.chest), s("Back", L.back), s("Shoulders & arms", L.shouldersArms), s("Legs", L.legs)],
      5: [s("Chest", L.chest), s("Back", L.back), s("Legs", L.legs), s("Shoulders", L.shoulders), s("Arms", L.arms)],
    },
  };
  const bySplit = sessions[p.split] || sessions.full;
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => p.trainDays.includes(d)); // Mon-first
  const n = Math.min(Math.max(days.length, 3), 5);
  const cards = bySplit[n].map((sess, i) => ({ dayIdx: days[i], day: DAY_NAMES[days[i]], ...sess }));
  if (n <= 4) cards.push({ dayIdx: -1, day: "Any rest day", name: "Easy cardio (optional)", items: L.cardio });
  return cards;
}

/* ================= FOOD ================= */

function foodTips(t) {
  return [
    `<b>Protein first (${t.protein} g/day):</b> chicken, fish, lean beef, eggs, Greek yogurt, cottage cheese, beans. Roughly a palm-sized portion at every meal.`,
    `<b>Carbs (${t.carbs} g/day):</b> rice, potatoes, oats, fruit, whole-grain bread — put most of them in the meals before and after training.`,
    `<b>Fats (${t.fat} g/day):</b> olive oil, avocado, nuts, fatty fish. Easy to overdo — measure oils.`,
    `<b>Fill half the plate with vegetables:</b> huge volume, almost no calories — this is the #1 hunger-control trick in fat-loss studies.`,
    `<b>Drink water before meals</b> and cut liquid calories (soda, juice, sugary coffee) — they don't register as food to your brain.`,
    `<b>80/20 rule:</b> hit the targets ~80% of the time. Consistency beats perfection in every long-term study.`,
  ];
}

/* ================= RENDER ================= */

function showDashboard(p) {
  $("setup").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("edit-profile-btn").classList.remove("hidden");
  $("top-nav").classList.remove("hidden");

  const t = targets(p);

  $("goal-line").textContent = PACE_LINES[p.pace] || PACE_LINES[0.8];
  $("stat-cals").textContent = t.calories;
  $("stat-protein").textContent = t.protein;
  $("stat-fat").textContent = t.fat;
  $("stat-carbs").textContent = t.carbs;
  $("tdee-line").textContent =
    `Your body burns about ${t.maintenance} kcal/day at your current stats — eating ${t.calories} creates the deficit that forces it to burn fat instead.`;

  renderTimeline(p);

  const plan = workoutPlan(p);
  const todayIdx = new Date().getDay();
  const todays = plan.find((wk) => wk.dayIdx === todayIdx);
  const todayLine = todays
    ? `Today is ${DAY_NAMES[todayIdx]} — ${todays.name} day.`
    : `Today is ${DAY_NAMES[todayIdx]} — rest day, recovery is where muscle is built.`;
  $("workout-sub").textContent =
    `${todayLine} ${SPLIT_NOTES[p.split] || SPLIT_NOTES.full} Tap any exercise to see how it's done.`;
  $("workout-list").innerHTML = plan
    .map((wk) => `<div class="workout card${wk.dayIdx === todayIdx ? " today" : ""}"><div class="day-tag">${wk.day}${wk.dayIdx === todayIdx ? " · today" : ""}</div><h3>${wk.name}</h3><ul>${wk.items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`)
    .join("");

  $("food-list").innerHTML = foodTips(t).map((f) => `<li>${f}</li>`).join("");

  loadExercises();
  renderIntake();
  drawChart();
}

/* ================= WEIGHT LOG + CHART ================= */

function drawChart() {
  const log = store.getLog();
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (log.length < 2) return;

  const weights = log.map((e) => kgToDisplay(e.weight));
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const pad = 34;
  const W = canvas.width - pad * 2;
  const H = canvas.height - pad * 2;
  const x = (i) => pad + (i / (log.length - 1)) * W;
  const y = (w) => pad + (1 - (w - min) / (max - min)) * H;

  ctx.strokeStyle = "#262b33";
  ctx.beginPath();
  ctx.moveTo(pad, canvas.height - pad);
  ctx.lineTo(canvas.width - pad, canvas.height - pad);
  ctx.stroke();

  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 2;
  ctx.beginPath();
  weights.forEach((w, i) => (i ? ctx.lineTo(x(i), y(w)) : ctx.moveTo(x(i), y(w))));
  ctx.stroke();

  ctx.fillStyle = "#4ade80";
  weights.forEach((w, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(w), 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#9aa3ad";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${weights[0]} ${units.weight}`, x(0), y(weights[0]) - 10);
  ctx.fillText(`${weights[weights.length - 1]} ${units.weight}`, x(log.length - 1) - 40, y(weights[weights.length - 1]) - 10);

  const change = (weights[weights.length - 1] - weights[0]).toFixed(1);
  $("trend-line").textContent =
    `${log.length} entries · ${change <= 0 ? "" : "+"}${change} ${units.weight} since you started. Daily numbers bounce around — the trend is what counts.`;
}

/* ================= EXERCISE LIBRARY =================
   Data: free-exercise-db (public domain) — vendored as exercises.json.
   Photos are loaded from the dataset's repo, pinned to a commit so links never rot. */

const EXDB_IMG =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/b0eed061e1c832b3ed815fbaa4b45b3cdc14df49/exercises/";

let exercises = null;           // full dataset, loaded once
const exByName = new Map();

async function loadExercises() {
  if (exercises) return exercises;
  const res = await fetch("exercises.json");
  exercises = await res.json();
  exercises.forEach((e) => exByName.set(e.name, e));
  fillLibraryFilters();
  renderLibrary();
  return exercises;
}

function fillLibraryFilters() {
  const muscles = new Set(), equipment = new Set();
  exercises.forEach((e) => {
    e.primaryMuscles.forEach((m) => muscles.add(m));
    if (e.equipment) equipment.add(e.equipment);
  });
  const fill = (id, values) =>
    ($(id).innerHTML += [...values].sort().map((v) => `<option value="${v}">${v}</option>`).join(""));
  fill("lib-muscle", muscles);
  fill("lib-equipment", equipment);
  fill("lib-level", ["beginner", "intermediate", "expert"]);
}

/* Each exercise has two photos (start + end position); flipping between them
   every 900ms turns them into a lightweight animated demo. */
let animFrame = 0;
setInterval(() => {
  animFrame = 1 - animFrame;
  document.querySelectorAll("img.ex-anim").forEach((img) => {
    const next = animFrame ? img.dataset.f1 : img.dataset.f0;
    if (next) img.src = next;
  });
}, 900);

function exImg(e, cls) {
  const f0 = EXDB_IMG + e.images[0];
  const f1 = EXDB_IMG + (e.images[1] || e.images[0]);
  return `<img class="ex-anim ${cls}" src="${f0}" data-f0="${f0}" data-f1="${f1}" alt="${e.name} demonstration" loading="lazy">`;
}

const PAGE_SIZE = 24;
let libShown = PAGE_SIZE;

function libraryHits() {
  const q = $("lib-search").value.trim().toLowerCase();
  const m = $("lib-muscle").value;
  const eq = $("lib-equipment").value;
  const lv = $("lib-level").value;
  return exercises.filter((e) =>
    (!q || e.name.toLowerCase().includes(q)) &&
    (!m || e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m)) &&
    (!eq || e.equipment === eq) &&
    (!lv || e.level === lv));
}

function renderLibrary() {
  if (!exercises) return;
  const hits = libraryHits();
  $("lib-results").innerHTML = hits.slice(0, libShown)
    .map((e) => `
      <button type="button" class="ex-card" data-ex="${e.name}">
        ${exImg(e, "ex-thumb")}
        <div class="ex-card-name">${e.name}</div>
        <div class="ex-card-meta">${e.primaryMuscles[0] || ""}${e.equipment ? " · " + e.equipment : ""}</div>
      </button>`)
    .join("") || `<p class="fine">No exercises match — try clearing a filter.</p>`;
  $("lib-more").classList.toggle("hidden", hits.length <= libShown);
  $("lib-count").textContent = `Showing ${Math.min(libShown, hits.length)} of ${hits.length} exercises`;
}

["lib-search", "lib-muscle", "lib-equipment", "lib-level"].forEach((id) =>
  $(id).addEventListener("input", () => { libShown = PAGE_SIZE; renderLibrary(); }));

$("lib-more").addEventListener("click", () => { libShown += PAGE_SIZE; renderLibrary(); });

/* --- detail modal --- */

async function openExercise(name) {
  await loadExercises();
  const e = exByName.get(name);
  if (!e) return;
  const chips = [e.level, e.equipment, e.category].filter(Boolean)
    .map((c) => `<span class="chip">${c}</span>`).join("");
  const muscles = [
    `<b>Targets:</b> ${e.primaryMuscles.join(", ") || "—"}`,
    e.secondaryMuscles.length ? `<b>Also works:</b> ${e.secondaryMuscles.join(", ")}` : "",
  ].filter(Boolean).join(" · ");
  $("ex-body").innerHTML = `
    <h3 class="ex-title">${e.name}</h3>
    <div class="chip-row">${chips}</div>
    ${exImg(e, "ex-photo")}
    <p class="ex-muscles">${muscles}</p>
    <ol class="ex-steps">${e.instructions.map((s) => `<li>${s}</li>`).join("")}</ol>`;
  $("ex-modal").classList.remove("hidden");
  document.body.classList.add("no-scroll");
}

function closeExercise() {
  $("ex-modal").classList.add("hidden");
  document.body.classList.remove("no-scroll");
}

document.addEventListener("click", (evt) => {
  const link = evt.target.closest("[data-ex]");
  if (link) openExercise(link.dataset.ex);
  if (evt.target === $("ex-modal") || evt.target.closest("#ex-close")) closeExercise();
});
document.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape") closeExercise();
});

/* ================= FOOD LOOKUP + INTAKE TRACKER =================
   Data: USDA FoodData Central, SR Legacy release (public domain, CC0) —
   vendored as foods.json. Macros are per 100 g; portions carry gram weights. */

let foods = null;          // full dataset, loaded on first search
let foodHits = [];         // current search results
let expandedHit = -1;      // index in foodHits with the portion picker open

async function loadFoods() {
  if (foods) return foods;
  const res = await fetch("foods.json");
  foods = await res.json();
  return foods;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function searchFoods(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return foods
    .filter((f) => { const n = f.n.toLowerCase(); return terms.every((t) => n.includes(t)); })
    .sort((a, b) => a.n.length - b.n.length)   // shortest name ≈ most canonical match
    .slice(0, 12);
}

function renderFoodResults() {
  $("food-results").innerHTML = foodHits.map((f, i) => `
    <div class="food-hit ${i === expandedHit ? "open" : ""}" data-fi="${i}">
      <div class="food-hit-row">
        <div>
          <div class="food-hit-name">${esc(f.n)}</div>
          <div class="food-hit-meta">${f.kcal} kcal · P ${f.p} · F ${f.f} · C ${f.c} — per 100 g</div>
        </div>
        <span class="food-hit-plus">${i === expandedHit ? "−" : "+"}</span>
      </div>
      ${i === expandedHit ? `
      <div class="food-add">
        <select id="portion-sel">
          <option value="100">100 g</option>
          ${f.por.map((p) => `<option value="${p[1]}">${esc(p[0])} (${p[1]} g)</option>`).join("")}
        </select>
        <input type="number" id="portion-qty" value="1" min="0.1" step="0.1">
        <button type="button" class="primary-btn" id="portion-add">Add</button>
      </div>
      <p class="fine" id="portion-preview"></p>` : ""}
    </div>`).join("");
  if (expandedHit >= 0) updatePortionPreview();
}

function portionGrams() {
  return Number($("portion-sel").value) * (Number($("portion-qty").value) || 0);
}

function updatePortionPreview() {
  const f = foodHits[expandedHit];
  const g = portionGrams();
  $("portion-preview").textContent =
    `${round1(g)} g → ${Math.round((f.kcal * g) / 100)} kcal · ${round1((f.p * g) / 100)} g protein · ${round1((f.f * g) / 100)} g fat · ${round1((f.c * g) / 100)} g carbs`;
}

/* --- today's intake (localStorage, resets each day) --- */

function getIntake() {
  const today = new Date().toISOString().slice(0, 10);
  const it = JSON.parse(localStorage.getItem("fatgo-intake") || "null");
  return it && it.date === today ? it : { date: today, items: [] };
}
const setIntake = (it) => { localStorage.setItem("fatgo-intake", JSON.stringify(it)); window.queueSync?.(); };

function renderIntake() {
  const p = store.getProfile();
  if (!p) return;
  const t = targets(p);
  const it = getIntake();
  const sum = (k) => it.items.reduce((a, x) => a + x[k], 0);
  const bars = [
    ["kcal", Math.round(sum("kcal")), t.calories, "kcal"],
    ["protein", Math.round(sum("p")), t.protein, "g"],
    ["fat", Math.round(sum("f")), t.fat, "g"],
    ["carbs", Math.round(sum("c")), t.carbs, "g"],
  ];
  $("intake-bars").innerHTML = it.items.length ? bars.map(([label, got, goal, unit]) => `
    <div class="bar-row">
      <div class="bar-label">${label}</div>
      <div class="bar"><div class="bar-fill ${got > goal * 1.05 ? "over" : ""}" style="width:${Math.min(100, (got / goal) * 100)}%"></div></div>
      <div class="bar-nums">${got} / ${goal} ${unit}</div>
    </div>`).join("") : "";
  $("intake-list").innerHTML = it.items.map((x, i) => `
    <li class="intake-item">
      <span>${esc(x.n)} <span class="food-hit-meta">${round1(x.g)} g · ${Math.round(x.kcal)} kcal</span></span>
      <button type="button" class="ghost-btn intake-del" data-del="${i}">✕</button>
    </li>`).join("");
  $("intake-hint").classList.toggle("hidden", it.items.length > 0);

  // hero calorie ring
  const eaten = Math.round(sum("kcal"));
  const pct = Math.min(100, (eaten / t.calories) * 100);
  const col = eaten > t.calories * 1.05 ? "#f59e0b" : "var(--accent)";
  $("cal-ring").style.background = `conic-gradient(${col} ${pct}%, #1c2129 0)`;
  $("ring-kcal").textContent = eaten;
  $("ring-label").textContent = `of ${t.calories} kcal`;
  $("ring-hint").textContent = eaten
    ? (eaten > t.calories ? `${eaten - t.calories} kcal over target` : `${t.calories - eaten} kcal left today`)
    : "Log food below to fill the ring";
}

/* --- events --- */

$("food-search").addEventListener("input", async () => {
  await loadFoods();
  expandedHit = -1;
  foodHits = searchFoods($("food-search").value);
  renderFoodResults();
});

$("food-results").addEventListener("click", (evt) => {
  if (evt.target.id === "portion-add") {
    const f = foodHits[expandedHit];
    const g = portionGrams();
    if (g > 0) {
      const it = getIntake();
      it.items.push({ n: f.n, g, kcal: (f.kcal * g) / 100, p: (f.p * g) / 100, f: (f.f * g) / 100, c: (f.c * g) / 100 });
      setIntake(it);
      expandedHit = -1;
      $("food-search").value = "";
      foodHits = [];
      renderFoodResults();
      renderIntake();
    }
    return;
  }
  if (evt.target.closest(".food-add")) return; // don't toggle while using the picker
  const hit = evt.target.closest(".food-hit");
  if (hit) {
    const i = Number(hit.dataset.fi);
    expandedHit = expandedHit === i ? -1 : i;
    renderFoodResults();
  }
});

$("food-results").addEventListener("input", (evt) => {
  if (evt.target.id === "portion-sel" || evt.target.id === "portion-qty") updatePortionPreview();
});

$("intake-list").addEventListener("click", (evt) => {
  const btn = evt.target.closest("[data-del]");
  if (!btn) return;
  const it = getIntake();
  it.items.splice(Number(btn.dataset.del), 1);
  setIntake(it);
  renderIntake();
});

/* ================= EVENTS ================= */

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
