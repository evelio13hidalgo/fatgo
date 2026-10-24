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
