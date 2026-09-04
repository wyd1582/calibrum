# MRS — C-MAPSS FD004 cohort report (illustrative)

**What was tested.** Same scorecard as v0, applied to C-MAPSS FD004: 6 operating conditions, 2 fault modes. 249 simulated turbofans, 61,249 telemetry cycles. Simulation benchmark — validates the method under regime shift, not the market.

**Design.**
- Unit of scoring: one machine at one point in time, using only its past 20 cycles.
- Features (43): cumulative cycles; 5-cycle sensor levels; 15-cycle degradation trends; 10-cycle volatility — 14 informative sensors. No future leakage.
- Event: failure within the next 30 cycles.
- Model: standardised logistic regression, C=0.5 — identical to v0; no regime normalisation on purpose.
- Score: PDO 40, 600 points at 15:1 odds, clipped 300–850.
- Validation: out-of-machine holdout — units 175–249 never seen in training.

**Results (holdout, 16,428 machine-cycles on 75 unseen machines).**
- Riskiest 20% of machine-periods captured **91%** of upcoming failures (riskiest 10%: 61%).
- AUC **0.97** · Gini **0.94** · KS **0.83**.
- Calibration by decile: see calibration.png.

**Ablations (leakage check).**
- **full**: AUC 0.97, top-20% capture 91% (43 features)
- **hours_only**: AUC 0.83, top-20% capture 50% (1 features)
- **sensors_only**: AUC 0.97, top-20% capture 91% (42 features)

**Top model drivers.**
```
feature      coef
lvl_s11  9.552065
 lvl_s8 -7.567561
lvl_s17  7.366174
 lvl_s3  6.931221
vol_s15 -5.590663
lvl_s13 -4.146414
vol_s20 -3.632497
 lvl_s4 -3.572244
```

**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread via documented monotone functions (finance_mapping.png). These are placeholders until calibrated against a real claims/loan book with a design partner.

**Honesty notes.** (1) C-MAPSS is simulated physics, not field data. (2) Multi-condition sets (FD002/FD004) shift raw sensor levels by regime; a naive scorecard pays for ignoring that — the honest v0 number, not a tuned one. (3) Logistic v0 will underperform survival models on long-horizon risk; the point is that even the dumb model has underwriting power.
