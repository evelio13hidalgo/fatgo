/* ================= UNITS =================
   Profile and log always store kg + cm; units only affect inputs and display. */

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

let units = JSON.parse(localStorage.getItem("fatgo-units") || '{"weight":"kg","height":"cm"}');

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
