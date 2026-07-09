// Fatgo v1 — all data lives in localStorage, you are test user #1.

const $ = (id) => document.getElementById(id);

const store = {
  getProfile: () => JSON.parse(localStorage.getItem("fatgo-profile") || "null"),
  setProfile: (p) => localStorage.setItem("fatgo-profile", JSON.stringify(p)),
  getLog: () => JSON.parse(localStorage.getItem("fatgo-log") || "[]"),
  setLog: (l) => localStorage.setItem("fatgo-log", JSON.stringify(l)),
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

function targets(p) {
  const maintenance = bmr(p) * p.activity;
  const calories = Math.round(maintenance * 0.8); // ~20% deficit: fat loss while keeping muscle
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

function timeline(p) {
  const w = p.wake;
  return [
    { time: w, what: "Wake up — weigh yourself, drink water", why: "Morning weight (before food) is your most consistent data point." },
    { time: addMinutes(w, 60), what: "First meal — high protein", why: "Protein has the highest thermic effect: your body burns ~20-30% of its calories just digesting it. This is the closest thing to 'kick-starting' your metabolism." },
    { time: addMinutes(w, 300), what: "Lunch — protein + carbs + veg", why: "Keeps energy stable and hunger down through the afternoon." },
    { time: addMinutes(w, 540), what: "Train (on workout days)", why: "Late afternoon is when strength and body temperature peak for most people — you'll lift more and burn more." },
    { time: addMinutes(w, 630), what: "Dinner — biggest protein hit + carbs", why: "Eating carbs after training refills muscle fuel instead of being stored as fat." },
    { time: addMinutes(w, 840), what: "Kitchen closed", why: "Stopping ~2-3h before bed improves sleep, and poor sleep raises hunger hormones the next day." },
    { time: addMinutes(w, 960), what: "Sleep — aim for 7-9h", why: "Studies show short sleep makes the weight you lose come from muscle instead of fat." },
  ];
}

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
  cardio: ["30-40 min brisk walk, incline treadmill, or cycling (zone 2 — you can still talk)"],
};

function workoutPlan(days) {
  const plans = {
    3: [
      { day: "Mon", name: "Full body A", items: LIFTS.fullA },
      { day: "Wed", name: "Full body B", items: LIFTS.fullB },
      { day: "Fri", name: "Full body A", items: LIFTS.fullA },
      { day: "Sat", name: "Easy cardio", items: LIFTS.cardio },
    ],
    4: [
      { day: "Mon", name: "Upper body", items: LIFTS.upper },
      { day: "Tue", name: "Lower body", items: LIFTS.lower },
      { day: "Thu", name: "Upper body", items: LIFTS.upper },
      { day: "Fri", name: "Lower body", items: LIFTS.lower },
      { day: "Sun", name: "Easy cardio", items: LIFTS.cardio },
    ],
    5: [
      { day: "Mon", name: "Upper body", items: LIFTS.upper },
      { day: "Tue", name: "Lower body", items: LIFTS.lower },
      { day: "Wed", name: "Easy cardio", items: LIFTS.cardio },
      { day: "Thu", name: "Upper body", items: LIFTS.upper },
      { day: "Fri", name: "Lower body", items: LIFTS.lower },
    ],
  };
  return plans[days] || plans[3];
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

  const t = targets(p);

  $("goal-line").textContent =
    `A ~20% calorie deficit — built to lose roughly 0.5-1% of body weight per week while keeping muscle.`;
  $("stat-cals").textContent = t.calories;
  $("stat-protein").textContent = t.protein;
  $("stat-fat").textContent = t.fat;
  $("stat-carbs").textContent = t.carbs;
  $("tdee-line").textContent =
    `Your body burns about ${t.maintenance} kcal/day at your current stats — eating ${t.calories} creates the deficit that forces it to burn fat instead.`;

  $("timeline").innerHTML = timeline(p)
    .map((s) => `<div class="tl-item"><div class="tl-time">${s.time}</div><div><div class="tl-what">${s.what}</div><div class="tl-why">${s.why}</div></div></div>`)
    .join("");

  $("workout-list").innerHTML = workoutPlan(Number(p.days))
    .map((wk) => `<div class="workout card"><div class="day-tag">${wk.day}</div><h3>${wk.name}</h3><ul>${wk.items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`)
    .join("");

  $("food-list").innerHTML = foodTips(t).map((f) => `<li>${f}</li>`).join("");

  loadExercises();
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

/* ================= EVENTS ================= */

$("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const p = {
    age: Number($("age").value),
    sex: $("sex").value,
    height: readHeightCm(),
    weight: displayToKg(Number($("weight").value)),
    bodyfat: Number($("bodyfat").value) || null,
    wake: $("wake").value,
    activity: Number($("activity").value),
    days: Number($("days").value),
  };
  store.setProfile(p);
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
    $("activity").value = p.activity;
    $("days").value = p.days;
  }
  $("dashboard").classList.add("hidden");
  $("setup").classList.remove("hidden");
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

/* ================= INIT ================= */

applyUnits();
const saved = store.getProfile();
if (saved) showDashboard(saved);
