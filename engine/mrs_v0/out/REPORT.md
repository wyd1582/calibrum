# MRS v0 — backtest report (illustrative)

**What was tested.** Can a simple, auditable scorecard — the kind a consumer-credit
shop would build — rank machines by imminent failure risk using only operating
telemetry? Data: NASA C-MAPSS FD001, a physics-based run-to-failure degradation
simulation benchmark: 100 machines, 20,631 telemetry cycles. This validates
the *methodology*; real-hardware datasets (Backblaze, NIST arm, KUKA wear,
InfiniteHBD GPU) are the next cohorts on the roadmap.

**Design.**
- Unit of scoring: one machine at one point in time, using only its past 20 cycles.
- Features (43): cumulative cycles; 5-cycle sensor levels; 15-cycle degradation
  trends; 10-cycle volatility — across 14 informative sensors. No future leakage.
- Event: failure within the next 30 cycles.
- Model: standardized logistic regression (deliberately boring, fully auditable).
- Score: log-odds scaled FICO-style — PDO 40, 600 points at 15:1 odds, clipped 300–850.
- Validation: **out-of-machine holdout** — machines 71–100 never seen in training.

**Results (holdout, 5,931 machine-cycles on 30 unseen machines).**
- Riskiest 20% of machine-cycles captured **97%** of upcoming failures
  (riskiest 10%: 63%).
- AUC **0.99** · Gini **0.99** · KS **0.92**.
- Calibration by decile: see calibration.png.

**Ablations (leakage check).** Machine age alone (cycle count): AUC 0.87,
top-20% capture 61%. Sensors alone (no age): AUC 0.99,
capture 96%. The full model's performance comes from degradation
signal in the telemetry, not from a leaked clock. A near-perfect AUC also reflects
that a clean simulation benchmark is far easier than field data — expect materially
lower (and more credible) numbers on Backblaze/KUKA/GPU cohorts, which is the point
of running them next.

**Top model drivers.**
```
feature      coef
 lvl_s9  1.194993
 lvl_s4  1.184640
 lvl_s2  1.108501
lvl_s12 -1.102219
 lvl_s8  1.027090
  hours -1.008230
lvl_s14  1.005785
trd_s11  0.948065
```

**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread
via documented monotone functions (finance_mapping.png). These are placeholders
until calibrated against a real claims/loan book with a design partner.

**Honesty notes.** (1) C-MAPSS is simulated physics, not field data — it proves the
pipeline, not the market. (2) One asset type, one operating condition (FD001).
(3) Logistic v0 will underperform survival models on long-horizon risk; that's
fine — the point of v0 is that even the dumb model has underwriting power on
machine telemetry.
