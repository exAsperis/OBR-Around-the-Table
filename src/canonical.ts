import OBR, { isImage, type Image } from "@owlbear-rodeo/sdk";
import { SOURCE_METADATA_KEY, debug } from "./constants";
import { readSourceMetadata } from "./metadata";
import { getSceneState, setSceneState } from "./state";
import type { AroundTheTableSceneState } from "./types";
import { isCenterWithinRadius } from "./projectionMath";

let lastParticipationSignature = "";

const participationSignature = (items: Image[], state: AroundTheTableSceneState): string => {
  const itemState = items
    .map((item) => `${item.id}:${item.layer}:${item.visible ? 1 : 0}:${readSourceMetadata(item.metadata) ? 1 : 0}`)
    .sort()
    .join("|");
  return `${state.pivot.x},${state.pivot.y}:${state.effectRadius ?? "all"}:${itemState}`;
};

const isEligibleVisible = (item: Image): boolean => item.visible && (item.layer === "MAP" || item.layer === "CHARACTER");

export async function enableAroundTheTable(): Promise<void> {
  const previous = await getSceneState();
  const items = await OBR.scene.items.getItems((item): item is Image => isImage(item));
  const eligible = items.filter(isEligibleVisible);
  const maps = eligible.filter((item) => item.layer === "MAP");
  let pivot = { x: 0, y: 0 };
  if (maps.length > 0) {
    const bounds = await OBR.scene.items.getItemBounds(maps.map((item) => item.id));
    pivot = { x: bounds.min.x + bounds.width / 2, y: bounds.min.y + bounds.height / 2 };
  } else {
    await OBR.notification.show("No visible MAP image was found. Rotation center defaults to (0, 0).", "WARNING");
  }
  if (eligible.length > 0) {
    await OBR.scene.items.updateItems(eligible, (drafts) => {
      for (const item of drafts) {
        item.metadata[SOURCE_METADATA_KEY] = { version: 1, managed: true, originalVisible: item.visible };
        item.visible = false;
      }
    });
  }
  await setSceneState({ ...previous, version: 1, enabled: true, pivot });
  debug("Enabled scene");
  debug(`Pivot: ${pivot.x}, ${pivot.y}`);
}

export async function disableAroundTheTable(): Promise<void> {
  const previous = await getSceneState();
  const managed = await OBR.scene.items.getItems((item) => readSourceMetadata(item.metadata) !== undefined);
  if (managed.length > 0) {
    await OBR.scene.items.updateItems(managed, (drafts) => {
      for (const item of drafts) {
        const source = readSourceMetadata(item.metadata);
        if (!source) continue;
        item.visible = source.originalVisible;
        delete item.metadata[SOURCE_METADATA_KEY];
      }
    });
  }
  await setSceneState({ ...previous, version: 1, enabled: false });
  debug("Disabled scene");
}

/**
 * Keep canonical participation aligned with the current radius. This is run by
 * the GM during reconciliation so newly added images are adopted without a
 * disable/enable cycle and out-of-radius items are restored safely.
 */
export async function reconcileManagedCanonicalItems(state: AroundTheTableSceneState): Promise<void> {
  if (!state.enabled || await OBR.player.getRole() !== "GM") return;
  const items = await OBR.scene.items.getItems((item): item is Image =>
    isImage(item) && (item.layer === "MAP" || item.layer === "CHARACTER"),
  );
  const signature = participationSignature(items, state);
  if (signature === lastParticipationSignature) return;
  lastParticipationSignature = signature;
  const dpi = await OBR.scene.grid.getDpi();
  const radiusInScenePixels = state.effectRadius === null ? null : state.effectRadius * dpi;
  const decisions = await Promise.all(items.map(async (item) => {
    const bounds = await OBR.scene.items.getItemBounds([item.id]);
    return { item, inside: isCenterWithinRadius(bounds.center, state.pivot, radiusInScenePixels), managed: readSourceMetadata(item.metadata) };
  }));
  const changes = decisions.filter(({ item, inside, managed }) =>
    (inside && item.visible && !managed) || (!inside && managed !== undefined),
  );
  if (changes.length === 0) return;
  const changeById = new Map(changes.map((change) => [change.item.id, change]));
  await OBR.scene.items.updateItems(changes.map(({ item }) => item.id), (drafts) => {
    for (const item of drafts) {
      const change = changeById.get(item.id);
      if (!change) continue;
      if (change.inside) {
        item.metadata[SOURCE_METADATA_KEY] = { version: 1, managed: true, originalVisible: item.visible };
        item.visible = false;
      } else if (change.managed) {
        item.visible = change.managed.originalVisible;
        delete item.metadata[SOURCE_METADATA_KEY];
      }
    }
  });
}
