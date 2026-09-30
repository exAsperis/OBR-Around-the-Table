import type { Metadata } from "@owlbear-rodeo/sdk";
import { PERSPECTIVE_METADATA_KEY, PROXY_METADATA_KEY, SCENE_METADATA_KEY, SOURCE_METADATA_KEY } from "./constants";
import type { AroundTheTableSceneState, PlayerPerspectiveState, PerspectiveAngle, ProxyMetadata, SourceMetadata } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
export const isPerspectiveAngle = (value: unknown): value is PerspectiveAngle => value === 0 || value === 90 || value === 180 || value === 270;

export function readSceneState(metadata: Metadata): AroundTheTableSceneState {
  const value = metadata[SCENE_METADATA_KEY];
  if (isRecord(value) && value.version === 1 && typeof value.enabled === "boolean" && isRecord(value.pivot) && typeof value.pivot.x === "number" && typeof value.pivot.y === "number") {
    return {
      version: 1,
      enabled: value.enabled,
      pivot: { x: value.pivot.x, y: value.pivot.y },
      effectRadius: typeof value.effectRadius === "number" && value.effectRadius > 0 ? value.effectRadius : null,
      rotateCharacters: typeof value.rotateCharacters === "boolean" ? value.rotateCharacters : true,
    };
  }
  return { version: 1, enabled: false, pivot: { x: 0, y: 0 }, effectRadius: null, rotateCharacters: true };
}

export function readPerspective(metadata: Metadata): PlayerPerspectiveState {
  const value = metadata[PERSPECTIVE_METADATA_KEY];
  return isRecord(value) && value.version === 1 && isPerspectiveAngle(value.angle) ? { version: 1, angle: value.angle } : { version: 1, angle: 0 };
}

export function readSourceMetadata(metadata: Metadata): SourceMetadata | undefined {
  const value = metadata[SOURCE_METADATA_KEY];
  return isRecord(value) && value.version === 1 && value.managed === true && typeof value.originalVisible === "boolean"
    ? { version: 1, managed: true, originalVisible: value.originalVisible } : undefined;
}

export function readProxyMetadata(metadata: Metadata): ProxyMetadata | undefined {
  const value = metadata[PROXY_METADATA_KEY];
  return isRecord(value) && value.version === 1 && typeof value.sourceId === "string" && (value.role === "MAP" || value.role === "CHARACTER")
    ? { version: 1, sourceId: value.sourceId, role: value.role } : undefined;
}
