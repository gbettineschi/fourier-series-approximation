using Plots

f(x) = abs(x) * (pi-abs(x))
function fN(x, N)
    sum = pi^2 / 6
    for n in 1:N
        sum += -2 * ((-1)^n + 1) / n^2 * cos(n*x)
    end
    return sum
end

g(x) = x > 0 ? x*(pi-x) : x*(pi+x)
function gN(x, N)
    sum = 0
    for n in 1:N
        sum += -4 * ((-1)^n - 1) / (pi * n^3) * sin(n*x)
    end
    return sum
end

xs = range(-pi, pi, length=1000)
Ns = [2, 5, 10]

fig = plot(layout=(2,1), link=:both, size=(1200,600))

plot!(fig[1], xs, f.(xs), label="f(x)", title="f(x) and Fourier approximations")
for N in Ns
    plot!(fig[1], xs, fN.(xs, N), label="f_$N(x)")
end

plot!(fig[2], xs, g.(xs), label="g(x)", title="g(x) and Fourier approximations")
for N in Ns
    plot!(fig[2], xs, gN.(xs, N), label="g_$N(x)")
end

savefig(fig, "julia/fourier_fg.png")
display(fig)
