# Around the Table

Around the Table is an Owlbear Rodeo proof-of-concept extension that projects one shared scene into a personal 0°, 90°, 180°, or 270° view for each player.

**Canonical OBR items are authoritative. Local projected items are disposable views.**

## Architecture

```text
              CANONICAL OBR SCENE
              -------------------
              hidden authoritative
                  item at P
                     |
          +----------+----------+
          |                     |
          v                     v
    Client A                Client B
    angle = 0°              angle = 180°
          |                     |
          v                     v
    local proxy             local proxy
    T0(P)                   T180(P)
```

```text
player drags local proxy
          |
          v
local movement delta
          |
          v
inverse perspective transform
          |
          v
canonical movement
          |
          v
canonical OBR item interaction
          |
          v
shared authoritative state
          |
     +----+----+
     |         |
     v         v
 transform   transform
 for A       for B
```

The GM enables the extension once per scene. Visible MAP and CHARACTER images are marked with namespaced source metadata, their original visibility is recorded, and they are hidden. Each client independently builds local image proxies and transforms canonical positions and rotations about the stored map-bounds center. CHARACTER proxies are moved with Owlbear's normal Move tool: local-item changes are treated as position intent, inverse-transformed, and written to the hidden canonical item through coalesced `OBR.scene.items.updateItems` calls. Around the Table does not add a custom movement tool or mode.

Scene metadata contains only the enabled flag and pivot. The selected angle is player metadata. Item participation and restoration data live on canonical items, so reload and disable do not depend on in-memory state.

The shared scene settings also support an optional effect radius around the pivot and a character-art rotation toggle. The radius is entered in grid cells and converted through the scene DPI; membership uses each item's actual OBR bounds center. A persistent background page watches scene changes, so newly added visible MAP and CHARACTER images are adopted automatically while the extension is enabled; eligible items outside the radius remain canonical and visible.

While enabled, the GM can enter an exact shared rotation center in scene coordinates or select canonical scene items and use the center of their combined OBR bounds. Changing the center immediately reprojects all clients and re-evaluates radius membership.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Install `http://localhost:5173/manifest-local.json` as the development extension.

### Local manifest says “Failed to fetch”

Opening the manifest successfully in a browser tab is not enough: Owlbear Rodeo
fetches it cross-origin from `https://www.owlbear.rodeo`. The Vite configuration
must return `Access-Control-Allow-Origin: https://www.owlbear.rodeo`. This project
sets that explicitly in `vite.config.ts`. Restart the development server after
changing that setting, then retry installing the manifest.

## Exact two-client acceptance test

Use two separate OBR clients in the same room. Create one MAP IMAGE and one CHARACTER IMAGE/token, then enable Around the Table as the GM.

Set Client A to 0° and Client B to 180°.

1. Confirm the map appears rotated 180° between A and B.
2. Confirm the character appears in the corresponding rotated position.
3. Activate the **Around the Table** tool on A and drag the token visually upward.
4. Confirm B sees the same canonical movement as visually downward.
5. Activate the tool on B and drag the token visually right.
6. Confirm A sees that movement visually left.
7. Confirm both clients settle on the same canonical token state.
8. Reload Client B.
9. Confirm B reconstructs the 180° projection correctly.
10. Disable Around the Table.
11. Confirm local proxies disappear.
12. Confirm the original canonical map and token reappear in their correct canonical positions.

Repeat the full test with A at 90° and B at 270°.

## Required runtime experiments

The SDK 3.1.0 typings establish that `ToolEvent.target` may be an `Item`, local items support bounds queries, and hidden canonical items may be passed to `startItemInteraction`. Typings cannot establish host runtime behavior or event cadence. During the acceptance test, record these observations rather than inferring them from compilation:

- **Tool targeting:** verify that drag events name a local proxy in `event.target`. The implementation first uses that path and has a narrow local-bounds hit-test fallback.
- **Invisible source interaction — observed:** `startItemInteraction` accepted the hidden existing item but did not commit its canonical position; the local proxy snapped back afterward. The implementation therefore uses ordinary serialized canonical item updates, with fast local feedback, as the narrow workaround.
- **Canonical propagation — observed:** canonical `scene.items.onChange` updates correctly settle remote proxies but appear as discrete jumps during native proxy movement. This is intentional: no transient drag animation channel is used.

Full reconciliation updates every client from canonical state after a drag.

## Current limitations

Only IMAGE items that are visible on MAP or CHARACTER when enabled are adopted. MAP proxies are locked and ignore hits; CHARACTER proxies move only through the extension tool. Movement is unsnapped. The extension does not adopt newly-created visible images while already enabled. See [FUTURE.md](./FUTURE.md) for deliberately deferred features.
