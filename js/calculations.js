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
