# Underwriting Playground — slider → contract feature mapping

The Underwriting Playground drawer in `apps/web` exposes eight sliders. They never price anything themselves. They generate a **feature vector for the model contract** (`mrs_model.json`, handoff Part 4), and the contract scores it. This document is the normative description of that generation; the implementation is `apps/web/lib/contract/sliders.ts`, tested in `score.test.ts`.

## 0. Why a trajectory, not a formula

The contract's 43 features are C-MAPSS turbofan sensor statistics (5-cycle levels, 15-cycle trends, 10-cycle volatilities of 14 sensors, plus cumulative cycles). A slider like "maintenance compliance" has no direct physical meaning in that space, and inventing per-feature formulas would be exactly the ad-hoc math the handoff forbids.

Instead the engine exports, for every cohort, an **empirical degradation trajectory** (`engine/cohorts/out/<cohort>/trajectory.json`, written by `mrslib.write_trajectory`):

* for every failed unit, τ = 1 − clip(time_to_event / horizon, 0, 1), so τ = 0 is far from failure and τ = 1 is failing (horizon = 200 cycles for C-MAPSS);
* the trajectory is the **mean raw feature vector in each of 20 τ-bins**, with τ = 0 also pooling units that never failed;
* `feature_std` is the per-feature standard deviation of the panel.

It is descriptive (a table of means), not a model. Sliders move a synthetic machine along this path and add two documented perturbations. The contract then scores the resulting vector exactly as it would score a real machine-cycle.

## 1. Sliders and ranges

| slider | key | range | normalised as |
|---|---|---|---|
| Maintenance compliance | `maintenance` | 50–100 % | (v − 50)/50 |
| Anomaly / vibration risk | `anomaly` | 0–100 | v/100 |
| Environment severity | `environment` | 0–100 | v/100 |
| Human intervention rate | `intervention` | 0–40 % | v/40 |
| Utilisation | `utilization` | 10–100 % | (v − 10)/90 |
| Firmware / model maturity | `firmware` | 40–100 | (v − 40)/60 |
| Age / hours | `age` | 0–100 (100 ≙ 16 000 h; 160 h per point) | v/100 |
| Incident count | `incidents` | 0–10 | — |

In the Wallet tab, running the machine moves `age` (hours ÷ 160), drifts `anomaly` up (+h/220 + small noise) and `maintenance` down (−h/800); maintenance resets `maintenance` to 100 and reduces `anomaly` by 28; an incident adds 24 to `anomaly` and 1 to `incidents`. These drifts are the founder playground's, ported verbatim.

## 2. Behavioural stress index

```
stress = 0.35·(1 − maintenance_n)
       + 0.15·environment_n
       + 0.20·intervention_n
       + 0.10·max(0, (utilization_n − 0.8)/0.2)
       + 0.10·(1 − firmware_n)
       + 0.10·min(1, incidents/5)
clipped to [0, 1]
```

Weights are a stated design choice (maintenance dominates; over-utilisation only counts above 80 %). They are the only free parameters in the mapping and they live in one function, `stressIndex`.

## 3. Position on the trajectory

```
tauRaw = clip(0.08 + 0.40·age_n + stress·(0.50 + 0.35·age_n), 0, 1)
tau    = lo + (hi − lo)·tauRaw
```

`[lo, hi]` is the **scoring window** of the selected model, computed once per model from its own trajectory (`trajectoryWindow`):

* `lo` = first τ (1/200 grid) where `score(trajectory(τ)) < 845`, minus 0.03 — where the score leaves the healthy plateau;
* `hi` = first τ where `score(trajectory(τ)) < 320` — where it hits the floor.

This matters because the benchmarks differ in shape. On C-MAPSS FD001 the v0 contract scores 850 for the first ~70 % of life and then drops from 850 to 300 within ~20 % of life; on FD004 the decline is gradual across the whole life. Sweeping the full path for FD001 would leave seven of the eight sliders doing nothing. The window is data-derived per model, so the same slider maths works for every cohort in the dropdown:

| model | window |
|---|---|
| MRS v0 · C-MAPSS FD001 | [0.71, 0.905] |
| C-MAPSS FD002 | [0.095, 0.955] |
| C-MAPSS FD004 | [0.00, 0.985] |

The base vector is the linear interpolation of the trajectory at τ.

## 4. Perturbations along the degradation direction

Let `d[f] = trajectory[last][f] − trajectory[first][f]` be the per-feature degradation direction (data-derived, per cohort).

* **Anomaly / vibration**: for trend (`trd_*`) and volatility (`vol_*`) features only,
  `x[f] += 0.35·(anomaly_n − 0.2)·d[f]`. At the default anomaly of ~0.2 this is zero; higher anomaly pushes the dynamics features toward the failing end, lower pulls them back.
* **Incidents**: for every sensor feature, `x[f] += 0.08·incidents·d[f]` — each incident is a step of 8 % of the full degradation excursion.
* **Hours**: `x.hours = hours[first] + age_n·(hours[last] − hours[first])`, i.e. the age slider positions the machine on the trajectory's own operating-cycle scale.

## 5. Guarantees (tested)

* Deterministic: same sliders + model ⇒ identical vector and score.
* Every contract feature is produced and finite.
* Monotone: worsening any single slider never raises the score; the worst corner scores < 450 and the best > 800 on every cohort.
* The default machine sits in the "Standard"/"Prime" tiers on every cohort.
* Golden vectors from Python (`engine/fixtures/golden_mrs_v0.json`) pin the TypeScript scoring math itself to 1e-6.

## 6. What this is not

The playground machine is synthetic, and it says so on screen. The *contract* it is scored by is the real trained artefact. The mapping's purpose is to make the contract's behaviour legible to an underwriter — "if maintenance slips, which features move and what does that do to the premium" — not to claim that a real AMR's maintenance rate translates into turbofan sensor readings. When a robot cohort ships, its own trajectory replaces this one and the sliders keep working unchanged.
