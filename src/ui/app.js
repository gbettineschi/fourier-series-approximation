import { loadPyodide } from
  'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs';

// ── DOM refs ─────────────────────────────────────────────────────────────
const CANVAS       = document.getElementById('plot');
const CTX          = CANVAS.getContext('2d');
const STATUS       = document.getElementById('status');
const N_SLIDER     = document.getElementById('n-slider');
const N_VALUE      = document.getElementById('n-value');
const ERR_DISPLAY  = document.getElementById('error-display');
const ANIMATE_BTN  = document.getElementById('animate-btn');
const FUNC_GROUP   = document.getElementById('func-group');
const CANVAS_WRAP  = document.getElementById('canvas-wrap');

// ── colors (matching CSS vars) ────────────────────────────────────────────
const C = {
  bg:      '#0d1117',
  border:  '#30363d',
  text:    '#e6edf3',
  muted:   '#7d8590',
  accent:  '#58a6ff',
  accent2: '#f0883e',
  surface: 'rgba(22,27,34,0.85)',
};

// ── plot margins (shared by draw and interaction handlers) ─────────────────
const MAR = { top: 28, right: 20, bottom: 40, left: 48 };

// ── zoom / pan constants ───────────────────────────────────────────────────
const ZOOM_MIN  = 0.15;
const ZOOM_MAX  = 20;
const ZOOM_STEP = 1.25;

// ── state ─────────────────────────────────────────────────────────────────
let pyodide     = null;
let computeFn   = null;  // pyodide callable, kept for app lifetime
let currentFunc = 'square';
let animTimer   = null;
let debouncedRender = null;

// View state — zoom centered on plot centre; offsets in CSS pixels
let viewZoom = 1.0;
let viewOffX = 0;
let viewOffY = 0;

// ── service worker (silent) ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./ui/sw.js').catch(() => {});
}

// ── helpers ───────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Returns the plot-centre in CSS pixels (depends on current canvas-wrap size)
function plotCentre() {
  const pw = CANVAS_WRAP.clientWidth  - MAR.left - MAR.right;
  const ph = CANVAS_WRAP.clientHeight - MAR.top  - MAR.bottom;
  return { cx: MAR.left + pw / 2, cy: MAR.top + ph / 2 };
}

function resetView() {
  viewZoom = 1.0;
  viewOffX = 0;
  viewOffY = 0;
}

// ── boot ──────────────────────────────────────────────────────────────────
async function init() {
  try {
    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    });
    await pyodide.loadPackage(['numpy']);

    const resp   = await fetch('./simulation/simulation.py');
    const source = await resp.text();
    await pyodide.runPythonAsync(source);

    computeFn = pyodide.globals.get('compute');

    buildFunctionRadios();
    wireControls();
    wireInteraction();

    debouncedRender = debounce(render, 50);

    new ResizeObserver(() => render()).observe(CANVAS_WRAP);

    enableControls();
    hideStatus();
    render();

  } catch (err) {
    STATUS.textContent = `Error loading Pyodide: ${err.message}`;
    console.error(err);
  }
}

// ── function radio buttons ────────────────────────────────────────────────
function buildFunctionRadios() {
  const fns = JSON.parse(pyodide.globals.get('list_functions')());

  fns.forEach(({ id, label }, i) => {
    const lbl = document.createElement('label');
    lbl.className = 'radio-row';

    const radio = document.createElement('input');
    radio.type  = 'radio';
    radio.name  = 'func';
    radio.value = id;
    if (i === 0) radio.checked = true;

    radio.addEventListener('change', () => {
      currentFunc = id;
      debouncedRender();
    });

    const span = document.createElement('span');
    span.textContent = label;

    lbl.append(radio, span);
    FUNC_GROUP.appendChild(lbl);
  });

  currentFunc = fns[0].id;
}

// ── controls ──────────────────────────────────────────────────────────────
function wireControls() {
  N_SLIDER.addEventListener('input', () => {
    N_VALUE.textContent = N_SLIDER.value;
    debouncedRender();
  });

  ANIMATE_BTN.addEventListener('click', () => {
    animTimer ? stopAnimate() : startAnimate();
  });

  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    viewZoom = Math.min(ZOOM_MAX, viewZoom * ZOOM_STEP);
    render();
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    viewZoom = Math.max(ZOOM_MIN, viewZoom / ZOOM_STEP);
    render();
  });
}

// ── interaction: drag pan + scroll zoom + pinch zoom ──────────────────────
function wireInteraction() {
  // ── mouse drag pan ──
  let dragging = false, dragX = 0, dragY = 0;

  CANVAS_WRAP.addEventListener('mousedown', e => {
    dragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    CANVAS_WRAP.classList.add('dragging');
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    viewOffX += e.clientX - dragX;
    viewOffY += e.clientY - dragY;
    dragX = e.clientX;
    dragY = e.clientY;
    render();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    CANVAS_WRAP.classList.remove('dragging');
  });

  // ── double-click to reset view ──
  CANVAS_WRAP.addEventListener('dblclick', () => {
    resetView();
    render();
  });

  // ── scroll-wheel zoom (centred on cursor) ──
  CANVAS_WRAP.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.004);
    const rect = CANVAS_WRAP.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { cx, cy } = plotCentre();
    viewOffX = (px - cx) * (1 - factor) + viewOffX * factor;
    viewOffY = (py - cy) * (1 - factor) + viewOffY * factor;
    viewZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewZoom * factor));
    render();
  }, { passive: false });

  // ── touch: single-finger pan + two-finger pinch zoom ──
  let lastTouch = null, prevPinchDist = null;

  CANVAS_WRAP.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { lastTouch = e.touches[0]; prevPinchDist = null; }
    if (e.touches.length === 2) { lastTouch = null; }
  }, { passive: true });

  CANVAS_WRAP.addEventListener('touchmove', e => {
    const rect = CANVAS_WRAP.getBoundingClientRect();
    if (e.touches.length === 1 && lastTouch) {
      viewOffX += e.touches[0].clientX - lastTouch.clientX;
      viewOffY += e.touches[0].clientY - lastTouch.clientY;
      lastTouch = e.touches[0];
      render();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (prevPinchDist !== null) {
        const factor = Math.pow(dist / prevPinchDist, 1.15);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const { cx, cy } = plotCentre();
        viewOffX = (midX - cx) * (1 - factor) + viewOffX * factor;
        viewOffY = (midY - cy) * (1 - factor) + viewOffY * factor;
        viewZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewZoom * factor));
        render();
      }
      prevPinchDist = dist;
    }
  }, { passive: true });

  CANVAS_WRAP.addEventListener('touchend', () => {
    lastTouch = null;
    prevPinchDist = null;
  }, { passive: true });
}

function enableControls() {
  N_SLIDER.disabled    = false;
  ANIMATE_BTN.disabled = false;
}

// ── loading state ─────────────────────────────────────────────────────────
function hideStatus() {
  STATUS.classList.add('hidden');
  STATUS.addEventListener('transitionend', () => {
    STATUS.style.display = 'none';
  }, { once: true });
}

// ── animate ───────────────────────────────────────────────────────────────
function startAnimate() {
  N_SLIDER.value = 1;
  N_VALUE.textContent = '1';
  N_SLIDER.disabled = true;
  ANIMATE_BTN.textContent = 'Stop';
  ANIMATE_BTN.classList.remove('primary');
  ANIMATE_BTN.classList.add('pending');

  render();

  animTimer = setInterval(() => {
    const cur = parseInt(N_SLIDER.value, 10);
    if (cur >= parseInt(N_SLIDER.max, 10)) {
      stopAnimate();
      return;
    }
    N_SLIDER.value = cur + 1;
    N_VALUE.textContent = N_SLIDER.value;
    render();
  }, 100);
}

function stopAnimate() {
  clearInterval(animTimer);
  animTimer = null;
  N_SLIDER.disabled = false;
  ANIMATE_BTN.textContent = 'Animate';
  ANIMATE_BTN.classList.remove('pending');
  ANIMATE_BTN.classList.add('primary');
}

// ── render ────────────────────────────────────────────────────────────────
function render() {
  if (!computeFn) return;

  const N    = parseInt(N_SLIDER.value, 10);
  const data = JSON.parse(computeFn(currentFunc, N));

  sizeCanvas();
  drawPlot(data, N);

  ERR_DISPLAY.textContent = data.error.toExponential(3);
}

function sizeCanvas() {
  const dpr  = window.devicePixelRatio || 1;
  const cssW = CANVAS_WRAP.clientWidth;
  const cssH = CANVAS_WRAP.clientHeight;

  CANVAS.width  = Math.round(cssW * dpr);
  CANVAS.height = Math.round(cssH * dpr);
  CANVAS.style.width  = cssW + 'px';
  CANVAS.style.height = cssH + 'px';
  CTX.scale(dpr, dpr);
}

function drawPlot(data, N) {
  const cssW = CANVAS_WRAP.clientWidth;
  const cssH = CANVAS_WRAP.clientHeight;

  const pw = cssW - MAR.left - MAR.right;
  const ph = cssH - MAR.top  - MAR.bottom;

  // y range from data (auto-scale)
  const yAll = [...data.y_exact, ...data.y_approx];
  const yMin = Math.min(...yAll);
  const yMax = Math.max(...yAll);
  const yPad = (yMax - yMin) * 0.08 || 0.1;
  const yLo  = yMin - yPad;
  const yHi  = yMax + yPad;

  // Plot centre in CSS pixels
  const pcx = MAR.left + pw / 2;
  const pcy = MAR.top  + ph / 2;

  // Base mappers (zoom=1, no pan)
  const baseMx = v => MAR.left + (v - (-Math.PI)) / (2 * Math.PI) * pw;
  const baseMy = v => MAR.top  + (1 - (v - yLo)  / (yHi - yLo))  * ph;

  // Apply zoom (centred on plot centre) and pan offset
  const mx = v => pcx + (baseMx(v) - pcx) * viewZoom + viewOffX;
  const my = v => pcy + (baseMy(v) - pcy) * viewZoom + viewOffY;

  CTX.clearRect(0, 0, cssW, cssH);

  drawAxes(pw, ph, mx, my, yLo, yHi);

  // Clip curves to plot area so they don't bleed into margins
  CTX.save();
  CTX.beginPath();
  CTX.rect(MAR.left, MAR.top, pw, ph);
  CTX.clip();
  drawLine(data.x, data.y_exact,  C.muted,  1.5, mx, my);
  drawLine(data.x, data.y_approx, C.accent, 2.0, mx, my);
  CTX.restore();

  drawLegend(cssW, N);
}

// ── axes ──────────────────────────────────────────────────────────────────
function drawAxes(pw, ph, mx, my, yLo, yHi) {
  const y0 = my(0);
  const x0 = mx(0);

  CTX.save();

  // Clip axis lines to plot area
  CTX.beginPath();
  CTX.rect(MAR.left, MAR.top, pw, ph);
  CTX.clip();

  CTX.strokeStyle = C.border;
  CTX.lineWidth   = 1;

  // Horizontal axis at y = 0
  CTX.beginPath();
  CTX.moveTo(MAR.left, y0);
  CTX.lineTo(MAR.left + pw, y0);
  CTX.stroke();

  // Vertical axis at x = 0
  CTX.beginPath();
  CTX.moveTo(x0, MAR.top);
  CTX.lineTo(x0, MAR.top + ph);
  CTX.stroke();

  CTX.restore();

  // Tick marks and labels (drawn outside clip so text stays crisp)
  CTX.save();
  CTX.fillStyle    = C.muted;
  CTX.strokeStyle  = C.muted;
  CTX.font         = "11px 'JetBrains Mono', monospace";
  CTX.lineWidth    = 1;

  // x ticks — integer multiples of π; skip off-screen and too-dense ones
  CTX.textAlign    = 'center';
  CTX.textBaseline = 'top';
  const xTicks = [];
  for (let n = -8; n <= 8; n++) {
    const sign = n < 0 ? '−' : '';
    const abs  = Math.abs(n);
    const lbl  = n === 0 ? '0' : sign + (abs === 1 ? 'π' : `${abs}π`);
    xTicks.push([n * Math.PI, lbl]);
  }
  let lastTickPx = -Infinity;
  xTicks.forEach(([xv, lbl]) => {
    const px = mx(xv);
    if (px < MAR.left - 1 || px > MAR.left + pw + 1) return;
    if (px - lastTickPx < 32) return;  // avoid label overlap
    lastTickPx = px;
    const ty = Math.max(MAR.top, Math.min(MAR.top + ph, y0));
    CTX.beginPath();
    CTX.moveTo(px, ty - 3);
    CTX.lineTo(px, ty + 3);
    CTX.stroke();
    CTX.fillText(lbl, px, ty + 6);
  });

  // y ticks — only draw if within plot area vertically
  CTX.textAlign    = 'right';
  CTX.textBaseline = 'middle';
  const ySpan = yHi - yLo;
  const yTicks = [yLo + ySpan * 0.1, (yLo + yHi) / 2, yHi - ySpan * 0.1];
  yTicks.forEach(yv => {
    const py = my(yv);
    if (py < MAR.top - 1 || py > MAR.top + ph + 1) return;
    CTX.beginPath();
    CTX.moveTo(MAR.left - 4, py);
    CTX.lineTo(MAR.left,     py);
    CTX.stroke();
    CTX.fillText(yv.toFixed(2), MAR.left - 6, py);
  });

  CTX.restore();
}

// ── line drawing ──────────────────────────────────────────────────────────
function drawLine(xs, ys, color, lw, mx, my) {
  CTX.save();
  CTX.strokeStyle = color;
  CTX.lineWidth   = lw;
  CTX.lineJoin    = 'round';
  CTX.beginPath();
  CTX.moveTo(mx(xs[0]), my(ys[0]));
  for (let i = 1; i < xs.length; i++) {
    CTX.lineTo(mx(xs[i]), my(ys[i]));
  }
  CTX.stroke();
  CTX.restore();
}

// ── legend ────────────────────────────────────────────────────────────────
function drawLegend(cssW, N) {
  const rows = [
    { label: 'exact',    color: C.muted  },
    { label: `N = ${N}`, color: C.accent },
  ];

  CTX.save();
  CTX.font         = "11px 'JetBrains Mono', monospace";
  CTX.textBaseline = 'middle';

  const swW  = 16, padX = 10, padY = 8, rowH = 18;
  const maxLblW = Math.max(...rows.map(r => CTX.measureText(r.label).width));
  const boxW = padX * 2 + swW + 6 + maxLblW;
  const boxH = padY * 2 + rows.length * rowH;
  const boxX = cssW - MAR.right - boxW - 4;
  const boxY = MAR.top + 8;

  CTX.fillStyle   = C.surface;
  CTX.strokeStyle = C.border;
  CTX.lineWidth   = 1;
  CTX.beginPath();
  CTX.roundRect(boxX, boxY, boxW, boxH, 4);
  CTX.fill();
  CTX.stroke();

  rows.forEach(({ label, color }, i) => {
    const rowY = boxY + padY + i * rowH + rowH / 2;
    CTX.strokeStyle = color;
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.moveTo(boxX + padX,       rowY);
    CTX.lineTo(boxX + padX + swW, rowY);
    CTX.stroke();
    CTX.fillStyle = C.text;
    CTX.textAlign = 'left';
    CTX.fillText(label, boxX + padX + swW + 6, rowY);
  });

  CTX.restore();
}

// ── go ────────────────────────────────────────────────────────────────────
init();
