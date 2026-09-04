# MRS — C-MAPSS FD001 cohort report (illustrative)

**What was tested.** Same scorecard as v0, applied to C-MAPSS FD001: 1 operating condition, 1 fault mode (HPC degradation). 100 simulated turbofans, 20,631 telemetry cycles. Simulation benchmark — validates the method under regime shift, not the market.

**Design.**
- Unit of scoring: one machine at one point in time, using only its past 20 cycles.
- Features (43): cumulative cycles; 5-cycle sensor levels; 15-cycle degradation trends; 10-cycle volatility — 14 informative sensors. No future leakage.
- Event: failure within the next 30 cycles.
- Model: standardised logistic regression, C=0.5 — identical to v0; no regime normalisation on purpose.
- Score: PDO 40, 600 points at 15:1 odds, clipped 300–850.
- Validation: out-of-machine holdout — units 71–100 never seen in training.

**Results (holdout, 5,931 machine-cycles on 30 unseen machines).**
- Riskiest 20% of machine-periods captured **97%** of upcoming failures (riskiest 10%: 63%).
- AUC **0.99** · Gini **0.99** · KS **0.92**.
- Calibration by decile: see calibration.png.

**Ablations (leakage check).**
- **full**: AUC 0.99, top-20% capture 97% (43 features)
- **hours_only**: AUC 0.87, top-20% capture 61% (1 features)
- **sensors_only**: AUC 0.99, top-20% capture 96% (42 features)

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

**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread via documented monotone functions (finance_mapping.png). These are placeholders until calibrated against a real claims/loan book with a design partner.

**Honesty notes.** (1) C-MAPSS is simulated physics, not field data. (2) Multi-condition sets (FD002/FD004) shift raw sensor levels by regime; a naive scorecard pays for ignoring that — the honest v0 number, not a tuned one. (3) Logistic v0 will underperform survival models on long-horizon risk; the point is that even the dumb model has underwriting power.
