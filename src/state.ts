import OBR from "@owlbear-rodeo/sdk";
import { PERSPECTIVE_METADATA_KEY, SCENE_METADATA_KEY, debug } from "./constants";
import { readPerspective, readSceneState } from "./metadata";
import type { AroundTheTableSceneState, PerspectiveAngle } from "./types";

export const sourceToProxy = new Map<string, string>();
export const proxyToSource = new Map<string, string>();

export async function getSceneState(): Promise<AroundTheTableSceneState> {
  return readSceneState(await OBR.scene.getMetadata());
}

export async function setSceneState(state: AroundTheTableSceneState): Promise<void> {
  await OBR.scene.setMetadata({ [SCENE_METADATA_KEY]: state });
}

export async function getPerspectiveAngle(): Promise<PerspectiveAngle> {
  return readPerspective(await OBR.player.getMetadata()).angle;
}

export async function setPerspectiveAngle(angle: PerspectiveAngle): Promise<void> {
  await OBR.player.setMetadata({ [PERSPECTIVE_METADATA_KEY]: { version: 1, angle } });
  debug(`Perspective changed: ${angle}°`);
}

export const clearIndexes = (): void => { sourceToProxy.clear(); proxyToSource.clear(); };
