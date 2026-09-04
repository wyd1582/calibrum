"""
SYNTHETIC schema fixtures for CI smoke tests of the Backblaze and GPU pipelines.

These files contain NO real data. They reproduce the column layout of the real
sources so the ingestion → panel → scorecard → report code path runs offline in
CI. Every output produced from them is labelled SYNTHETIC SMOKE FIXTURE. They are
never copied into the app and never appear in an investor-facing chart.

python engine/fixtures/make_schema_fixtures.py
"""
import os
import numpy as np
import pandas as pd

here = os.path.dirname(__file__)
rng = np.random.default_rng(2026)

# ---- Backblaze schema: date, serial_number, model, capacity_bytes, failure, smart_*_raw ----
rows = []
days = pd.date_range("2024-07-01", periods=120)
for d in range(160):
    sn = f"SYN{d:05d}"
    fail_day = int(rng.integers(45, 120)) if rng.random() < 0.25 else None
    poh = float(rng.integers(2_000, 40_000))
    realloc = uncorr = timeout = pending = offl = 0.0
    temp0 = rng.normal(30, 3)
    for t, day in enumerate(days):
        if fail_day is not None and t > fail_day:
            break
        if fail_day is not None and t > fail_day - 40:
            pending += rng.poisson(0.6)
            realloc += rng.poisson(0.3)
            uncorr += rng.poisson(0.1)
        rows.append([day.date(), sn, "SYN-MODEL", 8_000_000_000_000, int(fail_day is not None and t == fail_day), poh + 24 * t, realloc, uncorr, timeout, pending, offl,
                     round(temp0 + rng.normal(0, 1.5) + (2 if fail_day is not None and t > fail_day - 20 else 0), 1)])
bb = pd.DataFrame(rows, columns=["date", "serial_number", "model", "capacity_bytes", "failure", "smart_9_raw", "smart_5_raw", "smart_187_raw", "smart_188_raw", "smart_197_raw", "smart_198_raw", "smart_194_raw"])
bb.to_csv(os.path.join(here, "backblaze_schema_sample.csv"), index=False)
print("backblaze fixture", bb.shape, "failures", int(bb.failure.sum()))

# ---- Alibaba PAI 2020 schema: pai_machine_metric + pai_instance_table (header-less) ----
os.makedirs(os.path.join(here, "gpu_schema_sample"), exist_ok=True)
met, inst = [], []
for mi in range(60):
    mach = f"synmach{mi:03d}"
    bad_from = int(rng.integers(25, 55)) if rng.random() < 0.35 else None
    for day in range(60):
        base = 86_400 * day
        for k in range(6):
            st = base + k * 14_400
            stress = 1.0 if bad_from is None or day < bad_from else 1.6
            met.append([f"w{mi}_{day}_{k}", mach, st, st + 14_400, abs(rng.normal(2, 1)) * stress, abs(rng.normal(8, 2)), abs(rng.normal(30, 8)), min(100, abs(rng.normal(55, 15)) * stress),
                        abs(rng.normal(12, 4)) * stress, abs(rng.normal(5e6, 1e6)), int(rng.integers(1, 8)), min(100, abs(rng.normal(40, 10)))])
        n_inst = int(rng.integers(3, 12))
        for j in range(n_inst):
            failed = rng.random() < (0.35 if bad_from is not None and day >= bad_from else 0.03)
            st = base + int(rng.integers(0, 80_000))
            inst.append([f"job{mi}_{day}_{j}", "worker", f"inst{j}", f"w{mi}_{day}_{j}", int(rng.integers(1, 1e6)), "Failed" if failed else "Terminated", st, st + int(rng.integers(600, 6000)), mach, "V100"])
pd.DataFrame(met).to_csv(os.path.join(here, "gpu_schema_sample", "pai_machine_metric.csv"), index=False, header=False)
pd.DataFrame(inst).to_csv(os.path.join(here, "gpu_schema_sample", "pai_instance_table.csv"), index=False, header=False)
print("gpu fixture", len(met), "metric rows,", len(inst), "instances")
open(os.path.join(here, "gpu_schema_sample", "README.md"), "w").write("SYNTHETIC schema fixture for CI smoke tests. No real data. Regenerate with `python engine/fixtures/make_schema_fixtures.py`.\n")
