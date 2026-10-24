/* ================= EXERCISE LIBRARY =================
   Data: free-exercise-db (public domain) — vendored as exercises.json.
   Photos are loaded from the dataset's repo, pinned to a commit so links never rot. */

const EXDB_IMG =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/b0eed061e1c832b3ed815fbaa4b45b3cdc14df49/exercises/";

let exercises = null;           // full dataset, loaded once
const exByName = new Map();

async function loadExercises() {
  if (exercises) return exercises;
  const res = await fetch("data/exercises.json");
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
