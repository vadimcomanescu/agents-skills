import { describe, expect, it } from "vitest";
import { canMutate, type WorkflowMode } from "./workflow-mode";

describe("workflow mode mutation boundary", () => {
  it("should allow protected mutations only in operator mode", () => {
    const modes: WorkflowMode[] = ["operator", "reviewer"];

    expect(modes.map((mode) => [mode, canMutate(mode)])).toEqual([
      ["operator", true],
      ["reviewer", false]
    ]);
  });
});
