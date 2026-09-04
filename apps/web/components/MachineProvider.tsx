"use client";
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { assess, initialState, reduce, type Action, type Assessment, type MachineState } from "@/lib/sim/machine";

interface Ctx {
  state: MachineState;
  dispatch: Dispatch<Action>;
  a: Assessment;
}

const MachineCtx = createContext<Ctx | null>(null);
const KEY = "calibrum-demo-state-v1";

function load(): MachineState {
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
    if (raw) {
      const s = JSON.parse(raw) as MachineState;
      if (s && Array.isArray(s.ledger) && s.ledger.length > 0 && typeof s.wallet === "number") return s;
    }
  } catch {
    /* fall through to a fresh passport */
  }
  return initialState();
}

export function MachineProvider({ children }: { children: ReactNode }) {
  // Initial render uses the deterministic fresh state (matches the server), then a stored session is restored.
  const [state, dispatch] = useReducer(reduce, undefined, () => initialState());
  useEffect(() => {
    const stored = load();
    if (stored.step !== 0) dispatch({ type: "hydrate", state: stored });
  }, []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: the demo still works, it just won't survive a refresh */
    }
  }, [state]);
  const a = useMemo(() => assess(state), [state]);
  return <MachineCtx.Provider value={{ state, dispatch, a }}>{children}</MachineCtx.Provider>;
}

export function useMachine(): Ctx {
  const c = useContext(MachineCtx);
  if (!c) throw new Error("useMachine outside MachineProvider");
  return c;
}
