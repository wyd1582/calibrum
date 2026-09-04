/** The binding model contract (handoff Part 4). Every scoring surface consumes this — never ad-hoc math. */
export interface ModelContract {
  kind: "logistic_scorecard_v0";
  event: string;
  features: string[];
  mean: Record<string, number>;
  std: Record<string, number>;
  coef: Record<string, number>;
  intercept: number;
  score_scaling: { PDO: number; base_score: number; base_odds: number; clip: [number, number] | number[] };
  holdout_metrics: {
    dataset: string;
    machines_train: number;
    machines_holdout: number;
    rows_holdout: number;
    event: string;
    auc: number;
    gini: number;
    ks: number;
    top20_capture: number;
    top10_capture: number;
    ablations?: Record<string, { auc: number; cap20: number; n_features?: number }>;
    events_holdout?: number;
  };
  provenance?: {
    cohort: string;
    dataset: string;
    source: string;
    asset_class: string;
    data_kind: string;
    label: string;
    machines: number;
    rows: number;
    sample?: boolean;
  };
}

/** Empirical degradation trajectory exported by the engine (docs/slider-mapping.md). */
export interface Trajectory {
  bins: number;
  tau: number[];
  horizon: number;
  unit_col: string;
  note: string;
  points: Record<string, number>[];
  feature_std: Record<string, number>;
}

export type FeatureVector = Record<string, number>;

export interface Contribution {
  feature: string;
  x: number;
  z: number;
  contribution: number;
}

export interface ScoreResult {
  logit: number;
  /** probability of the contract's event (e.g. failure within next 30 cycles) */
  p: number;
  mrs: number;
  contributions: Contribution[];
}
