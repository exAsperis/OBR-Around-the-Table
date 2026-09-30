import { describe, expect, it } from "vitest";
import { isCenterWithinRadius, projectedImageRotation } from "./projectionMath";

describe("projection policy", () => {
  it("includes all centers when the radius is unlimited", () => {
    expect(isCenterWithinRadius({ x: 10_000, y: -10_000 }, { x: 0, y: 0 }, null)).toBe(true);
  });

  it("includes the radius boundary and excludes centers beyond it", () => {
    expect(isCenterWithinRadius({ x: 3, y: 4 }, { x: 0, y: 0 }, 5)).toBe(true);
    expect(isCenterWithinRadius({ x: 3.01, y: 4 }, { x: 0, y: 0 }, 5)).toBe(false);
  });

  it("keeps character artwork upright when character rotation is disabled", () => {
    expect(projectedImageRotation({ layer: "CHARACTER", rotation: 15 }, { angle: 90, pivot: { x: 0, y: 0 } }, false)).toBe(15);
  });

  it("still rotates maps and enabled character artwork", () => {
    expect(projectedImageRotation({ layer: "MAP", rotation: 15 }, { angle: 90, pivot: { x: 0, y: 0 } }, false)).toBe(105);
    expect(projectedImageRotation({ layer: "CHARACTER", rotation: 15 }, { angle: 90, pivot: { x: 0, y: 0 } }, true)).toBe(105);
  });
});
