/* ================= DASHBOARD =================
   Assembles the main screen from every other module: targets (calculations),
   renderTimeline (timeline), workoutPlan (workouts), foodTips (nutrition),
   then kicks off the library, intake and chart renders. */

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
