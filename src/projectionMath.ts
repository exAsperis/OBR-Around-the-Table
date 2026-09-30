import type { Image, Vector2 } from "@owlbear-rodeo/sdk";
import { canonicalToLocalRotation } from "./transform";
import type { Perspective } from "./types";

export function isCenterWithinRadius(center: Vector2, pivot: Vector2, radius: number | null): boolean {
  return radius === null || Math.hypot(center.x - pivot.x, center.y - pivot.y) <= radius;
}

export function projectedImageRotation(
  source: Pick<Image, "layer" | "rotation">,
  perspective: Perspective,
  rotateCharacters: boolean,
): number {
  return source.layer === "CHARACTER" && !rotateCharacters
    ? source.rotation
    : canonicalToLocalRotation(source.rotation, perspective);
}
