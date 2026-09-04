"""
Generate golden scoring vectors from a contract file (mrs_model.json) so the
TypeScript implementation in apps/web can be tested against Python — the same
math run_mrs_v0.py used to train and score.

Usage: python engine/fixtures/make_golden.py engine/mrs_v0/out/mrs_model.json engine/fixtures/golden_mrs_v0.json
"""
import json
import sys
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
m = json.load(open(src))
F = m["features"]
mu = np.array([m["mean"][f] for f in F])
sd = np.array([m["std"][f] for f in F])
coef = np.array([m["coef"][f] for f in F])
b0 = m["intercept"]
sc = m["score_scaling"]
B = sc["PDO"] / np.log(2)

def score(x):
    z = (x - mu) / sd
    contrib = coef * z
    logit = b0 + contrib.sum()
    p = 1 / (1 + np.exp(-logit))
    pc = min(max(p, 1e-6), 1 - 1e-6)
    odds_good = (1 - pc) / pc
    mrs = float(np.clip(sc["base_score"] + B * np.log(odds_good / sc["base_odds"]), *sc["clip"]))
    return dict(logit=float(logit), p=float(p), mrs=mrs, contributions={f: float(c) for f, c in zip(F, contrib)})

rng = np.random.default_rng(2026)
cases = []
def add(name, x): cases.append(dict(name=name, x={f: float(v) for f, v in zip(F, x)}, **score(np.asarray(x, dtype=float))))
add("at_mean", mu)
add("plus_one_sd", mu + sd)
add("minus_one_sd", mu - sd)
add("plus_half_sd", mu + 0.5 * sd)
add("clip_low_extreme", mu + 4 * sd * np.sign(coef))   # every feature pushed toward risk
add("clip_high_extreme", mu - 4 * sd * np.sign(coef))  # every feature pushed toward safety
for k in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5]:
    add(f"risk_direction_{k}", mu + k * sd * np.sign(coef))  # walk toward risk along the coefficient signs
for i in range(12):
    k = rng.uniform(0.0, 0.9)
    add(f"random_{i}", mu + k * sd * np.sign(coef) + rng.normal(0, 0.7, len(F)) * sd)
json.dump(dict(source=src.split("engine/")[-1], kind=m["kind"], features=F, cases=cases), open(dst, "w"), indent=1)
print(f"wrote {len(cases)} golden vectors -> {dst}")
