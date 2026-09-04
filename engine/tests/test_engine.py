"""Engine tests: framework reproduces the v0 baseline; smoke pipelines run on committed fixtures; contracts are well-formed."""
import json
import os
import subprocess
import sys

import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "engine"))
from lib import mrslib as M  # noqa: E402

CONTRACT_KEYS = {"kind", "event", "features", "mean", "std", "coef", "intercept", "score_scaling", "holdout_metrics"}


def test_score_scaling_matches_contract_math():
    p = np.array([1e-9, 0.001, 0.0625, 0.5, 0.999])
    s = M.to_score(p)
    assert s[0] == 850 and s[-1] == 300
    # 600 points at 15:1 good:bad odds  ->  p = 1/16
    assert abs(s[2] - 600) < 1e-6


def test_committed_contracts_are_well_formed_and_scoring_reproduces_golden():
    for path in ["engine/mrs_v0/out/mrs_model.json", "engine/cohorts/out/cmapss_fd001/mrs_model.json", "engine/cohorts/out/cmapss_fd002/mrs_model.json", "engine/cohorts/out/cmapss_fd004/mrs_model.json"]:
        m = json.load(open(os.path.join(ROOT, path)))
        assert CONTRACT_KEYS <= set(m) and m["kind"] == "logistic_scorecard_v0"
        assert set(m["features"]) == set(m["mean"]) == set(m["std"]) == set(m["coef"])
        assert m["score_scaling"] == {"PDO": 40.0, "base_score": 600.0, "base_odds": 15.0, "clip": [300, 850]}
    v0 = json.load(open(os.path.join(ROOT, "engine/mrs_v0/out/mrs_model.json")))
    fd1 = json.load(open(os.path.join(ROOT, "engine/cohorts/out/cmapss_fd001/mrs_model.json")))
    assert all(abs(v0["coef"][f] - fd1["coef"][f]) < 1e-9 for f in v0["features"]) and abs(v0["intercept"] - fd1["intercept"]) < 1e-9
    g = json.load(open(os.path.join(ROOT, "engine/fixtures/golden_mrs_v0.json")))
    sc = M.Scorecard(v0["features"], pd.Series(v0["mean"]), pd.Series(v0["std"]), np.array([v0["coef"][f] for f in v0["features"]]), v0["intercept"])
    for c in g["cases"]:
        x = pd.DataFrame([c["x"]])
        assert abs(float(sc.predict_proba(x)[0]) - c["p"]) < 1e-9
        assert abs(float(sc.score(x)[0]) - c["mrs"]) < 1e-6


def _run(args, out):
    r = subprocess.run([sys.executable, *args, "--out", out], cwd=ROOT, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    return r.stdout


def test_smoke_pipelines_on_fixtures(tmp_path):
    out = str(tmp_path)
    _run(["engine/cohorts/cmapss.py", "--fd", "FD001", "--sample", "engine/fixtures/cmapss_fd001_sample.txt"], out)
    _run(["engine/cohorts/backblaze.py", "--sample", "engine/fixtures/backblaze_schema_sample.csv"], out)
    _run(["engine/cohorts/gpu_alibaba2020.py", "--sample-dir", "engine/fixtures/gpu_schema_sample"], out)
    for tag in ["cmapss_fd001_sample", "backblaze_sample", "gpu_alibaba2020_sample"]:
        d = os.path.join(out, tag)
        for f in ["mrs_model.json", "metrics.json", "REPORT.md", "lift_curve.png", "calibration.png", "score_distribution.png", "finance_mapping.png", "trajectory.json", "decile_table.csv"]:
            assert os.path.exists(os.path.join(d, f)), f"{tag}/{f}"
        m = json.load(open(os.path.join(d, "mrs_model.json")))
        assert CONTRACT_KEYS <= set(m)
        if tag != "cmapss_fd001_sample":
            assert m["provenance"]["sample"] is True and "SYNTHETIC" in m["provenance"]["label"]
            assert "SYNTHETIC" in open(os.path.join(d, "REPORT.md")).read()
    real = json.load(open(os.path.join(out, "cmapss_fd001_sample", "metrics.json")))
    assert real["auc"] > 0.9  # 10 real C-MAPSS units still separate
