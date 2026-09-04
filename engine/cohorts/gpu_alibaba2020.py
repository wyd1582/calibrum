"""
Cohort: GPU nodes — Alibaba PAI cluster trace v2020 (~1 800 machines, 6 500 GPUs, Jul–Aug 2020).

The trace records jobs, instances and machine metrics, not hardware death, so the
insurable event has to be defined honestly:

  EVENT = "instance-failure burst": the machine hosts >= BURST_K failed instances in
  the next 7 days, having hosted fewer than that in the previous 7. It is a node-health
  proxy that conflates hardware faults with software failures landing on the node; the
  report says so. A production GPU cohort should use a real fault trace (InfiniteHBD-
  style) when one is accessible — see DECISIONS.md.

Per-machine daily panel (data <= T only):
  levels (7-day means): gpu util, cpu util, iowait, load_1, workers/machine
  trend:  7-day mean minus previous 7-day mean, for gpu util and load
  vol:    7-day std of gpu util and load
  burden: failed instances in the last 7 days, instances started in the last 7 days
  hours:  days since the machine first appears in the trace (age proxy — labelled as such)

Usage
  python engine/cohorts/gpu_alibaba2020.py                 # [network] downloads pai_machine_metric + pai_instance_table from aliyun OSS
  python engine/cohorts/gpu_alibaba2020.py --sample-dir engine/fixtures/gpu_schema_sample   # CI smoke on a SYNTHETIC schema fixture
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tarfile
import urllib.request

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import mrslib as M  # noqa: E402

OSS = "http://aliopentrace.oss-cn-beijing.aliyuncs.com/v2020GPUTraces/{f}.tar.gz"
METRIC_COLS = ["worker_name", "machine", "start_time", "end_time", "machine_cpu_iowait", "machine_cpu_kernel", "machine_cpu_usr", "machine_gpu",
               "machine_load_1", "machine_net_receive", "machine_num_worker", "machine_cpu"]
INSTANCE_COLS = ["job_name", "task_name", "inst_name", "worker_name", "inst_id", "status", "start_time", "end_time", "machine", "gpu_type"]
BURST_K = 3
HORIZON = 7


def fetch(data_dir: str, name: str) -> str:
    csv = os.path.join(data_dir, f"{name}.csv")
    if os.path.exists(csv):
        return csv
    os.makedirs(data_dir, exist_ok=True)
    tgz = os.path.join(data_dir, f"{name}.tar.gz")
    if not os.path.exists(tgz):
        print(f"downloading {OSS.format(f=name)} ...")
        urllib.request.urlretrieve(OSS.format(f=name), tgz)
    with tarfile.open(tgz) as t:
        t.extractall(data_dir)
    return csv


def load(metric_csv: str, instance_csv: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    m = pd.read_csv(metric_csv, header=None, names=METRIC_COLS)
    i = pd.read_csv(instance_csv, header=None, names=INSTANCE_COLS)
    m["day"] = (m["start_time"] // 86400).astype(int)
    i["day"] = (i["end_time"].fillna(i["start_time"]) // 86400).astype(int)
    return m, i


def build_panel(m: pd.DataFrame, inst: pd.DataFrame) -> pd.DataFrame:
    daily = m.groupby(["machine", "day"]).agg(gpu=("machine_gpu", "mean"), cpu=("machine_cpu", "mean"), iowait=("machine_cpu_iowait", "mean"),
                                              load=("machine_load_1", "mean"), workers=("machine_num_worker", "mean")).reset_index()
    fails = inst[inst.status.isin(["Failed"])].groupby(["machine", "day"]).size().rename("failed")
    starts = inst.groupby(["machine", "day"]).size().rename("started")
    daily = daily.merge(fails, left_on=["machine", "day"], right_index=True, how="left").merge(starts, left_on=["machine", "day"], right_index=True, how="left")
    daily[["failed", "started"]] = daily[["failed", "started"]].fillna(0)
    rows = []
    for mach, g in daily.groupby("machine", sort=False):
        g = g.sort_values("day").reset_index(drop=True)
        if len(g) < 21:
            continue
        first = g.day.iloc[0]
        vals = g[["gpu", "cpu", "iowait", "load", "workers"]].values
        failed, started = g.failed.values, g.started.values
        n = len(g)
        for t in range(14, n - HORIZON):
            w = vals[t - 6 : t + 1]
            pw = vals[t - 13 : t - 6]
            fut = failed[t + 1 : t + 1 + HORIZON].sum()
            past = failed[t - 6 : t + 1].sum()
            event = int(fut >= BURST_K and past < BURST_K)
            tte = next((k + 1 for k in range(HORIZON) if failed[t + 1 : t + 2 + k].sum() >= BURST_K), np.nan) if event else np.nan
            rows.append([mach, g.day.iloc[t], event, tte, g.day.iloc[t] - first, *w.mean(axis=0), w.mean(axis=0)[0] - pw.mean(axis=0)[0], w.mean(axis=0)[3] - pw.mean(axis=0)[3],
                         w.std(axis=0)[0], w.std(axis=0)[3], past, started[t - 6 : t + 1].sum()])
    cols = ["machine", "day", "event7", "tte", "hours", "lvl_gpu", "lvl_cpu", "lvl_iowait", "lvl_load", "lvl_workers", "trd_gpu", "trd_load", "vol_gpu", "vol_load", "fail7", "start7"]
    return pd.DataFrame(rows, columns=cols)


def split(panel: pd.DataFrame, frac=0.7):
    h = panel.machine.map(lambda s: int(hashlib.sha256(str(s).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF)
    return panel[h < frac].copy(), panel[h >= frac].copy()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/alibaba2020")
    ap.add_argument("--out", default="engine/cohorts/out")
    ap.add_argument("--sample-dir", default=None, help="directory with pai_machine_metric.csv + pai_instance_table.csv fixtures (SYNTHETIC schema smoke)")
    a = ap.parse_args()
    if a.sample_dir:
        m, i = load(os.path.join(a.sample_dir, "pai_machine_metric.csv"), os.path.join(a.sample_dir, "pai_instance_table.csv"))
        tag, synthetic = "gpu_alibaba2020_sample", True
    else:
        m, i = load(fetch(a.data, "pai_machine_metric"), fetch(a.data, "pai_instance_table"))
        tag, synthetic = "gpu_alibaba2020", False
    panel = build_panel(m, i)
    feats = [c for c in panel.columns if c.startswith(("hours", "lvl_", "trd_", "vol_", "fail7", "start7"))]
    train, hold = split(panel)
    out = os.path.join(a.out, tag)
    os.makedirs(out, exist_ok=True)
    print(f"{tag}: machines={panel.machine.nunique()} rows train={len(train)} holdout={len(hold)} events holdout={int(hold.event7.sum())}")
    if hold.event7.sum() == 0 or train.event7.sum() == 0:
        raise SystemExit("not enough burst events to fit")
    sc = M.fit_scorecard(train, feats, "event7")
    ev = M.evaluate(hold, "event7", sc.predict_proba(hold))
    abl = M.ablations(train, hold, "event7", {"full": feats, "hours_only": ["hours"], "no_age": [f for f in feats if f != "hours"],
                                              "utilisation_only": [f for f in feats if f.startswith(("lvl_", "trd_", "vol_"))]})
    dataset = "Alibaba PAI GPU cluster trace v2020" + (" [SYNTHETIC SMOKE FIXTURE]" if synthetic else "")
    caption = ("SYNTHETIC schema fixture - smoke test only, not data." if synthetic else
               "Data: Alibaba PAI GPU cluster trace v2020 (~1,800 machines, Jul-Aug 2020). Event = instance-failure burst on the node (node-health proxy; conflates hardware and software failures). Out-of-machine holdout.")
    M.make_charts(out, ev, "event7", caption, asset_value=250_000, horizon_label="next 7 days")
    metrics = M.metrics_dict(dataset, ev, f">= {BURST_K} failed instances on the node within the next {HORIZON} days", int(train.machine.nunique()), int(hold.machine.nunique()), abl)
    metrics.update(synthetic=synthetic, event_definition_note="task-failure burst as node-health proxy — not hardware death")
    json.dump(metrics, open(f"{out}/metrics.json", "w"), indent=2)
    M.write_contract(out, sc, f"instance-failure burst (>= {BURST_K} in next {HORIZON} days)", metrics, dict(
        cohort=tag, dataset=dataset, source=OSS.format(f="pai_machine_metric"), asset_class="GPU node (real cluster trace, failure-burst proxy)",
        data_kind="synthetic schema fixture" if synthetic else "field trace", label=("SYNTHETIC SMOKE" if synthetic else "Alibaba PAI GPU trace 2020 · ~1,800 nodes · failure-burst proxy"),
        machines=int(panel.machine.nunique()), rows=int(len(panel)), sample=synthetic))
    M.write_trajectory(out, panel, feats, "machine", "tte", panel.tte.notna(), horizon=HORIZON)
    ev.deciles.round(4).to_csv(f"{out}/decile_table.csv", index=False)
    M.write_report(out, f"MRS — GPU cohort report ({'SYNTHETIC SMOKE' if synthetic else 'illustrative'})",
        f"{dataset}. Machines: {panel.machine.nunique():,}; machine-days scored: {len(panel):,}. The trace records jobs and utilisation, not hardware death.",
        ["Unit of scoring: one GPU node on one day, using only its past 14 days.",
         "Features: 7-day mean GPU/CPU/iowait/load/worker-count; 7-day trend of GPU util and load; 7-day volatility; failed and started instances in the last 7 days; days since first seen (age proxy).",
         f"Event: >= {BURST_K} failed instances land on the node in the next {HORIZON} days after a quiet week — a node-health proxy, stated as such.",
         "Model: standardised logistic regression, C=0.5 — identical to v0.",
         "Validation: out-of-machine holdout by machine hash (70/30)."],
        ev, abl, sc,
        ["The label conflates hardware faults with software failures that happen to land on the node; it measures 'this node is about to be a bad place to schedule work', which is what a lender haircuts, not 'the GPU died'.",
         "Two months of trace; no node age beyond the trace window.",
         "A real fault trace (InfiniteHBD-style) replaces this cohort when accessible."],
        f"holdout, {ev.n:,} machine-days on {hold.machine.nunique():,} unseen machines",
        extra_sections={"How a lender should haircut a GPU cluster (sketch)": "LTV_node = base_LTV(MRS) × utilisation-adjusted residual, where residual depreciates with cumulative GPU-hours rather than calendar time; a node whose failure-burst probability is in the worst decile is excluded from the borrowing base. Worked example: collateral_note.md (to be written against real trace output)."})
    print(json.dumps({k: v for k, v in metrics.items() if k != "ablations"}, indent=1, default=str))
    print("done ->", out)


if __name__ == "__main__":
    main()
