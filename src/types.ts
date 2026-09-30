import type { Vector2 } from "@owlbear-rodeo/sdk";

export type PerspectiveAngle = 0 | 90 | 180 | 270;
export type Perspective = { angle: PerspectiveAngle; pivot: Vector2 };
export type AroundTheTableSceneState = {
  version: 1;
  enabled: boolean;
  pivot: Vector2;
  effectRadius: number | null;
  rotateCharacters: boolean;
};
export type PlayerPerspectiveState = { version: 1; angle: PerspectiveAngle };
export type SourceMetadata = { version: 1; managed: true; originalVisible: boolean };
export type ProxyRole = "MAP" | "CHARACTER";
export type ProxyMetadata = { version: 1; sourceId: string; role: ProxyRole };
