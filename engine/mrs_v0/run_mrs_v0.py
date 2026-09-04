"""
MRS v0 — Machine Risk Score, illustrative scorecard build
Data: NASA C-MAPSS FD001 (100 machines, run-to-failure telemetry).
C-MAPSS is a physics-based degradation SIMULATION benchmark — used here to
validate the methodology (behavior -> failure -> score), not as market data.
Model: standardized logistic regression -> FICO-style score (PDO=40, 300-850).
Event: machine fails within the next 30 operating cycles.
Split: machines 1-70 train, 71-100 holdout (out-of-machine).
"""
import json, numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, roc_curve

import os, urllib.request
os.makedirs("data", exist_ok=True)
_SRC="https://raw.githubusercontent.com/hankroark/Turbofan-Engine-Degradation/master/CMAPSSData/train_FD001.txt"
if not os.path.exists("data/train_FD001.txt"):
    print("downloading C-MAPSS FD001 ..."); urllib.request.urlretrieve(_SRC, "data/train_FD001.txt")

RNG = np.random.default_rng(7)
OUT = "out"
import os; os.makedirs(OUT, exist_ok=True)

# ---------------- load ----------------
cols = ["unit","cycle","op1","op2","op3"] + [f"s{i}" for i in range(1,22)]
df = pd.read_csv("data/train_FD001.txt", sep=r"\s+", header=None, names=cols)
INFORMATIVE = ["s2","s3","s4","s7","s8","s9","s11","s12","s13","s14","s15","s17","s20","s21"]
maxc = df.groupby("unit")["cycle"].transform("max")
df["rul"] = maxc - df["cycle"]
df["event30"] = (df["rul"] <= 30).astype(int)

# ---------------- panel features ----------------
def build_panel(d):
    rows = []
    for u, g in d.groupby("unit"):
        g = g.sort_values("cycle").reset_index(drop=True)
        S = g[INFORMATIVE].values
        for i in range(19, len(g)):            # need 20 cycles of history
            level = S[i-4:i+1].mean(axis=0)     # recent level (5-cycle mean)
            past  = S[i-19:i-14].mean(axis=0)   # level 15 cycles earlier
            trend = level - past                # degradation trend
            vol   = S[i-9:i+1].std(axis=0)      # 10-cycle volatility
            rows.append([u, g.loc[i,"cycle"], g.loc[i,"event30"], g.loc[i,"rul"],
                         g.loc[i,"cycle"], *level, *trend, *vol])
    fcols = (["unit","cycle","event30","rul","hours"]
             + [f"lvl_{s}" for s in INFORMATIVE]
             + [f"trd_{s}" for s in INFORMATIVE]
             + [f"vol_{s}" for s in INFORMATIVE])
    return pd.DataFrame(rows, columns=fcols)

panel = build_panel(df)
FEATS = [c for c in panel.columns if c.startswith(("hours","lvl_","trd_","vol_"))]

train = panel[panel.unit <= 70].copy()
hold  = panel[panel.unit >= 71].copy()
print(f"panel rows train={len(train)} holdout={len(hold)}  "
      f"event-rate train={train.event30.mean():.3f} holdout={hold.event30.mean():.3f}")

# ---------------- model: the Capital One special ----------------
mu, sd = train[FEATS].mean(), train[FEATS].std().replace(0, 1)
Xtr = (train[FEATS] - mu) / sd
Xho = (hold[FEATS]  - mu) / sd
clf = LogisticRegression(C=0.5, max_iter=2000)
clf.fit(Xtr, train.event30)
p_tr = clf.predict_proba(Xtr)[:,1]
p_ho = clf.predict_proba(Xho)[:,1]

# ---------------- score scaling (PDO=40) ----------------
PDO, BASE_SCORE, BASE_ODDS = 40.0, 600.0, 15.0   # 600 points at 15:1 good:bad
B = PDO / np.log(2)
def to_score(p):
    p = np.clip(p, 1e-6, 1-1e-6)
    odds_good = (1-p)/p
    return np.clip(BASE_SCORE + B*np.log(odds_good/BASE_ODDS), 300, 850)
hold["mrs"] = to_score(p_ho); hold["p"] = p_ho
train["mrs"] = to_score(p_tr)

# ---------------- metrics ----------------
auc = roc_auc_score(hold.event30, p_ho)
fpr, tpr, _ = roc_curve(hold.event30, p_ho)
ks = float(np.max(tpr - fpr))
gini = 2*auc - 1
h = hold.sort_values("p", ascending=False).reset_index(drop=True)
n = len(h); tot = h.event30.sum()
cap20 = h.loc[:int(n*0.2)-1, "event30"].sum()/tot
cap10 = h.loc[:int(n*0.1)-1, "event30"].sum()/tot
# gains curve
fr = np.arange(1, n+1)/n
gains = h.event30.cumsum().values/tot
# deciles by score (low score = risky)
h["decile"] = pd.qcut(h.mrs, 10, labels=False, duplicates="drop")
dec = h.groupby("decile").agg(mean_mrs=("mrs","mean"),
                              obs_rate=("event30","mean"),
                              pred_rate=("p","mean"),
                              count=("event30","size")).reset_index()
metrics = dict(dataset="NASA C-MAPSS FD001 (simulation benchmark)",
               machines_train=70, machines_holdout=30,
               rows_holdout=int(n), event="failure within next 30 cycles",
               auc=round(float(auc),4), gini=round(float(gini),4), ks=round(ks,4),
               top20_capture=round(float(cap20),4), top10_capture=round(float(cap10),4))
json.dump(metrics, open(f"{OUT}/metrics.json","w"), indent=2)
print(metrics)

# ---------------- brand chart style ----------------
BG, PANEL, LINE, INK, DIM = "#0A1428", "#111B33", "#24365A", "#EAF0FB", "#8FA3C4"
CYAN, AMBER, GOOD, VIOLET = "#38BDF8", "#F0A05A", "#34D399", "#8B7CF6"
def style(ax, title, sub=""):
    ax.set_facecolor(PANEL)
    ax.tick_params(colors=DIM); ax.xaxis.label.set_color(DIM); ax.yaxis.label.set_color(DIM)
    for s_ in ax.spines.values(): s_.set_color(LINE)
    ax.set_title(title, color=INK, fontsize=13, fontweight="bold", loc="left", pad=14)
    if sub: ax.text(0, 1.02, sub, transform=ax.transAxes, color=DIM, fontsize=8.5)
    ax.grid(color=LINE, linewidth=0.6, alpha=0.6)
def save(fig, name, caption):
    fig.text(0.01, 0.01, caption, color="#5B6E92", fontsize=7.5)
    fig.savefig(f"{OUT}/{name}", dpi=160, facecolor=BG, bbox_inches="tight"); plt.close(fig)
CAP = ("Data: NASA C-MAPSS FD001 physics-based degradation simulation benchmark - methodology validation, "
       "not market data. Model: logistic scorecard, out-of-machine holdout (units 71-100).")

# 1. gains / lift
fig, ax = plt.subplots(figsize=(7.2,5), facecolor=BG)
style(ax, f"Riskiest 20% of machine-cycles captured {cap20*100:.0f}% of upcoming failures",
      "Holdout machines never seen in training - ranked by MRS, observed over next 30 cycles")
ax.plot(fr*100, gains*100, color=CYAN, lw=2.5, label="ranked by MRS")
ax.plot([0,100],[0,100], color=DIM, lw=1.2, ls="--", label="random ranking")
ax.fill_between(fr*100, gains*100, fr*100, color=CYAN, alpha=0.08)
ax.axvline(20, color=AMBER, lw=1, ls=":"); ax.scatter([20],[cap20*100], color=AMBER, zorder=5)
ax.annotate(f"{cap20*100:.0f}%", (20, cap20*100), textcoords="offset points",
            xytext=(10,-4), color=AMBER, fontweight="bold")
ax.set_xlabel("% of fleet, riskiest first"); ax.set_ylabel("% of failures captured")
ax.legend(facecolor=PANEL, edgecolor=LINE, labelcolor=INK, loc="lower right")
save(fig, "lift_curve.png", CAP)

# 2. calibration by decile
fig, ax = plt.subplots(figsize=(7.2,5), facecolor=BG)
style(ax, "Predicted vs observed failure rate by MRS decile", "Perfect calibration = diagonal")
ax.plot(dec.pred_rate*100, dec.obs_rate*100, "o-", color=VIOLET, lw=2)
lim = max(dec.pred_rate.max(), dec.obs_rate.max())*110
ax.plot([0,lim],[0,lim], color=DIM, lw=1.2, ls="--")
ax.set_xlabel("predicted failure rate (%)"); ax.set_ylabel("observed failure rate (%)")
save(fig, "calibration.png", CAP)

# 3. score distributions
fig, ax = plt.subplots(figsize=(7.2,5), facecolor=BG)
style(ax, "MRS separates healthy cycles from pre-failure cycles",
      f"AUC {auc:.2f} - Gini {gini:.2f} - KS {ks:.2f} on out-of-machine holdout")
bins = np.linspace(300,850,45)
ax.hist(h[h.event30==0].mrs, bins=bins, color=GOOD, alpha=0.7, label="survived next 30 cycles", density=True)
ax.hist(h[h.event30==1].mrs, bins=bins, color="#F87171", alpha=0.7, label="failed within 30 cycles", density=True)
ax.set_xlabel("Machine Risk Score"); ax.set_ylabel("density")
ax.legend(facecolor=PANEL, edgecolor=LINE, labelcolor=INK)
save(fig, "score_distribution.png", CAP)

# 4. finance mapping
scores = np.linspace(350, 850, 200)
VAL = 85000
prem = VAL*(0.09 - (scores/1000)*0.075)/1  # $/yr illustrative
ltv  = 25 + (scores/1000)*55
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.5,4.4), facecolor=BG)
style(ax1, "Premium as a function of MRS", "illustrative pricing function, $85K asset")
ax1.plot(scores, prem, color=AMBER, lw=2.5); ax1.set_xlabel("MRS"); ax1.set_ylabel("$ / yr")
style(ax2, "Max LTV as a function of MRS", "illustrative collateral function")
ax2.plot(scores, ltv, color=CYAN, lw=2.5); ax2.set_xlabel("MRS"); ax2.set_ylabel("max LTV %")
save(fig, "finance_mapping.png", "Pricing functions are illustrative and uncalibrated to any live book.")

# ---------------- exports for the web demo ----------------
coef = pd.DataFrame({"feature": FEATS, "coef": clf.coef_[0]})
coef["abs"] = coef.coef.abs(); coef = coef.sort_values("abs", ascending=False).drop(columns="abs")
coef.to_csv(f"{OUT}/scorecard_coefficients.csv", index=False)
model_json = dict(
    kind="logistic_scorecard_v0",
    event="failure within next 30 operating cycles",
    features=FEATS, mean=mu.round(6).to_dict(), std=sd.round(6).to_dict(),
    coef=dict(zip(FEATS, np.round(clf.coef_[0],6))), intercept=round(float(clf.intercept_[0]),6),
    score_scaling=dict(PDO=PDO, base_score=BASE_SCORE, base_odds=BASE_ODDS, clip=[300,850]),
    holdout_metrics=metrics)
json.dump(model_json, open(f"{OUT}/mrs_model.json","w"), indent=2)
dec.round(4).to_csv(f"{OUT}/decile_table.csv", index=False)

# ---------------- report ----------------
top5 = coef.head(8).to_string(index=False)
open(f"{OUT}/REPORT.md","w").write(f"""# MRS v0 — backtest report (illustrative)

**What was tested.** Can a simple, auditable scorecard — the kind a consumer-credit
shop would build — rank machines by imminent failure risk using only operating
telemetry? Data: NASA C-MAPSS FD001, a physics-based run-to-failure degradation
simulation benchmark: 100 machines, {len(df):,} telemetry cycles. This validates
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

**Results (holdout, {n:,} machine-cycles on 30 unseen machines).**
- Riskiest 20% of machine-cycles captured **{cap20*100:.0f}%** of upcoming failures
  (riskiest 10%: {cap10*100:.0f}%).
- AUC **{auc:.2f}** · Gini **{gini:.2f}** · KS **{ks:.2f}**.
- Calibration by decile: see calibration.png.

**Top model drivers.**
```
{top5}
```

**From risk to finance (illustrative only).** MRS maps to premium, LTV and spread
via documented monotone functions (finance_mapping.png). These are placeholders
until calibrated against a real claims/loan book with a design partner.

**Honesty notes.** (1) C-MAPSS is simulated physics, not field data — it proves the
pipeline, not the market. (2) One asset type, one operating condition (FD001).
(3) Logistic v0 will underperform survival models on long-horizon risk; that's
fine — the point of v0 is that even the dumb model has underwriting power on
machine telemetry.
""")
print("done -> out/")
