import numpy as np
import matplotlib.pyplot as plt

def main():
    x = np.linspace(-np.pi, np.pi, 1000)

    def f(x): return np.abs(x) * (np.pi - np.abs(x))
    def f_N(x, N):
        sum = np.pi**2 / 6
        for n in range(1, N+1):
            sum += -2 * ((-1)**n + 1) / (n**2) * np.cos(n*x)
        return sum
    
    def g(x): return np.where(x>0, x*(np.pi-x), x*(np.pi+x))
    def g_N(x, N):
        sum = 0
        for n in range(1, N+1):
            sum += -4 * ((-1)**n - 1) / (np.pi * n**3) * np.sin(n*x)
        return sum

    fig, (ax_f, ax_g) = plt.subplots(1, 2, sharex=True, sharey=True, figsize=(12, 6))

    ax_f.plot(x, f(x), label='f(x)')
    for N in [2, 3, 5]:
        ax_f.plot(x, f_N(x, N), label=f'f_{N}(x)')
    ax_f.set_title('f(x) and its Fourier partial sums')
    ax_f.legend()

    ax_g.plot(x, g(x), label='g(x)')
    for N in [2, 3, 5]:
        ax_g.plot(x, g_N(x, N), label=f'g_{N}(x)')
    ax_g.set_title('g(x) and its Fourier partial sums')
    ax_g.legend()

    fig.savefig("python/fourier_fg.png", dpi=200)
    plt.show() 


if __name__ == "__main__":
    main()
