/* ================= NUTRITION ADVICE =================
   Static coaching copy for the dashboard's food section, interpolated with the
   user's own macro targets. Looking up actual foods is food-log.js. */

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
