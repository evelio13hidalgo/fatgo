/* ================= FOOD LOOKUP + INTAKE TRACKER =================
   Data: USDA FoodData Central, SR Legacy release (public domain, CC0) —
   vendored as foods.json. Macros are per 100 g; portions carry gram weights. */

let foods = null;          // full dataset, loaded on first search
let foodHits = [];         // current search results
let expandedHit = -1;      // index in foodHits with the portion picker open

async function loadFoods() {
  if (foods) return foods;
  const res = await fetch("data/foods.json");
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
