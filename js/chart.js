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
