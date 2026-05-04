/**
 * state.ts — minimal state-file helpers for /zama-autonomous.
 *
 * Persists pipeline progress so a long-running session can resume after
 * interruption. The file is the single source of truth for "where am I?"
 * — Claude reads it on entry and writes after every completed step.
 *
 * Hard rule: never write secrets here. Only:
 *   - useCase (slug)
 *   - completedSteps[]
 *   - currentStep
 *   - timestamps
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type PipelineStep =
  | "doctor"
  | "design"
  | "init"
  | "contract"
  | "test"
  | "audit"
  | "deploy"
  | "frontend"
  | "done";

export const PIPELINE_ORDER: PipelineStep[] = [
  "doctor",
  "design",
  "init",
  "contract",
  "test",
  "audit",
  "deploy",
  "frontend",
  "done",
];

export interface AutonomousState {
  useCase: string | null;
  completedSteps: PipelineStep[];
  currentStep: PipelineStep;
  startedAt: string;
  updatedAt: string;
}

export const DEFAULT_STATE_PATH = ".planning/v1-autonomous/state.json";

export function loadState(path = DEFAULT_STATE_PATH): AutonomousState | null {
  const abs = resolve(path);
  if (!existsSync(abs)) return null;
  try {
    const raw = readFileSync(abs, "utf8");
    const parsed = JSON.parse(raw) as AutonomousState;
    if (!parsed.currentStep || !PIPELINE_ORDER.includes(parsed.currentStep)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(
  state: AutonomousState,
  path = DEFAULT_STATE_PATH,
): void {
  const abs = resolve(path);
  mkdirSync(dirname(abs), { recursive: true });
  const updated: AutonomousState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(abs, JSON.stringify(updated, null, 2) + "\n", { mode: 0o600 });
}

export function clearState(path = DEFAULT_STATE_PATH): void {
  const abs = resolve(path);
  if (existsSync(abs)) unlinkSync(abs);
}

export function newState(useCase: string | null = null): AutonomousState {
  const now = new Date().toISOString();
  return {
    useCase,
    completedSteps: [],
    currentStep: "doctor",
    startedAt: now,
    updatedAt: now,
  };
}

export function advance(
  state: AutonomousState,
  completed: PipelineStep,
): AutonomousState {
  const idx = PIPELINE_ORDER.indexOf(completed);
  if (idx < 0) {
    throw new Error(`advance: unknown step "${completed}"`);
  }
  const next = PIPELINE_ORDER[idx + 1] ?? "done";
  const completedSteps = state.completedSteps.includes(completed)
    ? state.completedSteps
    : [...state.completedSteps, completed];
  return { ...state, completedSteps, currentStep: next };
}
