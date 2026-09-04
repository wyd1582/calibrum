"""
Underwriting simulation — the Monte Carlo behind demo_underwriter_game.html,
ported into a documented, reproducible module.

The game's hand-tuned numbers ("blind pricing averages ~156% loss ratio, MRS
pricing ~68%") come from this model. Running `python -m calibrum_sim` regenerates
them from first principles with a fixed seed, so the demo copy is model-derived,
not typed in.

MODEL (identical to the HTML demo's `simulateClaim` / `scored` functions):
  * A book is 8 machines with a fixed MRS mix {810, 780, 750, 660, 635, 610, 455, 415}
    — three good, three middling, two toxic — shuffled.
  * Hidden ground truth: annual failure probability
        p_fail(MRS) = clip((1000 − MRS)/1000 × 1.6 − 0.30, 0.05, 0.95)
    A failed machine costs 5 000–16 000 vUSDC; with probability 0.7·p_fail a second
    loss of 4 000–14 000 follows (severity is uniform, uncorrelated — deliberately simple).
  * Blind pricing (the industry today): flat 2 400 vUSDC per machine, because without
    verified history that is all an underwriter can do.
  * MRS pricing: premium = 85 000 × (9.0% − MRS/1000 × 7.5%) — the Part-4 mapping.
  * Three desks are simulated:
      - "flat":       insure everything at the flat premium (blind, no selection possible);
      - "mrs":        insure everything at MRS-priced premiums (pure pricing effect);
      - "mrs_select": MRS-priced AND decline machines below MRS_FLOOR (pricing + selection —
                      this is what a scored desk actually does, and what the game's player learns to do).

EVERYTHING HERE IS A SIMULATION with an invented hazard curve. It demonstrates the
mechanism — flat pricing is adversely selected against, scored pricing is not —
and nothing about any real book.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

ASSET_VALUE = 85_000.0
FLAT_PREMIUM = 2_400.0
MRS_MIX = (810, 780, 750, 660, 635, 610, 455, 415)
MRS_FLOOR = 550  # a scored desk declines below this


def p_fail(mrs: float) -> float:
    return float(np.clip((1000 - mrs) / 1000 * 1.6 - 0.30, 0.05, 0.95))


def scored_premium(mrs: float, asset_value: float = ASSET_VALUE) -> float:
    return asset_value * (0.09 - (mrs / 1000) * 0.075)


@dataclass
class Book:
    mrs: tuple[int, ...] = MRS_MIX


@dataclass
class BookResult:
    premium: float
    claims: float
    pnl: float
    loss_ratio: float
    claims_by_machine: list[float] = field(default_factory=list)


def simulate_claim(rng: np.random.Generator, mrs: float) -> float:
    pf = p_fail(mrs)
    cost = 0.0
    if rng.random() < pf:
        cost += 5_000 + rng.random() * 11_000
        if rng.random() < pf * 0.7:
            cost += 4_000 + rng.random() * 10_000
    return round(cost)


def simulate_year(rng: np.random.Generator, book: Book, pricing: str) -> BookResult:
    """One insured year for one book under 'flat', 'mrs' or 'mrs_select' pricing."""
    prem = 0.0
    claims: list[float] = []
    for m in book.mrs:
        loss = simulate_claim(rng, m)  # the machine's year happens regardless of who insures it
        if pricing == "mrs_select" and m < MRS_FLOOR:
            claims.append(0.0)  # declined: someone else's loss
            continue
        prem += FLAT_PREMIUM if pricing == "flat" else scored_premium(m)
        claims.append(loss)
    tot = float(sum(claims))
    return BookResult(prem, tot, prem - tot, tot / prem if prem else 0.0, claims)


@dataclass
class MonteCarloResult:
    years: int
    seed: int
    flat_loss_ratios: np.ndarray
    mrs_loss_ratios: np.ndarray
    mrs_select_loss_ratios: np.ndarray

    @property
    def summary(self) -> dict:
        def stats(x):
            return dict(mean_lr=float(x.mean()), median_lr=float(np.median(x)), p_loss=float((x > 1).mean()), lr_p90=float(np.quantile(x, 0.9)))
        f, m, ms = self.flat_loss_ratios, self.mrs_loss_ratios, self.mrs_select_loss_ratios
        return dict(
            label="SIMULATION — invented hazard curve, not a real book",
            years=self.years,
            seed=self.seed,
            mrs_floor=MRS_FLOOR,
            flat=stats(f),
            mrs=stats(m),
            mrs_select=stats(ms),
            mrs_beats_flat_share=float((m < f).mean()),
            mrs_select_beats_flat_share=float((ms < f).mean()),
        )


def run_monte_carlo(years: int = 10_000, seed: int = 7, book: Book | None = None) -> MonteCarloResult:
    rng = np.random.default_rng(seed)
    book = book or Book()
    flat = np.empty(years)
    mrs = np.empty(years)
    sel = np.empty(years)
    for i in range(years):
        flat[i] = simulate_year(rng, book, "flat").loss_ratio
        mrs[i] = simulate_year(rng, book, "mrs").loss_ratio
        sel[i] = simulate_year(rng, book, "mrs_select").loss_ratio
    return MonteCarloResult(years, seed, flat, mrs, sel)
