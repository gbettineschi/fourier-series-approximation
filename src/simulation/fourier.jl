using Plots

# ── exact functions ──────────────────────────────────────────────────────────

square_wave(x) = x > 0 ? 1.0 : x < 0 ? -1.0 : 0.0

sawtooth(x) = x / π

triangle_wave(x) = abs(x)

f(x) = abs(x) * (π - abs(x))

g(x) = x > 0 ? x * (π - x) : x * (π + x)

# ── Fourier partial sums ─────────────────────────────────────────────────────

# Square wave: b_n = 4/(πn) for odd n, 0 for even n
function square_wave_N(x, N)
    s = 0.0
    for n in 1:N
        s += 2 * (1 - (-1)^n) / (π * n) * sin(n * x)
    end
    return s
end

# Sawtooth: b_n = 2(-1)^(n+1)/(πn)
function sawtooth_N(x, N)
    s = 0.0
    for n in 1:N
        s += 2 * (-1)^(n + 1) / (π * n) * sin(n * x)
    end
    return s
end

# Triangle |x|: a_0/2 = π/2; a_n = 2((-1)^n - 1)/(πn²), only odd n contribute
function triangle_wave_N(x, N)
    s = π / 2
    for n in 1:N
        s += 2 * ((-1)^n - 1) / (π * n^2) * cos(n * x)
    end
    return s
end

# f(x) = |x|(π - |x|): a_0/2 = π²/6; a_n = -2((-1)^n + 1)/n², only even n contribute
function fN(x, N)
    s = π^2 / 6
    for n in 1:N
        s += -2 * ((-1)^n + 1) / n^2 * cos(n * x)
    end
    return s
end

# g(x) = x(π ∓ x): b_n = -4((-1)^n - 1)/(πn³), only odd n contribute
function gN(x, N)
    s = 0.0
    for n in 1:N
        s += -4 * ((-1)^n - 1) / (π * n^3) * sin(n * x)
    end
    return s
end

# ── plot ─────────────────────────────────────────────────────────────────────

xs = range(-π, π, length=600)
Ns = [2, 5, 15]

functions = [
    (square_wave,   square_wave_N,   "Square wave"),
    (sawtooth,      sawtooth_N,      "Sawtooth"),
    (triangle_wave, triangle_wave_N, "Triangle |x|"),
    (f,             fN,              "f(x) = |x|(π−|x|)"),
    (g,             gN,              "g(x) = x(π∓x)"),
]

fig = plot(layout=(2, 3), size=(1400, 800), link=:none)

for (i, (exact_fn, approx_fn, title)) in enumerate(functions)
    plot!(fig[i], xs, exact_fn.(xs), label="exact", color=:gray60, lw=1.5, title=title)
    for N in Ns
        plot!(fig[i], xs, approx_fn.(xs, N), label="N=$N", lw=1)
    end
end

# hide unused 6th panel
plot!(fig[6], legend=false, axis=false, grid=false)

display(fig)
