import OBR, { buildImage, isImage, type Image } from "@owlbear-rodeo/sdk";
import { reconcileManagedCanonicalItems } from "./canonical";
import { PROXY_METADATA_KEY, debug, reportError } from "./constants";
import { readProxyMetadata, readSourceMetadata } from "./metadata";
import { clearIndexes, getPerspectiveAngle, getSceneState, proxyToSource, sourceToProxy } from "./state";
import { canonicalToLocalPoint } from "./transform";
import type { Perspective, ProxyMetadata } from "./types";
import { projectedImageRotation } from "./projectionMath";

let reconcileTail: Promise<void> = Promise.resolve();
const locallyDraggedSources = new Set<string>();
const expectedProxyPositions = new Map<string, { x: number; y: number }>();

export const setProjectionDragSuppressed = (sourceId: string, suppressed: boolean): void => {
  if (suppressed) locallyDraggedSources.add(sourceId);
  else locallyDraggedSources.delete(sourceId);
};

export const setExpectedProxyPosition = (proxyId: string, position: { x: number; y: number }): void => {
  expectedProxyPositions.set(proxyId, position);
};

export const getExpectedProxyPosition = (proxyId: string): { x: number; y: number } | undefined => expectedProxyPositions.get(proxyId);

export const isExpectedProxyPosition = (proxyId: string, position: { x: number; y: number }): boolean => {
  const expected = expectedProxyPositions.get(proxyId);
  return expected !== undefined && Math.abs(expected.x - position.x) < 0.01 && Math.abs(expected.y - position.y) < 0.01;
};

const managedImage = (item: unknown): item is Image => isImage(item as Parameters<typeof isImage>[0]) && readSourceMetadata((item as Image).metadata) !== undefined;

function buildProxy(source: Image, perspective: Perspective, rotateCharacters: boolean): Image {
  const role = source.layer === "MAP" ? "MAP" : "CHARACTER";
  const proxyMetadata: ProxyMetadata = { version: 1, sourceId: source.id, role };
  return buildImage(source.image, source.grid)
    .name(source.name)
    .description(source.description ?? "")
    .position(canonicalToLocalPoint(source.position, perspective))
    .rotation(projectedImageRotation(source, perspective, rotateCharacters))
    .scale(source.scale)
    .layer(source.layer)
    .zIndex(source.zIndex)
    .visible(true)
    .locked(role === "MAP")
    .disableHit(role === "MAP")
    .disableAutoZIndex(source.disableAutoZIndex ?? false)
    .text(source.text)
    .textItemType(source.textItemType)
    .metadata({ [PROXY_METADATA_KEY]: proxyMetadata })
    .build();
}

async function deleteAllProxies(): Promise<void> {
  const local = await OBR.scene.local.getItems((item) => readProxyMetadata(item.metadata) !== undefined);
  if (local.length > 0) await OBR.scene.local.deleteItems(local.map((item) => item.id));
  expectedProxyPositions.clear();
  clearIndexes();
}

async function reconcileNow(): Promise<void> {
  if (!(await OBR.scene.isReady())) { clearIndexes(); return; }
  const scene = await getSceneState();
  if (!scene.enabled) { await deleteAllProxies(); return; }
  await reconcileManagedCanonicalItems(scene);
  const angle = await getPerspectiveAngle();
  const perspective: Perspective = { angle, pivot: scene.pivot };
  const [sources, localItems] = await Promise.all([
    OBR.scene.items.getItems((item): item is Image => managedImage(item)),
    OBR.scene.local.getItems((item) => readProxyMetadata(item.metadata) !== undefined),
  ]);
  clearIndexes();
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const duplicateIds: string[] = [];
  for (const local of localItems) {
    const proxy = readProxyMetadata(local.metadata);
    if (!proxy || !sourceById.has(proxy.sourceId) || sourceToProxy.has(proxy.sourceId)) { duplicateIds.push(local.id); continue; }
    sourceToProxy.set(proxy.sourceId, local.id);
    proxyToSource.set(local.id, proxy.sourceId);
  }
  if (duplicateIds.length > 0) await OBR.scene.local.deleteItems(duplicateIds);
  const missing = sources.filter((source) => !sourceToProxy.has(source.id));
  if (missing.length > 0) {
    const proxies = missing.map((source) => buildProxy(source, perspective, scene.rotateCharacters));
    // local.onChange may fire before addItems resolves. Seed expected positions
    // first so proxy creation is never mistaken for native user movement.
    proxies.forEach((proxy) => setExpectedProxyPosition(proxy.id, proxy.position));
    await OBR.scene.local.addItems(proxies);
    proxies.forEach((proxy, index) => { const source = missing[index]; sourceToProxy.set(source.id, proxy.id); proxyToSource.set(proxy.id, source.id); debug(`Created proxy ${proxy.id} for source ${source.id}`); });
  }
  const updates = sources.flatMap((source) => {
    // Canonical item change events can arrive behind the pointer while this client
    // is dragging. Immediate local feedback owns this one proxy until drag end.
    if (locallyDraggedSources.has(source.id)) return [];
    const proxyId = sourceToProxy.get(source.id);
    return proxyId ? [{ source, proxyId }] : [];
  });
  if (updates.length > 0) {
    const updatesById = new Map(updates.map((value) => [value.proxyId, value.source]));
    for (const { source, proxyId } of updates) setExpectedProxyPosition(proxyId, canonicalToLocalPoint(source.position, perspective));
    await OBR.scene.local.updateItems(updates.map(({ proxyId }) => proxyId), (drafts) => {
      for (const proxy of drafts) {
        const source = updatesById.get(proxy.id);
        if (!source || proxy.type !== "IMAGE") continue;
        proxy.position = canonicalToLocalPoint(source.position, perspective);
        proxy.rotation = projectedImageRotation(source, perspective, scene.rotateCharacters);
        proxy.scale = source.scale;
        proxy.layer = source.layer;
        proxy.zIndex = source.zIndex;
        proxy.name = source.name;
        proxy.locked = source.layer === "MAP";
        proxy.disableHit = source.layer === "MAP";
      }
    });
  }
}

export function reconcileProjection(): Promise<void> {
  const next = reconcileTail.then(reconcileNow, reconcileNow);
  reconcileTail = next.catch((cause) => reportError("Projection reconciliation failed", cause));
  return next;
}

export async function clearProjectionForSceneChange(): Promise<void> {
  try { await deleteAllProxies(); } catch (cause) { reportError("Unable to clear local proxies", cause); }
}
