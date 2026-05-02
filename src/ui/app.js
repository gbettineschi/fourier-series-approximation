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

// ── state ─────────────────────────────────────────────────────────────────
let pyodide     = null;
let computeFn   = null;  // pyodide callable, kept for app lifetime
let currentFunc = 'square';
let animTimer   = null;
let debouncedRender = null;

// ── service worker (silent) ────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./ui/sw.js').catch(() => {});
}

// ── debounce ──────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
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

    // Python str → JS string automatically; callable stored once
    computeFn = pyodide.globals.get('compute');

    buildFunctionRadios();
    wireControls();

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
  // list_functions() returns Python str → JS string, no PyProxy
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
}

function enableControls() {
  N_SLIDER.disabled   = false;
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
    render();  // direct call — no debounce during animation
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

  // Reassigning width/height resets the context (including transforms)
  CANVAS.width  = Math.round(cssW * dpr);
  CANVAS.height = Math.round(cssH * dpr);
  CANVAS.style.width  = cssW + 'px';
  CANVAS.style.height = cssH + 'px';
  CTX.scale(dpr, dpr);
}

function drawPlot(data, N) {
  const cssW = CANVAS_WRAP.clientWidth;
  const cssH = CANVAS_WRAP.clientHeight;

  const mar = { top: 28, right: 20, bottom: 40, left: 48 };
  const pw  = cssW - mar.left - mar.right;
  const ph  = cssH - mar.top  - mar.bottom;

  // y range with padding
  const yAll = [...data.y_exact, ...data.y_approx];
  const yMin = Math.min(...yAll);
  const yMax = Math.max(...yAll);
  const yPad = (yMax - yMin) * 0.08 || 0.1;
  const yLo  = yMin - yPad;
  const yHi  = yMax + yPad;

  // coordinate mappers
  const mx = v => mar.left + (v - (-Math.PI)) / (2 * Math.PI) * pw;
  const my = v => mar.top  + (1 - (v - yLo)  / (yHi - yLo))  * ph;

  CTX.clearRect(0, 0, cssW, cssH);

  drawAxes(mar, pw, ph, my, yLo, yHi);
  drawLine(data.x, data.y_exact,  C.muted,  1.5, mx, my);
  drawLine(data.x, data.y_approx, C.accent, 2.0, mx, my);
  drawLegend(cssW, mar, N);
}

// ── axes ──────────────────────────────────────────────────────────────────
function drawAxes(mar, pw, ph, my, yLo, yHi) {
  const y0 = my(0);

  CTX.save();
  CTX.strokeStyle = C.border;
  CTX.lineWidth   = 1;

  // horizontal axis at y=0
  CTX.beginPath();
  CTX.moveTo(mar.left, y0);
  CTX.lineTo(mar.left + pw, y0);
  CTX.stroke();

  // vertical axis at x=0
  const x0 = mar.left + pw / 2;
  CTX.beginPath();
  CTX.moveTo(x0, mar.top);
  CTX.lineTo(x0, mar.top + ph);
  CTX.stroke();

  // x ticks
  CTX.fillStyle    = C.muted;
  CTX.font         = "11px 'JetBrains Mono', monospace";
  CTX.textAlign    = 'center';
  CTX.textBaseline = 'top';
  CTX.strokeStyle  = C.muted;
  CTX.lineWidth    = 1;

  const xTicks = [
    [-Math.PI,       '−π'],
    [-Math.PI / 2,   '−π/2'],
    [0,              '0'],
    [ Math.PI / 2,   'π/2'],
    [ Math.PI,       'π'],
  ];

  const mx2 = v => mar.left + (v - (-Math.PI)) / (2 * Math.PI) * pw;

  xTicks.forEach(([xv, lbl]) => {
    const px = mx2(xv);
    CTX.beginPath();
    CTX.moveTo(px, y0 - 3);
    CTX.lineTo(px, y0 + 3);
    CTX.stroke();
    CTX.fillText(lbl, px, y0 + 6);
  });

  // y ticks (3 values)
  CTX.textAlign    = 'right';
  CTX.textBaseline = 'middle';

  const yTicks = [yLo + yPadVal(yLo, yHi), (yLo + yHi) / 2, yHi - yPadVal(yLo, yHi)];
  yTicks.forEach(yv => {
    const py = my(yv);
    CTX.beginPath();
    CTX.moveTo(mar.left - 4, py);
    CTX.lineTo(mar.left,     py);
    CTX.stroke();
    CTX.fillText(yv.toFixed(2), mar.left - 6, py);
  });

  CTX.restore();
}

function yPadVal(lo, hi) { return (hi - lo) * 0.08; }

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
function drawLegend(cssW, mar, N) {
  const rows = [
    { label: 'exact',   color: C.muted  },
    { label: `N = ${N}`, color: C.accent },
  ];

  CTX.save();
  CTX.font = "11px 'JetBrains Mono', monospace";
  CTX.textBaseline = 'middle';

  const swW  = 16;
  const padX = 10;
  const padY = 8;
  const rowH = 18;
  const maxLblW = Math.max(...rows.map(r => CTX.measureText(r.label).width));
  const boxW = padX * 2 + swW + 6 + maxLblW;
  const boxH = padY * 2 + rows.length * rowH;
  const boxX = cssW - mar.right - boxW - 4;
  const boxY = mar.top + 8;

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
    CTX.moveTo(boxX + padX,         rowY);
    CTX.lineTo(boxX + padX + swW,   rowY);
    CTX.stroke();
    CTX.fillStyle = C.text;
    CTX.textAlign = 'left';
    CTX.fillText(label, boxX + padX + swW + 6, rowY);
  });

  CTX.restore();
}

// ── go ────────────────────────────────────────────────────────────────────
init();
