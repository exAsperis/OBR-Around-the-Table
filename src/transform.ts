import type { Vector2 } from "@owlbear-rodeo/sdk";
import type { Perspective } from "./types";

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function rotate(vector: Vector2, angle: number): Vector2 {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

export function canonicalToLocalPoint(point: Vector2, perspective: Perspective): Vector2 {
  const translated = { x: point.x - perspective.pivot.x, y: point.y - perspective.pivot.y };
  const rotated = rotate(translated, perspective.angle);
  return { x: rotated.x + perspective.pivot.x, y: rotated.y + perspective.pivot.y };
}

export function localToCanonicalPoint(point: Vector2, perspective: Perspective): Vector2 {
  const translated = { x: point.x - perspective.pivot.x, y: point.y - perspective.pivot.y };
  const rotated = rotate(translated, -perspective.angle);
  return { x: rotated.x + perspective.pivot.x, y: rotated.y + perspective.pivot.y };
}

export const canonicalToLocalRotation = (rotation: number, perspective: Perspective): number =>
  normalizeAngle(rotation + perspective.angle);

export const localToCanonicalRotation = (rotation: number, perspective: Perspective): number =>
  normalizeAngle(rotation - perspective.angle);

export const localDeltaToCanonicalDelta = (delta: Vector2, angle: number): Vector2 => rotate(delta, -angle);
export const canonicalDeltaToLocalDelta = (delta: Vector2, angle: number): Vector2 => rotate(delta, angle);
