**[→ Open in browser](https://gbettineschi.github.io/fourier-series-approximation)**

# Fourier series approximation

Any periodic function can be written as an infinite sum of sines and cosines. How quickly does that sum converge to the original function?

The answer depends on the function's smoothness: smoother functions generally converge faster.

This program plots Fourier series approximation of some selected function. You can decide how many terms the serie should use, or you can click Animate and watch convergence as the number of terms in the serie increas.

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
