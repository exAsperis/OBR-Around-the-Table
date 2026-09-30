import OBR from "@owlbear-rodeo/sdk";
import { reportError } from "./constants";
import { clearProjectionForSceneChange, reconcileProjection } from "./projection";
import { clearNativeMoveState, handleLocalItemsChanged, refreshNativeMoveContext } from "./nativeMove";

let disposeRuntime: (() => Promise<void>) | undefined;
let listeners: Array<() => void> = [];

const scheduleReconcile = (() => {
  let timer: number | undefined;
  return () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => { timer = undefined; void reconcileProjection().catch((cause) => reportError("Scheduled reconciliation failed", cause)); }, 100);
  };
})();

export async function startRuntime(): Promise<() => Promise<void>> {
  if (disposeRuntime) return disposeRuntime;
  const refreshMovementContexts = async (): Promise<void> => {
    if (!(await OBR.scene.isReady())) return;
    await refreshNativeMoveContext();
  };
  const safelyRefreshMovementContexts = (): void => {
    void refreshMovementContexts().catch((cause) => reportError("Unable to refresh movement context", cause));
  };
  listeners = [
    OBR.scene.onMetadataChange(() => { safelyRefreshMovementContexts(); scheduleReconcile(); }),
    OBR.scene.items.onChange(scheduleReconcile),
    OBR.scene.local.onChange(handleLocalItemsChanged),
    OBR.player.onChange(() => { safelyRefreshMovementContexts(); scheduleReconcile(); }),
    OBR.scene.onReadyChange((ready) => {
      void (async () => {
        clearNativeMoveState();
        await clearProjectionForSceneChange();
        if (ready) { await refreshMovementContexts(); await reconcileProjection(); }
      })().catch((cause) => reportError("Scene transition failed", cause));
    }),
  ];
  if (await OBR.scene.isReady()) {
    await refreshMovementContexts();
    await reconcileProjection();
  }
  disposeRuntime = async () => {
    listeners.forEach((unsubscribe) => unsubscribe()); listeners = [];
    clearNativeMoveState();
    await clearProjectionForSceneChange();
    disposeRuntime = undefined;
  };
  return disposeRuntime;
}
