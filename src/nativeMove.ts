import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { reportError } from "./constants";
import { readProxyMetadata } from "./metadata";
import { getExpectedProxyPosition, isExpectedProxyPosition, reconcileProjection, setExpectedProxyPosition, setProjectionDragSuppressed } from "./projection";
import { getPerspectiveAngle, getSceneState } from "./state";
import { canonicalToLocalPoint, localToCanonicalPoint } from "./transform";
import type { Perspective } from "./types";

type PendingMove = {
  sourceId: string;
  proxyId: string;
  baselineLocalPosition: { x: number; y: number };
  canonicalPosition: { x: number; y: number };
  write?: Promise<void>;
  settleTimer?: number;
  settling?: boolean;
  failed: boolean;
};
let perspective: Perspective | undefined;
const pendingMoves = new Map<string, PendingMove>();
let lastFailureNotificationAt = -Infinity;
const FAILURE_NOTIFICATION_COOLDOWN_MS = 10_000;
const positionsMatch = (a: { x: number; y: number }, b: { x: number; y: number }): boolean =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;

export async function refreshNativeMoveContext(): Promise<void> {
  const [scene, angle] = await Promise.all([getSceneState(), getPerspectiveAngle()]);
  perspective = scene.enabled ? { pivot: scene.pivot, angle } : undefined;
}

function writeCanonical(move: PendingMove): Promise<void> {
  if (move.write) return move.write;
  const position = move.canonicalPosition;
  const task = OBR.scene.items.updateItems([move.sourceId], (drafts) => {
    const source = drafts[0];
    if (source) source.position = position;
  });
  move.write = task;
  const clear = () => { if (move.write === task) move.write = undefined; };
  void task.then(clear, clear);
  return task;
}

function reportMoveFailure(move: PendingMove, cause: unknown): void {
  if (move.failed) return;
  move.failed = true;
  reportError("Native proxy movement could not update its canonical source", cause);
  if (performance.now() - lastFailureNotificationAt >= FAILURE_NOTIFICATION_COOLDOWN_MS) {
    lastFailureNotificationAt = performance.now();
    void OBR.notification.show("Around the Table could not synchronize that token movement.", "ERROR");
  }
}

function scheduleSettle(move: PendingMove): void {
  if (move.settleTimer !== undefined) window.clearTimeout(move.settleTimer);
  move.settleTimer = window.setTimeout(() => { move.settleTimer = undefined; void settleMove(move); }, 400);
}

async function settleMove(move: PendingMove): Promise<void> {
  if (move.settling) return;
  move.settling = true;
  if (move.settleTimer !== undefined) { window.clearTimeout(move.settleTimer); move.settleTimer = undefined; }
  try {
    await writeCanonical(move);
    const currentPerspective = perspective;
    if (currentPerspective) {
      const intendedLocalPosition = canonicalToLocalPoint(move.canonicalPosition, currentPerspective);
      setExpectedProxyPosition(move.proxyId, intendedLocalPosition);
      await OBR.scene.local.updateItems([move.proxyId], (drafts) => {
        if (drafts[0]) drafts[0].position = intendedLocalPosition;
      }, true);
    }
  } catch (cause) {
    reportMoveFailure(move, cause);
  } finally {
    setProjectionDragSuppressed(move.sourceId, false);
    pendingMoves.delete(move.sourceId);
    await reconcileProjection();
  }
}

export function handleLocalItemsChanged(items: Item[]): void {
  const currentPerspective = perspective;
  if (!currentPerspective) return;
  for (const item of items) {
    const proxy = readProxyMetadata(item.metadata);
    if (!proxy || proxy.role !== "CHARACTER" || isExpectedProxyPosition(item.id, item.position)) continue;
    const previousExpected = getExpectedProxyPosition(item.id);
    let move = pendingMoves.get(proxy.sourceId);
    if (move && positionsMatch(item.position, move.baselineLocalPosition)) {
      // Owlbear has finished its transient local preview and restored the stored
      // position. Do not fight that rollback. Use it as the drag-end signal,
      // commit canonical intent, then update the proxy once after the commit.
      setExpectedProxyPosition(item.id, item.position);
      void settleMove(move);
      continue;
    }
    setExpectedProxyPosition(item.id, item.position);
    if (!move) {
      move = {
        sourceId: proxy.sourceId,
        proxyId: item.id,
        baselineLocalPosition: previousExpected ?? item.position,
        canonicalPosition: localToCanonicalPoint(item.position, currentPerspective),
        failed: false,
      };
      pendingMoves.set(proxy.sourceId, move);
    }
    move.canonicalPosition = localToCanonicalPoint(item.position, currentPerspective);
    setProjectionDragSuppressed(proxy.sourceId, true);
    // Do not mutate canonical state for every native preview snapshot. Owlbear
    // rolls local-only previews back, and intermediate canonical echoes cause the
    // proxy to oscillate. The settle timer commits only the final intent.
    scheduleSettle(move);
  }
}

export function clearNativeMoveState(): void {
  for (const move of pendingMoves.values()) {
    if (move.settleTimer !== undefined) window.clearTimeout(move.settleTimer);
    setProjectionDragSuppressed(move.sourceId, false);
  }
  pendingMoves.clear();
  perspective = undefined;
}
