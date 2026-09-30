import OBR from "@owlbear-rodeo/sdk";
import { useCallback, useEffect, useState } from "react";
import { disableAroundTheTable, enableAroundTheTable } from "../canonical";
import { reportError } from "../constants";
import { readProxyMetadata } from "../metadata";
import { getPerspectiveAngle, getSceneState, setPerspectiveAngle, setSceneState } from "../state";
import type { AroundTheTableSceneState, PerspectiveAngle } from "../types";

export default function App() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<"GM" | "PLAYER">("PLAYER");
  const [scene, setScene] = useState<AroundTheTableSceneState>({ version: 1, enabled: false, pivot: { x: 0, y: 0 }, effectRadius: null, rotateCharacters: true });
  const [angle, setAngle] = useState<PerspectiveAngle>(0);
  const [radiusInput, setRadiusInput] = useState("");
  const [pivotXInput, setPivotXInput] = useState("0");
  const [pivotYInput, setPivotYInput] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!(await OBR.scene.isReady())) { setReady(true); setScene({ version: 1, enabled: false, pivot: { x: 0, y: 0 }, effectRadius: null, rotateCharacters: true }); return; }
    const [nextRole, nextScene, nextAngle] = await Promise.all([OBR.player.getRole(), getSceneState(), getPerspectiveAngle()]);
    setRole(nextRole); setScene(nextScene); setRadiusInput(nextScene.effectRadius?.toString() ?? "");
    setPivotXInput(nextScene.pivot.x.toString()); setPivotYInput(nextScene.pivot.y.toString());
    setAngle(nextAngle); setReady(true); setError(undefined);
  }, []);

  useEffect(() => {
    let active = true;
    let cleanups: Array<() => void> = [];
    OBR.onReady(() => {
      if (!active) return;
      void refresh().catch((cause) => { reportError("Unable to initialize UI", cause); setError("Unable to read Owlbear Rodeo state."); setReady(true); });
      cleanups = [OBR.scene.onReadyChange(() => void refresh()), OBR.scene.onMetadataChange(() => void refresh()), OBR.player.onChange(() => void refresh())];
    });
    return () => { active = false; cleanups.forEach((cleanup) => cleanup()); };
  }, [refresh]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(undefined);
    try { await operation(); await refresh(); }
    catch (cause) { reportError("UI operation failed", cause); setError(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { setBusy(false); }
  };

  const applyPivot = async () => {
    const x = Number(pivotXInput);
    const y = Number(pivotYInput);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Rotation center coordinates must be valid numbers.");
    await setSceneState({ ...scene, pivot: { x, y } });
  };

  const useSelectionCenter = async () => {
    const selection = await OBR.player.getSelection();
    if (!selection || selection.length === 0) throw new Error("Select one or more scene items first.");
    const localItems = await OBR.scene.local.getItems(selection);
    const sourceByProxy = new Map(localItems.flatMap((item) => {
      const proxy = readProxyMetadata(item.metadata);
      return proxy ? [[item.id, proxy.sourceId] as const] : [];
    }));
    const canonicalIds = selection.map((id) => sourceByProxy.get(id) ?? id);
    const bounds = await OBR.scene.items.getItemBounds(canonicalIds);
    await setSceneState({ ...scene, pivot: bounds.center });
  };

  if (!ready) return <main><h1>Around the Table</h1><p>Connecting…</p></main>;
  return <main>
    <h1>Around the Table</h1>
    <p>Status: <strong>{scene.enabled ? "Enabled" : "Disabled"}</strong></p>
    {role === "GM" && <button disabled={busy} onClick={() => void run(scene.enabled ? disableAroundTheTable : enableAroundTheTable)}>{scene.enabled ? "Disable Around the Table" : "Enable Around the Table"}</button>}
    {scene.enabled && <>
      {role === "GM" && <section>
        <h2>Rotation center</h2>
        <div className="coordinates">
          <label>X <input type="number" value={pivotXInput} onChange={(event) => setPivotXInput(event.target.value)} /></label>
          <label>Y <input type="number" value={pivotYInput} onChange={(event) => setPivotYInput(event.target.value)} /></label>
        </div>
        <div className="actions">
          <button disabled={busy} onClick={() => void run(applyPivot)}>Apply center</button>
          <button disabled={busy} onClick={() => void run(useSelectionCenter)}>Use selection center</button>
        </div>
      </section>}
      {role === "GM" && <section>
        <h2>Effect settings</h2>
        <label>Radius in grid cells <input type="number" min="0" step="0.5" placeholder="Unlimited" value={radiusInput} onChange={(event) => setRadiusInput(event.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={scene.rotateCharacters} onChange={(event) => void run(() => setSceneState({ ...scene, rotateCharacters: event.target.checked }))} /> Rotate character artwork</label>
        <button disabled={busy} onClick={() => void run(() => setSceneState({ ...scene, effectRadius: Number(radiusInput) > 0 ? Number(radiusInput) : null }))}>Apply radius</button>
      </section>}
      <section><h2>Your perspective</h2><div className="angles">{([0, 90, 180, 270] as const).map((value) => <button className={angle === value ? "selected" : ""} disabled={busy} key={value} onClick={() => void run(() => setPerspectiveAngle(value))}>{value}°</button>)}</div></section>
    </>}
    {!scene.enabled && role === "PLAYER" && <p>The GM has not enabled the rotated view for this scene.</p>}
    {error && <p className="error">{error}</p>}
  </main>;
}
