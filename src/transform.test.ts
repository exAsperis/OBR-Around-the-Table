import { describe, expect, it } from "vitest";
import { canonicalDeltaToLocalDelta, canonicalToLocalPoint, canonicalToLocalRotation, localDeltaToCanonicalDelta, localToCanonicalPoint, localToCanonicalRotation, normalizeAngle } from "./transform";
import type { PerspectiveAngle } from "./types";

const angles: PerspectiveAngle[] = [0, 90, 180, 270];
const close = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
};

describe("perspective transform", () => {
  it.each([
    [0, { x: 100, y: 0 }], [90, { x: 0, y: 100 }],
    [180, { x: -100, y: 0 }], [270, { x: 0, y: -100 }],
  ] as const)("rotates about the origin by %s°", (angle, expected) => close(canonicalToLocalPoint({ x: 100, y: 0 }, { angle, pivot: { x: 0, y: 0 } }), expected));

  it.each([
    [0, { x: 600, y: 500 }], [90, { x: 500, y: 600 }],
    [180, { x: 400, y: 500 }], [270, { x: 500, y: 400 }],
  ] as const)("rotates about a nonzero pivot by %s°", (angle, expected) => close(canonicalToLocalPoint({ x: 600, y: 500 }, { angle, pivot: { x: 500, y: 500 } }), expected));

  it.each(angles)("round trips points at %s°", (angle) => {
    const perspective = { angle, pivot: { x: 321, y: -45 } };
    close(localToCanonicalPoint(canonicalToLocalPoint({ x: 12.5, y: 904 }, perspective), perspective), { x: 12.5, y: 904 });
  });

  it("normalizes rotations", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(810)).toBe(90);
    expect(canonicalToLocalRotation(350, { angle: 90, pivot: { x: 0, y: 0 } })).toBe(80);
    expect(localToCanonicalRotation(10, { angle: 90, pivot: { x: 0, y: 0 } })).toBe(280);
  });

  it.each([
    [0, { x: 100, y: 20 }], [90, { x: 20, y: -100 }],
    [180, { x: -100, y: -20 }], [270, { x: -20, y: 100 }],
  ] as const)("maps local delta to explicit canonical delta at %s°", (angle, expected) => close(localDeltaToCanonicalDelta({ x: 100, y: 20 }, angle), expected));

  it("maps canonical deltas forward explicitly", () => close(canonicalDeltaToLocalDelta({ x: 100, y: 0 }, 90), { x: 0, y: 100 }));
});
