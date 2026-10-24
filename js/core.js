/* ================= CORE =================
   The handful of helpers that nearly every other file needs. Loaded first:
   the $ shorthand is used at load time by the addEventListener calls in
   units.js, exercise-library.js, food-log.js and forms.js, so it has to
   exist before any of them run. */

const $ = (id) => document.getElementById(id);

// Rounding to one decimal — used by unit conversion, the chart labels and the
// portion/macro previews, so it lives here rather than in any one of them.
const round1 = (n) => Math.round(n * 10) / 10;

// getDay() order (Sun=0), matching what the day-picker buttons store.
// Shared by timeline.js, workouts.js and dashboard.js.
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
