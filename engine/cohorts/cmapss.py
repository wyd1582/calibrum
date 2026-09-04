"""
Cohort: NASA C-MAPSS (FD001 / FD002 / FD003 / FD004) through the shared engine.

FD001 = single operating condition, one fault mode (this is the v0 baseline; the
framework must reproduce run_mrs_v0.py's coefficients exactly — see test_engine.py).
FD002 / FD004 = six operating conditions (FD004 also two fault modes): the harder
multi-condition cohorts. Same 43 features, same model, no regime tricks — so the
numbers are comparable and the drop in AUC is an honest statement about what a
naive scorecard does when regimes shift.

C-MAPSS is a physics-based degradation SIMULATION benchmark: it validates the
methodology (behaviour -> failure -> score), not the market.

Usage:
  python engine/cohorts/cmapss.py --fd FD002 [--data data/cmapss] [--out engine/cohorts/out]
  python engine/cohorts/cmapss.py --fd FD001 --sample engine/fixtures/cmapss_fd001_sample.txt   # CI smoke
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import mrslib as M  # noqa: E402

SRC = "https://raw.githubusercontent.com/hankroark/Turbofan-Engine-Degradation/master/CMAPSSData/train_{fd}.txt"
COLS = ["unit", "cycle", "op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]
INFORMATIVE = ["s2", "s3", "s4", "s7", "s8", "s9", "s11", "s12", "s13", "s14", "s15", "s17", "s20", "s21"]
HORIZON = 30
DESC = {
    "FD001": "1 operating condition, 1 fault mode (HPC degradation)",
    "FD002": "6 operating conditions, 1 fault mode",
    "FD003": "1 operating condition, 2 fault modes (HPC + fan)",
    "FD004": "6 operating conditions, 2 fault modes",
}


def load(fd: str, data_dir: str, sample: str | None) -> pd.DataFrame:
    path = sample or os.path.join(data_dir, f"train_{fd}.txt")
    if not os.path.exists(path):
        os.makedirs(data_dir, exist_ok=True)
        print(f"downloading C-MAPSS {fd} ...")
        urllib.request.urlretrieve(SRC.format(fd=fd), path)
    df = pd.read_csv(path, sep=r"\s+", header=None, names=COLS)
    maxc = df.groupby("unit")["cycle"].transform("max")
    df["rul"] = maxc - df["cycle"]
    df["event30"] = (df["rul"] <= HORIZON).astype(int)
    return df


def build_panel(d: pd.DataFrame) -> pd.DataFrame:
    """Identical feature construction to run_mrs_v0.py (20 cycles of history, no future)."""
    rows = []
    for u, g in d.groupby("unit"):
        g = g.sort_values("cycle").reset_index(drop=True)
        S = g[INFORMATIVE].values
        for i in range(19, len(g)):
            level = S[i - 4 : i + 1].mean(axis=0)
            past = S[i - 19 : i - 14].mean(axis=0)
            trend = level - past
            vol = S[i - 9 : i + 1].std(axis=0)
            rows.append([u, g.loc[i, "cycle"], g.loc[i, "event30"], g.loc[i, "rul"], g.loc[i, "cycle"], *level, *trend, *vol])
    fcols = ["unit", "cycle", "event30", "rul", "hours"] + [f"lvl_{s}" for s in INFORMATIVE] + [f"trd_{s}" for s in INFORMATIVE] + [f"vol_{s}" for s in INFORMATIVE]
    return pd.DataFrame(rows, columns=fcols)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fd", default="FD002", choices=list(DESC))
    ap.add_argument("--data", default="data/cmapss")
    ap.add_argument("--out", default="engine/cohorts/out")
    ap.add_argument("--sample", default=None, help="use a committed fixture instead of the full download (CI smoke)")
    ap.add_argument("--train-frac", type=float, default=0.7)
    a = ap.parse_args()

    df = load(a.fd, a.data, a.sample)
    panel = build_panel(df)
    feats = [c for c in panel.columns if c.startswith(("hours", "lvl_", "trd_", "vol_"))]
    units = np.sort(panel.unit.unique())
    n_train = int(round(len(units) * a.train_frac))
    train, hold = panel[panel.unit.isin(units[:n_train])].copy(), panel[panel.unit.isin(units[n_train:])].copy()
    tag = f"cmapss_{a.fd.lower()}" + ("_sample" if a.sample else "")
    out = os.path.join(a.out, tag)
    os.makedirs(out, exist_ok=True)
    print(f"{a.fd}: units={len(units)} train={len(train)} holdout={len(hold)} event-rate train={train.event30.mean():.3f} holdout={hold.event30.mean():.3f}")

    sc = M.fit_scorecard(train, feats, "event30")
    ev = M.evaluate(hold, "event30", sc.predict_proba(hold))
    abl = M.ablations(train, hold, "event30", {
        "full": feats,
        "hours_only": ["hours"],
        "sensors_only": [f for f in feats if f != "hours"],
    })
    dataset = f"NASA C-MAPSS {a.fd} (simulation benchmark; {DESC[a.fd]})"
    caption = (f"Data: NASA C-MAPSS {a.fd} physics-based degradation simulation benchmark - methodology validation, not market data. "
               f"Model: logistic scorecard, out-of-machine holdout (units {units[n_train]}-{units[-1]}).")
    M.make_charts(out, ev, "event30", caption)
    metrics = M.metrics_dict(dataset, ev, f"failure within next {HORIZON} cycles", n_train, len(units) - n_train, abl)
    json.dump(metrics, open(f"{out}/metrics.json", "w"), indent=2)
    M.write_contract(out, sc, f"failure within next {HORIZON} operating cycles", metrics, dict(
        cohort=tag, dataset=dataset, source=SRC.format(fd=a.fd), asset_class="turbofan engine (simulated)",
        data_kind="simulation benchmark", label=f"C-MAPSS {a.fd} · simulated turbofans · {len(units)} machines",
        machines=int(len(units)), rows=int(len(panel)), sample=bool(a.sample)))
    M.write_trajectory(out, panel, feats, "unit", "rul", pd.Series(True, index=panel.index), horizon=200)
    ev.deciles.round(4).to_csv(f"{out}/decile_table.csv", index=False)
    M.write_report(out, f"MRS — C-MAPSS {a.fd} cohort report (illustrative)",
        f"Same scorecard as v0, applied to C-MAPSS {a.fd}: {DESC[a.fd]}. {len(units)} simulated turbofans, {len(df):,} telemetry cycles. "
        "Simulation benchmark — validates the method under regime shift, not the market.",
        ["Unit of scoring: one machine at one point in time, using only its past 20 cycles.",
         "Features (43): cumulative cycles; 5-cycle sensor levels; 15-cycle degradation trends; 10-cycle volatility — 14 informative sensors. No future leakage.",
         f"Event: failure within the next {HORIZON} cycles.",
         "Model: standardised logistic regression, C=0.5 — identical to v0; no regime normalisation on purpose.",
         "Score: PDO 40, 600 points at 15:1 odds, clipped 300–850.",
         f"Validation: out-of-machine holdout — units {units[n_train]}–{units[-1]} never seen in training."],
        ev, abl, sc,
        ["C-MAPSS is simulated physics, not field data.",
         "Multi-condition sets (FD002/FD004) shift raw sensor levels by regime; a naive scorecard pays for ignoring that — the honest v0 number, not a tuned one.",
         "Logistic v0 will underperform survival models on long-horizon risk; the point is that even the dumb model has underwriting power."],
        f"holdout, {ev.n:,} machine-cycles on {len(units)-n_train} unseen machines")
    print(json.dumps({k: v for k, v in metrics.items() if k != "ablations"}, indent=1))
    print("ablations", abl)
    print("done ->", out)


if __name__ == "__main__":
    main()
