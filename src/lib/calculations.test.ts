import { describe, it, expect } from "vitest";
import { withDefaultPercentComplete } from "./calculations";

describe("withDefaultPercentComplete", () => {
  it("computes achieved/target without clamping above 1", () => {
    const result = withDefaultPercentComplete({
      targetQty: 80,
      achievedQty: 85,
      percentComplete: null,
    });
    expect(result.percentComplete).toBeCloseTo(1.0625);
  });

  it("keeps a manual value", () => {
    const result = withDefaultPercentComplete({
      targetQty: 100,
      achievedQty: 50,
      percentComplete: 0.9,
    });
    expect(result.percentComplete).toBe(0.9);
  });

  it("leaves null when target is 0", () => {
    const result = withDefaultPercentComplete({
      targetQty: 0,
      achievedQty: 10,
      percentComplete: null,
    });
    expect(result.percentComplete).toBeNull();
  });
});
