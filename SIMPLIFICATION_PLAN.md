# Simplification Plan (No Gameplay Behavior Change)

## Risk policy

- **Do not do HIGH-risk changes** in this pass.
- Preserve frame order, state ownership, event mappings, and all audio timing/pitch defaults.

## SAFE (recommended first)

1. **Document retired systems inline and in one index section**
   - Mark `updateCubeProjectiles` / `phoneStorage.cubeProjectiles` as retired-but-kept.
   - Mark `updatePortalPreviewMotion` and preview-scene builders as compatibility/stale.

2. **Remove obviously unused runtime paths only when fully unreachable**
   - Verify zero callsites, then remove `enterNextRoom()` (portal path uses `enterNextRoomThroughPortal()`).

3. **Normalize ownership comments around portal flow**
   - Add a short contract comment near `updateRoomLoop` + `startDoorTransition` describing closed-loop vs open-advance semantics.

4. **Tighten constant provenance comments**
   - Group `ROOM_*`, `DISCHARGE_*`, `SOUL_*`, `BATTERY_*` with one-line ownership notes to reduce cross-section hunting.

5. **Packaging hygiene checks**
   - Keep `index.html` + `audio/` only runtime-critical assets; exclude accidental temp/debug files from release packaging.

## LOW (safe extraction without changing call order)

1. **Extract room transition reset helper**
   - Consolidate duplicated reset chunks shared by `resetRunState`, `enterNextRoomThroughPortal`, and legacy `enterNextRoom` into a single helper while preserving exact call sequence.

2. **Extract audio event routing table helper**
   - Centralize cue-kind selection (`AUDIO_BUS` + `playEventSound`) and event thresholds (`updateBatteryEventSounds`) in adjacent helpers only.

3. **Extract soul projectile terminal outcomes helper**
   - In `updateVacuum` recoil/deposit branch, isolate “deposit hit / human hit / out-of-bounds clear” decisions into dedicated helpers without changing branching order.

4. **Extract HUD sync helper for room labels/goal slots**
   - Keep `updateRoomVisuals` behavior but split pure DOM sync from mesh pulse updates.

## MEDIUM (needs manual regression pass)

1. **Portal preview de-scope**
   - Stop rebuilding `portalPreviewGroup` if mirror camera is the only active door render path.
   - Keep fallback path behind a flag if needed for diagnostics.

2. **Remove legacy cube projectile render resources**
   - Remove `cubeProjectileMesh` creation/update only after confirming no debug feature depends on it.

3. **Consolidate room progression entry points**
   - Fold `enterNextRoom` and `enterNextRoomThroughPortal` into one internal implementation with mode flags.

4. **Difficulty/scaling consolidation**
   - Centralize room scaling outputs (active enemy count, enemy pressure, recharge pressure) into one function returning derived values consumed by existing systems.

## HIGH (explicitly avoid for now)

- Reordering `updateFrame` pipeline.
- Rewriting soul state machine representation.
- Changing camera/portal math contracts.
- Replacing audio pipeline timing or transport model.
- Altering drain/recharge constants or projectile flight tuning.

## Focused findings linked to requested audit themes

- **Dead/retired projectile systems**: legacy `cubeProjectiles` path exists but is not used by active frame loop.
- **Duplicate portal/mirror preview logic**: preview scene infrastructure exists beside active mirror-camera rendering.
- **Stale city/grass/open-field remnants**: city/open-field scaffolding and disabled grass creation remain in runtime file.
- **Multiple constants for same concept**: room reset/progression logic repeats near-identical state resets in multiple functions.
- **Audio grouping opportunities**: event bus and battery event trigger logic are already close; can be consolidated further without behavior change.
- **UI grouping opportunities**: room HUD + goal slots + stored soul HUD updates are split across several functions with repeated callsites.
- **Per-frame allocations**: many vectors already reused; one notable per-shot allocation remains (`screenPlaneCenter.clone()` in `spawnDischargedSoul`).
- **Disposal coverage**: disposal helper handles geometries, materials (including arrays), and textures with preservation support for mirror render target.
- **Large base64 assets**: embedded SFX base64 block is large (multi‑KB inline payload in `index.html`); prioritize external `audio/` files as authoritative and avoid adding new inline media blobs.
- **Portal reasonability pain points**: transition + mapping + mirror render are correct but spread across multiple sections; a small contract block would lower reasoning cost.
