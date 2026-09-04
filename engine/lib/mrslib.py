"""
mrslib — the one engine behind every cohort.

Same simple method everywhere (standardised logistic regression → FICO-style
score), same report format everywhere, so the story is "one engine, three
asset classes" and not "a different trick per dataset".

Pipeline stages (each cohort script calls these in order):
    fit_scorecard  → evaluate → ablations → charts → contract JSON → trajectory → REPORT.md

The contract JSON written by `write_contract` follows the Part-4 schema of the
handoff exactly (kind, event, features, mean, std, coef, intercept,
score_scaling, holdout_metrics) plus a `provenance` block, so every web surface
can load any cohort model interchangeably.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import roc_auc_score, roc_curve  # noqa: E402

# ---------------------------------------------------------------- scaling
PDO, BASE_SCORE, BASE_ODDS, CLIP = 40.0, 600.0, 15.0, (300, 850)
B = PDO / np.log(2)


def to_score(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    odds_good = (1 - p) / p
    return np.clip(BASE_SCORE + B * np.log(odds_good / BASE_ODDS), *CLIP)


# ---------------------------------------------------------------- brand
BG, PANEL, LINE, INK, DIM = "#0A1428", "#111B33", "#24365A", "#EAF0FB", "#8FA3C4"
CYAN, AMBER, GOOD, VIOLET, BAD = "#38BDF8", "#F0A05A", "#34D399", "#8B7CF6", "#F87171"


def _style(ax, title, sub=""):
    ax.set_facecolor(PANEL)
    ax.tick_params(colors=DIM)
    ax.xaxis.label.set_color(DIM)
    ax.yaxis.label.set_color(DIM)
    for s_ in ax.spines.values():
        s_.set_color(LINE)
    ax.set_title(title, color=INK, fontsize=13, fontweight="bold", loc="left", pad=14)
    if sub:
        ax.text(0, 1.02, sub, transform=ax.transAxes, color=DIM, fontsize=8.5)
    ax.grid(color=LINE, linewidth=0.6, alpha=0.6)


def _save(fig, path, caption):
    fig.text(0.01, 0.01, caption, color="#5B6E92", fontsize=7.5)
    fig.savefig(path, dpi=160, facecolor=BG, bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------- model
@dataclass
class Scorecard:
    features: list[str]
    mu: pd.Series
    sd: pd.Series
    coef: np.ndarray
    intercept: float
    C: float = 0.5

    def standardize(self, X: pd.DataFrame) -> pd.DataFrame:
        return (X[self.features] - self.mu) / self.sd

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        z = self.standardize(X).values
        logit = self.intercept + z @ self.coef
        return 1 / (1 + np.exp(-logit))

    def score(self, X: pd.DataFrame) -> np.ndarray:
        return to_score(self.predict_proba(X))


def fit_scorecard(train: pd.DataFrame, features: list[str], target: str, C: float = 0.5, class_weight=None) -> Scorecard:
    """The Capital One special: standardise, L2 logistic, nothing clever."""
    mu, sd = train[features].mean(), train[features].std().replace(0, 1)
    Xtr = (train[features] - mu) / sd
    clf = LogisticRegression(C=C, max_iter=5000, class_weight=class_weight)
    clf.fit(Xtr, train[target])
    return Scorecard(features, mu, sd, clf.coef_[0].copy(), float(clf.intercept_[0]), C)


# ---------------------------------------------------------------- metrics
@dataclass
class Evaluation:
    auc: float
    gini: float
    ks: float
    cap20: float
    cap10: float
    n: int
    events: int
    gains_x: np.ndarray
    gains_y: np.ndarray
    deciles: pd.DataFrame
    scored: pd.DataFrame = field(repr=False)


def evaluate(hold: pd.DataFrame, target: str, p: np.ndarray) -> Evaluation:
    h = hold.copy()
    h["p"] = p
    h["mrs"] = to_score(p)
    auc = float(roc_auc_score(h[target], h.p))
    fpr, tpr, _ = roc_curve(h[target], h.p)
    ks = float(np.max(tpr - fpr))
    hs = h.sort_values("p", ascending=False).reset_index(drop=True)
    n = len(hs)
    tot = int(hs[target].sum())
    cap20 = float(hs.loc[: int(n * 0.2) - 1, target].sum() / tot)
    cap10 = float(hs.loc[: int(n * 0.1) - 1, target].sum() / tot)
    gains = hs[target].cumsum().values / tot
    hs["decile"] = pd.qcut(hs.mrs, 10, labels=False, duplicates="drop")
    dec = (
        hs.groupby("decile")
        .agg(mean_mrs=("mrs", "mean"), obs_rate=(target, "mean"), pred_rate=("p", "mean"), count=(target, "size"))
        .reset_index()
    )
    return Evaluation(auc, 2 * auc - 1, ks, cap20, cap10, n, tot, np.arange(1, n + 1) / n, gains, dec, h)


def ablations(train, hold, target, groups: dict[str, list[str]], C=0.5, class_weight=None) -> dict:
    """Refit on feature subsets (e.g. age-only vs sensors-only) — the leakage check."""
    out = {}
    for name, feats in groups.items():
        sc = fit_scorecard(train, feats, target, C, class_weight)
        ev = evaluate(hold, target, sc.predict_proba(hold))
        out[name] = dict(auc=round(ev.auc, 4), cap20=round(ev.cap20, 4), n_features=len(feats))
    return out


# ---------------------------------------------------------------- charts
def make_charts(out: str, ev: Evaluation, target: str, caption: str, asset_value: float = 85_000, horizon_label="next 30 cycles"):
    os.makedirs(out, exist_ok=True)
    fr, gains, dec, h = ev.gains_x, ev.gains_y, ev.deciles, ev.scored

    fig, ax = plt.subplots(figsize=(7.2, 5), facecolor=BG)
    _style(ax, f"Riskiest 20% of machine-periods captured {ev.cap20*100:.0f}% of upcoming failures",
           f"Holdout machines never seen in training - ranked by MRS, observed over {horizon_label}")
    ax.plot(fr * 100, gains * 100, color=CYAN, lw=2.5, label="ranked by MRS")
    ax.plot([0, 100], [0, 100], color=DIM, lw=1.2, ls="--", label="random ranking")
    ax.fill_between(fr * 100, gains * 100, fr * 100, color=CYAN, alpha=0.08)
    ax.axvline(20, color=AMBER, lw=1, ls=":")
    ax.scatter([20], [ev.cap20 * 100], color=AMBER, zorder=5)
    ax.annotate(f"{ev.cap20*100:.0f}%", (20, ev.cap20 * 100), textcoords="offset points", xytext=(10, -4), color=AMBER, fontweight="bold")
    ax.set_xlabel("% of fleet, riskiest first")
    ax.set_ylabel("% of failures captured")
    ax.legend(facecolor=PANEL, edgecolor=LINE, labelcolor=INK, loc="lower right")
    _save(fig, f"{out}/lift_curve.png", caption)

    fig, ax = plt.subplots(figsize=(7.2, 5), facecolor=BG)
    _style(ax, "Predicted vs observed failure rate by MRS decile", "Perfect calibration = diagonal")
    ax.plot(dec.pred_rate * 100, dec.obs_rate * 100, "o-", color=VIOLET, lw=2)
    lim = max(dec.pred_rate.max(), dec.obs_rate.max()) * 110
    ax.plot([0, lim], [0, lim], color=DIM, lw=1.2, ls="--")
    ax.set_xlabel("predicted failure rate (%)")
    ax.set_ylabel("observed failure rate (%)")
    _save(fig, f"{out}/calibration.png", caption)

    fig, ax = plt.subplots(figsize=(7.2, 5), facecolor=BG)
    _style(ax, "MRS separates healthy periods from pre-failure periods",
           f"AUC {ev.auc:.2f} - Gini {ev.gini:.2f} - KS {ev.ks:.2f} on out-of-machine holdout")
    bins = np.linspace(300, 850, 45)
    ax.hist(h[h[target] == 0].mrs, bins=bins, color=GOOD, alpha=0.7, label=f"survived {horizon_label}", density=True)
    ax.hist(h[h[target] == 1].mrs, bins=bins, color=BAD, alpha=0.7, label=f"failed within {horizon_label}", density=True)
    ax.set_xlabel("Machine Risk Score")
    ax.set_ylabel("density")
    ax.legend(facecolor=PANEL, edgecolor=LINE, labelcolor=INK)
    _save(fig, f"{out}/score_distribution.png", caption)

    scores = np.linspace(350, 850, 200)
    prem = asset_value * (0.09 - (scores / 1000) * 0.075)
    ltv = 25 + (scores / 1000) * 55
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.5, 4.4), facecolor=BG)
    _style(ax1, "Premium as a function of MRS", f"illustrative pricing function, ${asset_value/1000:.0f}K asset")
    ax1.plot(scores, prem, color=AMBER, lw=2.5)
    ax1.set_xlabel("MRS")
    ax1.set_ylabel("$ / yr")
    _style(ax2, "Max LTV as a function of MRS", "illustrative collateral function")
    ax2.plot(scores, ltv, color=CYAN, lw=2.5)
    ax2.set_xlabel("MRS")
    ax2.set_ylabel("max LTV %")
    _save(fig, f"{out}/finance_mapping.png", "Pricing functions are illustrative and uncalibrated to any live book.")


# ---------------------------------------------------------------- exports
def write_contract(out: str, sc: Scorecard, event: str, metrics: dict, provenance: dict, name="mrs_model.json") -> dict:
    model = dict(
        kind="logistic_scorecard_v0",
        event=event,
        features=sc.features,
        mean={f: round(float(sc.mu[f]), 6) for f in sc.features},
        std={f: round(float(sc.sd[f]), 6) for f in sc.features},
        coef={f: round(float(c), 6) for f, c in zip(sc.features, sc.coef)},
        intercept=round(sc.intercept, 6),
        score_scaling=dict(PDO=PDO, base_score=BASE_SCORE, base_odds=BASE_ODDS, clip=list(CLIP)),
        holdout_metrics=metrics,
        provenance=provenance,
    )
    json.dump(model, open(f"{out}/{name}", "w"), indent=2)
    coef = pd.DataFrame({"feature": sc.features, "coef": sc.coef})
    coef["abs"] = coef.coef.abs()
    coef.sort_values("abs", ascending=False).drop(columns="abs").to_csv(f"{out}/scorecard_coefficients.csv", index=False)
    return model


def write_trajectory(out: str, panel: pd.DataFrame, features: list[str], unit_col: str, time_to_event_col: str,
                     failed_mask: pd.Series, horizon: float, bins: int = 20, name="trajectory.json") -> dict:
    """
    Empirical degradation trajectory for the web app's Underwriting Playground.

    tau = 1 - clip(time_to_event / horizon, 0, 1): 0 = far from failure, 1 = failing.
    For each tau bin we store the mean raw feature vector over failed units; tau=0 also
    pools units that never failed. The web app moves a demo machine along this path and
    pushes the resulting vector through the SAME contract — so slider maths never
    invents its own scoring. See docs/slider-mapping.md.
    """
    d = panel.copy()
    tau = 1 - np.clip(d[time_to_event_col] / horizon, 0, 1)
    d["tau"] = np.where(failed_mask.values, tau, 0.0)
    d["bin"] = np.minimum((d["tau"] * bins).astype(int), bins - 1)
    grid = []
    for b in range(bins):
        rows = d[d["bin"] == b]
        if len(rows) == 0:
            grid.append(None)
            continue
        grid.append({f: float(rows[f].mean()) for f in features})
    # forward-fill empty bins
    last = None
    for i, g in enumerate(grid):
        if g is None:
            grid[i] = last
        else:
            last = g
    traj = dict(
        bins=bins,
        tau=[(b + 0.5) / bins for b in range(bins)],
        horizon=horizon,
        unit_col=unit_col,
        note="Mean raw feature vector by normalised time-to-event bin among failed units (tau=0 pools survivors). Descriptive, not a model.",
        points=grid,
        feature_std={f: float(d[f].std()) for f in features},
    )
    json.dump(traj, open(f"{out}/{name}", "w"), indent=1)
    return traj


def write_report(out: str, title: str, what: str, design: list[str], ev: Evaluation, ablation: dict, sc: Scorecard,
                 honesty: list[str], holdout_desc: str, extra_sections: dict | None = None):
    coef = pd.DataFrame({"feature": sc.features, "coef": sc.coef})
    coef["abs"] = coef.coef.abs()
    top = coef.sort_values("abs", ascending=False).drop(columns="abs").head(8).to_string(index=False)
    abl = "\n".join(f"- **{k}**: AUC {v['auc']:.2f}, top-20% capture {v['cap20']*100:.0f}% ({v['n_features']} features)" for k, v in ablation.items())
    lines = [f"# {title}", "", f"**What was tested.** {what}", "", "**Design.**"]
    lines += [f"- {d}" for d in design]
    lines += ["", f"**Results ({holdout_desc}).**",
              f"- Riskiest 20% of machine-periods captured **{ev.cap20*100:.0f}%** of upcoming failures (riskiest 10%: {ev.cap10*100:.0f}%).",
              f"- AUC **{ev.auc:.2f}** · Gini **{ev.gini:.2f}** · KS **{ev.ks:.2f}**.",
              "- Calibration by decile: see calibration.png.", "", "**Ablations (leakage check).**", abl, "",
              "**Top model drivers.**", "```", top, "```", "",
              "**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread via documented monotone functions (finance_mapping.png). These are placeholders until calibrated against a real claims/loan book with a design partner.",
              ""]
    for k, v in (extra_sections or {}).items():
        lines += [f"**{k}.** {v}", ""]
    lines += ["**Honesty notes.** " + " ".join(f"({i+1}) {h}" for i, h in enumerate(honesty)), ""]
    open(f"{out}/REPORT.md", "w").write("\n".join(lines))


def metrics_dict(dataset: str, ev: Evaluation, event: str, machines_train: int, machines_holdout: int, ablation: dict) -> dict:
    return dict(dataset=dataset, machines_train=machines_train, machines_holdout=machines_holdout, rows_holdout=int(ev.n),
                events_holdout=int(ev.events), event=event, auc=round(ev.auc, 4), gini=round(ev.gini, 4), ks=round(ev.ks, 4),
                top20_capture=round(ev.cap20, 4), top10_capture=round(ev.cap10, 4), ablations=ablation)
