import json
import sys
import numpy as np


def square_wave(x):
    return np.where(x > 0, 1.0, np.where(x < 0, -1.0, 0.0))


def sawtooth(x):
    return x / np.pi


def triangle_wave(x):
    return np.abs(x)


def f(x):
    return np.abs(x) * (np.pi - np.abs(x))


def g(x):
    return np.where(x > 0, x * (np.pi - x), x * (np.pi + x))


def square_wave_N(x, N):
    # b_n = 4/(πn) for odd n, 0 for even n
    s = np.zeros_like(x, dtype=float)
    for n in range(1, N + 1):
        s += 2 * (1 - (-1)**n) / (np.pi * n) * np.sin(n * x)
    return s


def sawtooth_N(x, N):
    # b_n = 2(-1)^(n+1)/(πn)
    s = np.zeros_like(x, dtype=float)
    for n in range(1, N + 1):
        s += 2 * (-1)**(n + 1) / (np.pi * n) * np.sin(n * x)
    return s


def triangle_wave_N(x, N):
    # a_0/2 = π/2; a_n = 2((-1)^n - 1)/(πn²), only odd n contribute
    s = np.pi / 2
    for n in range(1, N + 1):
        s += 2 * ((-1)**n - 1) / (np.pi * n**2) * np.cos(n * x)
    return s


def f_N(x, N):
    # a_0/2 = π²/6; a_n = -2((-1)^n + 1)/n², only even n contribute
    s = np.pi**2 / 6
    for n in range(1, N + 1):
        s += -2 * ((-1)**n + 1) / (n**2) * np.cos(n * x)
    return s


def g_N(x, N):
    # b_n = -4((-1)^n - 1)/(πn³), only odd n contribute
    s = 0.0
    for n in range(1, N + 1):
        s += -4 * ((-1)**n - 1) / (np.pi * n**3) * np.sin(n * x)
    return s


FUNCTIONS = {
    'square':   (square_wave,   square_wave_N,   'Square wave'),
    'sawtooth': (sawtooth,      sawtooth_N,      'Sawtooth'),
    'triangle': (triangle_wave, triangle_wave_N, 'Triangle |x|'),
    'f':        (f,             f_N,             'f(x) = |x|(π−|x|)'),
    'g':        (g,             g_N,             'g(x) = x(π∓x)'),
}


def list_functions() -> str:
    return json.dumps([{'id': k, 'label': v[2]} for k, v in FUNCTIONS.items()])


def compute(func_name: str, N: int) -> str:
    exact_fn, approx_fn, _ = FUNCTIONS[func_name]
    x = np.linspace(-np.pi, np.pi, 600)
    y_exact = exact_fn(x)
    y_approx = approx_fn(x, int(N))
    error = float(np.max(np.abs(y_exact - y_approx)))
    return json.dumps({
        'x':        x.tolist(),
        'y_exact':  y_exact.tolist(),
        'y_approx': y_approx.tolist(),
        'error':    error,
    })


if __name__ == '__main__' and sys.platform != 'emscripten' and 'pyodide' not in sys.modules:
    import os
    import matplotlib.pyplot as plt

    os.makedirs('output', exist_ok=True)

    x = np.linspace(-np.pi, np.pi, 1000)
    Ns = [2, 5, 15]

    fig, axes = plt.subplots(2, 3, figsize=(15, 8), sharex=True)
    fig.suptitle('Fourier Series Partial Sums', fontsize=14)

    for ax, (key, (exact_fn, approx_fn, title)) in zip(axes.flat, FUNCTIONS.items()):
        ax.plot(x, exact_fn(x), label='exact', color='#7d8590', linewidth=1.5)
        for N in Ns:
            ax.plot(x, approx_fn(x, N), label=f'N={N}', linewidth=1)
        ax.set_title(title)
        ax.legend(fontsize=8)
        ax.set_xlabel('x')
        ax.axhline(0, color='#30363d', linewidth=0.5)

    axes.flat[-1].set_visible(False)

    plt.tight_layout()
    plt.savefig('output/fourier.png', dpi=200, bbox_inches='tight')
    plt.show()
