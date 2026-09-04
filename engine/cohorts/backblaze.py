"""
Cohort: Backblaze Drive Stats — the large-scale real-hardware proof.

Each drive is a "machine". Daily SMART telemetry + a failure flag, hundreds of
thousands of drives. This is a deliberate proxy: the methodology (behaviour ->
failure -> score), not the asset, is what is being validated. Captions say so.

Pipeline
  1. Ingest quarterly CSVs (date, serial_number, model, failure, smart_*_raw).
  2. Per-drive daily panel. Features at scoring date T use data <= T only:
       levels:  power_on_hours (smart_9), reallocated sectors (5), reported
                uncorrectable (187), command timeout (188), pending sectors (197),
                offline uncorrectable (198), temperature (194)
       deltas:  7-day and 30-day change of each error counter
       vol:     30-day std of temperature and of the pending-sector count
  3. Event: the drive fails within the next 30 days. Rows whose 30-day future is
     not observed (drive still alive at the end of the window) are dropped —
     censoring is handled by exclusion, not by pretending "no failure".
  4. Healthy drives are subsampled (default 5 % of never-failing drives, all
     rows kept for every drive that fails) and RE-WEIGHTED in the fit so that
     predicted probabilities refer to the full population. Metrics report the
     enrichment explicitly.
  5. Split by drive (hash of serial): 70 % train / 30 % holdout. Same scorecard,
     same scaling, same report as every other cohort.

Usage
  python engine/cohorts/backblaze.py --quarters 2024Q3,2024Q4            # [network] downloads ~2 GB of zips
  python engine/cohorts/backblaze.py --sample engine/fixtures/backblaze_schema_sample.csv   # CI smoke on a SYNTHETIC schema fixture

The schema fixture is synthetic and labelled as such in every output it touches; it
exercises the code path only and is never used for an investor-facing chart.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import sys
import urllib.request
import zipfile

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import mrslib as M  # noqa: E402

URL = "https://f001.backblazeb2.com/file/Backblaze-Hard-Drive-Data/data_{q}_{y}.zip"
SMART = {"smart_9_raw": "poh", "smart_5_raw": "realloc", "smart_187_raw": "uncorr", "smart_188_raw": "cmd_timeout",
         "smart_197_raw": "pending", "smart_198_raw": "offline_uncorr", "smart_194_raw": "temp"}
COUNTERS = ["realloc", "uncorr", "cmd_timeout", "pending", "offline_uncorr"]
HORIZON = 30
NEED = ["date", "serial_number", "model", "failure"] + list(SMART)


def download(quarters: list[str], data_dir: str) -> list[str]:
    files = []
    for q in quarters:
        y, qq = q[:4], q[4:]
        d = os.path.join(data_dir, q)
        if not glob.glob(f"{d}/**/*.csv", recursive=True):
            os.makedirs(d, exist_ok=True)
            z = os.path.join(data_dir, f"data_{qq}_{y}.zip")
            if not os.path.exists(z):
                print(f"downloading {URL.format(q=qq, y=y)} ...")
                urllib.request.urlretrieve(URL.format(q=qq, y=y), z)
            with zipfile.ZipFile(z) as zf:
                zf.extractall(d)
        files += sorted(glob.glob(f"{d}/**/*.csv", recursive=True))
    return files


def ingest(files: list[str]) -> pd.DataFrame:
    parts = []
    for f in files:
        df = pd.read_csv(f, usecols=lambda c: c in NEED)
        parts.append(df)
    df = pd.concat(parts, ignore_index=True)
    df = df.rename(columns=SMART)
    df["date"] = pd.to_datetime(df["date"])
    for c in COUNTERS:
        df[c] = df[c].fillna(0)
    df = df.dropna(subset=["poh"])
    return df.sort_values(["serial_number", "date"]).reset_index(drop=True)


def build_panel(df: pd.DataFrame, healthy_frac: float, seed: int = 7) -> tuple[pd.DataFrame, dict]:
    failed = set(df.loc[df.failure == 1, "serial_number"])
    rng = np.random.default_rng(seed)
    healthy = sorted(set(df.serial_number) - failed)
    keep_h = set(np.array(healthy)[rng.random(len(healthy)) < healthy_frac]) if healthy else set()
    d = df[df.serial_number.isin(failed | keep_h)].copy()
    d["weight"] = np.where(d.serial_number.isin(failed), 1.0, 1.0 / max(healthy_frac, 1e-9))
    rows = []
    for sn, g in d.groupby("serial_number", sort=False):
        g = g.sort_values("date").reset_index(drop=True)
        if len(g) < HORIZON + 1:
            continue
        fail_day = g.index[g.failure == 1].min() if (g.failure == 1).any() else None
        last_day = fail_day if fail_day is not None else len(g) - 1
        cnt = g[COUNTERS].values
        temp = g["temp"].values
        for i in range(30, last_day + 1):
            future_observed = (last_day - i) >= HORIZON or fail_day is not None
            if not future_observed:
                break
            event = int(fail_day is not None and fail_day - i <= HORIZON)
            lvl = cnt[i]
            d7 = cnt[i] - cnt[i - 7]
            d30 = cnt[i] - cnt[i - 30]
            tw = temp[i - 29 : i + 1]
            pw = cnt[i - 29 : i + 1, COUNTERS.index("pending")]
            tte = (fail_day - i) if fail_day is not None else np.nan
            rows.append([sn, g.loc[i, "date"], event, tte, g.loc[i, "weight"], g.loc[i, "poh"], *lvl, np.nanmean(tw), *d7, *d30, np.nanstd(tw), np.std(pw)])
    cols = (["serial", "date", "event30", "tte", "weight", "hours"] + [f"lvl_{c}" for c in COUNTERS] + ["lvl_temp"]
            + [f"d7_{c}" for c in COUNTERS] + [f"d30_{c}" for c in COUNTERS] + ["vol_temp", "vol_pending"])
    panel = pd.DataFrame(rows, columns=cols)
    info = dict(drives_total=int(df.serial_number.nunique()), drives_failed=int(len(failed)), drives_healthy_sampled=int(len(keep_h)), healthy_frac=healthy_frac)
    return panel, info


def split_by_serial(panel: pd.DataFrame, train_frac=0.7):
    h = panel.serial.map(lambda s: int(hashlib.sha256(str(s).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF)
    return panel[h < train_frac].copy(), panel[h >= train_frac].copy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quarters", default="2024Q3,2024Q4")
    ap.add_argument("--data", default="data/backblaze")
    ap.add_argument("--out", default="engine/cohorts/out")
    ap.add_argument("--sample", default=None, help="CSV fixture instead of downloads (SYNTHETIC schema smoke)")
    ap.add_argument("--healthy-frac", type=float, default=0.05)
    a = ap.parse_args()

    if a.sample:
        df = ingest([a.sample])
        tag, synthetic = "backblaze_sample", True
    else:
        df = ingest(download(a.quarters.split(","), a.data))
        tag, synthetic = "backblaze", False
    panel, info = build_panel(df, healthy_frac=1.0 if synthetic else a.healthy_frac)
    feats = [c for c in panel.columns if c.startswith(("hours", "lvl_", "d7_", "d30_", "vol_"))]
    train, hold = split_by_serial(panel)
    out = os.path.join(a.out, tag)
    os.makedirs(out, exist_ok=True)
    print(f"{tag}: {info} rows train={len(train)} holdout={len(hold)} events holdout={int(hold.event30.sum())}")
    if hold.event30.sum() == 0 or train.event30.sum() == 0:
        raise SystemExit("not enough failure events to fit — widen the quarters")

    sc = M.fit_scorecard(train, feats, "event30")
    ev = M.evaluate(hold, "event30", sc.predict_proba(hold))
    abl = M.ablations(train, hold, "event30", {"full": feats, "hours_only": ["hours"], "no_age": [f for f in feats if f != "hours"],
                                               "levels_only": [f for f in feats if f.startswith("lvl_")]})
    label = "SYNTHETIC SCHEMA FIXTURE — SMOKE TEST ONLY" if synthetic else f"Backblaze Drive Stats {a.quarters} (real hardware; disks as a proxy asset)"
    dataset = f"Backblaze Drive Stats {a.quarters}" + (" [SYNTHETIC SMOKE FIXTURE]" if synthetic else "")
    caption = ("SYNTHETIC schema fixture - smoke test only, not data." if synthetic else
               f"Data: Backblaze Drive Stats {a.quarters}, daily SMART telemetry and failure labels for {info['drives_total']:,} real drives. "
               f"Disks are a deliberate proxy for the methodology, not the asset. Healthy drives subsampled at {a.healthy_frac:.0%} and re-weighted. Out-of-drive holdout.")
    M.make_charts(out, ev, "event30", caption, asset_value=85_000, horizon_label="next 30 days")
    metrics = M.metrics_dict(dataset, ev, f"drive failure within next {HORIZON} days", int(train.serial.nunique()), int(hold.serial.nunique()), abl)
    metrics.update(info, synthetic=synthetic)
    json.dump(metrics, open(f"{out}/metrics.json", "w"), indent=2)
    M.write_contract(out, sc, f"drive failure within next {HORIZON} days", metrics, dict(
        cohort=tag, dataset=dataset, source=URL, asset_class="hard disk drive (real hardware, proxy asset)", data_kind="synthetic schema fixture" if synthetic else "field data",
        label=label, machines=info["drives_total"], rows=int(len(panel)), sample=synthetic))
    M.write_trajectory(out, panel, feats, "serial", "tte", panel.tte.notna(), horizon=90)
    ev.deciles.round(4).to_csv(f"{out}/decile_table.csv", index=False)
    M.write_report(out, f"MRS — Backblaze cohort report ({'SYNTHETIC SMOKE' if synthetic else 'illustrative'})",
        f"{label}. {info['drives_total']:,} drives, {info['drives_failed']:,} failures in window, {len(panel):,} drive-days scored.",
        ["Unit of scoring: one drive on one day, using only its past 30 days.",
         "Features: power-on hours; current error counters (5/187/188/197/198) and temperature; 7-day and 30-day counter deltas; 30-day temperature and pending-sector volatility. No future leakage.",
         f"Event: failure within the next {HORIZON} days; rows without an observed 30-day future are excluded (censoring by exclusion).",
         f"Sampling: all failing drives, {a.healthy_frac:.0%} of never-failing drives, re-weighted in the fit.",
         "Model: standardised logistic regression, C=0.5 — identical to v0.",
         "Validation: out-of-drive holdout by serial hash (70/30)."],
        ev, abl, sc,
        ["Disks are a proxy: the asset is not a robot, the method is the claim.",
         "Two quarters of history is a short window; drive-generation drift and model mix are not modelled at v0.",
         "The healthy-drive subsample is re-weighted so calibration refers to the full fleet; AUC/KS are rank statistics and unaffected."],
        f"holdout, {ev.n:,} drive-days on {hold.serial.nunique():,} unseen drives")
    print(json.dumps({k: v for k, v in metrics.items() if k != "ablations"}, indent=1, default=str))
    print("done ->", out)


if __name__ == "__main__":
    main()
