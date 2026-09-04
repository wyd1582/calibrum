"""python -m calibrum_sim [--years N] [--seed S] [--out sim/out] — regenerate the underwriting Monte Carlo chart + JSON."""
import argparse
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from .underwriting import run_monte_carlo  # noqa: E402

BG, PANEL, LINE, INK, DIM = "#0A1428", "#111B33", "#24365A", "#EAF0FB", "#8FA3C4"
CYAN, AMBER, GOOD, BAD = "#38BDF8", "#F0A05A", "#34D399", "#F87171"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, default=10_000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="sim/out")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    res = run_monte_carlo(a.years, a.seed)
    s = res.summary
    json.dump(s, open(f"{a.out}/underwriting_mc.json", "w"), indent=2)

    fig, ax = plt.subplots(figsize=(7.6, 5), facecolor=BG)
    ax.set_facecolor(PANEL)
    for sp in ax.spines.values():
        sp.set_color(LINE)
    ax.tick_params(colors=DIM)
    ax.grid(color=LINE, lw=0.6, alpha=0.6)
    bins = np.linspace(0, 4, 60)
    ax.hist(res.flat_loss_ratios, bins=bins, color=AMBER, alpha=0.75, density=True, label=f"flat pricing · mean LR {s['flat']['mean_lr']*100:.0f}%")
    ax.hist(res.mrs_loss_ratios, bins=bins, color=CYAN, alpha=0.55, density=True, label=f"MRS pricing, insure all · mean LR {s['mrs']['mean_lr']*100:.0f}%")
    ax.hist(res.mrs_select_loss_ratios, bins=bins, color=GOOD, alpha=0.75, density=True, label=f"MRS pricing + decline <{s['mrs_floor']} · mean LR {s['mrs_select']['mean_lr']*100:.0f}%")
    ax.axvline(1.0, color=INK, lw=1, ls="--")
    ax.text(1.02, ax.get_ylim()[1] * 0.95, "break-even", color=DIM, fontsize=8.5)
    ax.set_title(f"Flat pricing loses money {s['flat']['p_loss']*100:.0f}% of years; a scored desk {s['mrs_select']['p_loss']*100:.0f}%",
                 color=INK, fontsize=13, fontweight="bold", loc="left", pad=14)
    ax.text(0, 1.02, f"{a.years:,} simulated insured years of an 8-machine book · same claims, different premiums", transform=ax.transAxes, color=DIM, fontsize=8.5)
    ax.set_xlabel("loss ratio (claims ÷ premium)", color=DIM)
    ax.set_ylabel("density", color=DIM)
    ax.legend(facecolor=PANEL, edgecolor=LINE, labelcolor=INK)
    fig.text(0.01, 0.01, "SIMULATION: invented hazard curve p_fail(MRS), uniform severities. Demonstrates the mechanism of adverse selection, not any real book. Illustrative demo model.",
             color="#5B6E92", fontsize=7.5)
    fig.savefig(f"{a.out}/underwriting_mc.png", dpi=160, facecolor=BG, bbox_inches="tight")
    print(json.dumps(s, indent=1))


if __name__ == "__main__":
    main()
