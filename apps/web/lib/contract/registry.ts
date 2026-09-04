import type { ModelContract, Trajectory } from "./types";
import { scoreVector } from "./score";
import { trajectoryWindow, type TrajectoryWindow } from "./sliders";
import v0 from "../../../../engine/mrs_v0/out/mrs_model.json";
import trajV0 from "../../../../engine/cohorts/out/cmapss_fd001/trajectory.json";
import fd002 from "../../../../engine/cohorts/out/cmapss_fd002/mrs_model.json";
import trajFd002 from "../../../../engine/cohorts/out/cmapss_fd002/trajectory.json";
import fd004 from "../../../../engine/cohorts/out/cmapss_fd004/mrs_model.json";
import trajFd004 from "../../../../engine/cohorts/out/cmapss_fd004/trajectory.json";

export interface RegisteredModel {
  id: string;
  /** Dropdown label — always carries dataset provenance. */
  label: string;
  provenanceNote: string;
  model: ModelContract;
  trajectory: Trajectory;
  /** Part of the trajectory where this contract's score moves (computed, see sliders.ts). */
  window: TrajectoryWindow;
}

/**
 * Every model the app can switch to. All are read straight from engine/ output —
 * the JSON the Python pipeline wrote — so the demo can never drift from the model.
 */
const RAW: Omit<RegisteredModel, "window">[] = [
  {
    id: "mrs_v0",
    label: "MRS v0 · NASA C-MAPSS FD001 · 100 simulated turbofans (baseline)",
    provenanceNote: "Physics-based degradation simulation benchmark. Validates the method, not the market.",
    model: v0 as ModelContract,
    trajectory: trajV0 as Trajectory,
  },
  {
    id: "cmapss_fd002",
    label: "C-MAPSS FD002 · 260 simulated turbofans · 6 operating conditions",
    provenanceNote: "Harder multi-condition cohort, same 43 features, no regime normalisation.",
    model: fd002 as ModelContract,
    trajectory: trajFd002 as Trajectory,
  },
  {
    id: "cmapss_fd004",
    label: "C-MAPSS FD004 · 249 simulated turbofans · 6 conditions, 2 fault modes",
    provenanceNote: "Hardest C-MAPSS cohort, same method.",
    model: fd004 as ModelContract,
    trajectory: trajFd004 as Trajectory,
  },
];

export const MODELS: RegisteredModel[] = RAW.map((m) => ({ ...m, window: trajectoryWindow(m.trajectory, (x) => scoreVector(m.model, x).mrs) }));

export const DEFAULT_MODEL_ID = "mrs_v0";

export function getModel(id: string): RegisteredModel {
  return MODELS.find((m) => m.id === id) ?? (MODELS[0] as RegisteredModel);
}
