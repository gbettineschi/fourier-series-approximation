**[→ Open in browser](https://gbettineschi.github.io/foruier-approximations)**

# Fourier series approximation

Any periodic function can be written as an infinite sum of sines and cosines. How quickly does that sum converge to the original function?

The answer depends on the function's smoothness. Jump discontinuities (square wave, sawtooth) cause slow convergence and characteristic ringing near the jumps — the Gibbs phenomenon. Smooth functions (triangle wave, f, g) converge much faster because their Fourier coefficients decay as 1/n² or faster.

This tool lets you explore that convergence interactively. Use the **N** slider to add harmonics one by one, or press **Animate** to watch convergence in real time. Computation runs entirely in the browser via Pyodide + numpy (Python → WebAssembly) — no server required.

## Run locally

**In the browser**

Serve `src/` with a local HTTP server and open it in the browser.

```bash
cd src && python -m http.server
```

**With Python**

Install the project dependencies and run `src/simulation/simulation.py` directly. Visualization is through matplotlib; no controls are available in this interface.

```bash
uv sync --group local
uv run python src/simulation/simulation.py
```
