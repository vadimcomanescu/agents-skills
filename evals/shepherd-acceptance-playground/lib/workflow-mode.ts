export type WorkflowMode = "operator" | "reviewer";

export function canMutate(mode: WorkflowMode) {
  return mode === "operator";
}
