# MRS — C-MAPSS FD002 cohort report (illustrative)

**What was tested.** Same scorecard as v0, applied to C-MAPSS FD002: 6 operating conditions, 1 fault mode. 260 simulated turbofans, 53,759 telemetry cycles. Simulation benchmark — validates the method under regime shift, not the market.

**Design.**
- Unit of scoring: one machine at one point in time, using only its past 20 cycles.
- Features (43): cumulative cycles; 5-cycle sensor levels; 15-cycle degradation trends; 10-cycle volatility — 14 informative sensors. No future leakage.
- Event: failure within the next 30 cycles.
- Model: standardised logistic regression, C=0.5 — identical to v0; no regime normalisation on purpose.
- Score: PDO 40, 600 points at 15:1 odds, clipped 300–850.
- Validation: out-of-machine holdout — units 183–260 never seen in training.

**Results (holdout, 14,243 machine-cycles on 78 unseen machines).**
- Riskiest 20% of machine-periods captured **92%** of upcoming failures (riskiest 10%: 58%).
- AUC **0.99** · Gini **0.97** · KS **0.87**.
- Calibration by decile: see calibration.png.

**Ablations (leakage check).**
- **full**: AUC 0.99, top-20% capture 92% (43 features)
- **hours_only**: AUC 0.88, top-20% capture 60% (1 features)
- **sensors_only**: AUC 0.98, top-20% capture 91% (42 features)

**Top model drivers.**
```
feature      coef
lvl_s15 14.255311
lvl_s11  8.877461
 lvl_s2 -7.830681
 lvl_s4  5.956003
 lvl_s9 -4.389515
 trd_s2 -4.335969
lvl_s13  4.299804
lvl_s17  3.581970
```

**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread via documented monotone functions (finance_mapping.png). These are placeholders until calibrated against a real claims/loan book with a design partner.

**Honesty notes.** (1) C-MAPSS is simulated physics, not field data. (2) Multi-condition sets (FD002/FD004) shift raw sensor levels by regime; a naive scorecard pays for ignoring that — the honest v0 number, not a tuned one. (3) Logistic v0 will underperform survival models on long-horizon risk; the point is that even the dumb model has underwriting power.
