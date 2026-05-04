# Fourier series approximation

**Live demo:** https://gbettineschi.github.io/foruier-approximations/

![screenshot](screenshot.png)

Interactive visualization of Fourier series partial sums. Use the **N** slider to add
harmonics one by one, or press **Animate** to watch convergence in real time.

Five functions are available. The square wave and sawtooth have jump discontinuities —
their series converge slowly and exhibit characteristic ringing near the jumps. The
triangle wave and the two custom functions (f, g) are smooth; their series converge
much faster because the Fourier coefficients decay as 1/n² or faster.

Computation runs entirely in the browser via **Pyodide + numpy** (Python → WebAssembly)
— no server required.

## Functions

| ID | Formula | Series | Non-zero harmonics |
|----|---------|--------|-------------------|
| Square wave | sign(x) | Σ [2(1−(−1)ⁿ)/(πn)] sin(nx) | Odd n only |
| Sawtooth | x/π on (−π, π) | Σ [2(−1)^(n+1)/(πn)] sin(nx) | All n |
| Triangle \|x\| | \|x\| | π/2 + Σ [2((−1)ⁿ−1)/(πn²)] cos(nx) | Odd n only |
| f(x) = \|x\|(π−\|x\|) | smooth even | π²/6 + Σ [−2((−1)ⁿ+1)/n²] cos(nx) | Even n only |
| g(x) = x(π∓x) | smooth odd | Σ [−4((−1)ⁿ−1)/(πn³)] sin(nx) | Odd n only |

## Local browser demo

```bash
cd src && python -m http.server 8080
# open http://localhost:8080
```

## Local CLI (matplotlib plots)

```bash
uv sync --group local
uv run python src/simulation/simulation.py
```

## Tech

- Python 3.13, numpy
- [Pyodide 0.26.4](https://pyodide.org) — CPython compiled to WebAssembly
- Canvas 2D API for rendering
- GitHub Pages (static deploy, no build step)

## Julia implementation

An equivalent implementation using Julia and `Plots.jl` is in
[`src/simulation/fourier.jl`](src/simulation/fourier.jl).
The original Julia source is also preserved in [`julia/Main.jl`](julia/Main.jl).

## Setup for GitHub Pages

1. Go to **Settings → Pages** and set source to **GitHub Actions**
2. Make the repository **public** (required for free-tier Pages)
3. Push to `main` — the workflow deploys automatically

> **Note:** The repository name contains a typo (`foruier` instead of `fourier`).
> To fix it, go to **Settings → General** and rename the repo — but do this *after*
> merging since renaming changes the Pages URL.
