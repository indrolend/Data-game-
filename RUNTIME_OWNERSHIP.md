# Runtime Ownership — Digital Breakdown

Scope: `index.html` module runtime only (double-click `file://` play contract preserved).

---

## Current ownership (before refactor)

### Frame pipeline
```
animate() → updateFrame() → renderMirrorDoor() → renderer.render(scene, camera)
```

`updateFrame` hot-path order:
1. `updateMovement(dt)`
2. `processPendingDischargedSouls(dt)`
3. `updateHumanWalking(dt)`
4. `updateVacuum(dt)`
5. `updateBattery(dt)`
6. `processQueuedSoulCaptures()`
7. `updateRoomPopulation(dt)`
8. `updateFlowerPowerups(dt)`
9. `updateRoomLoop(dt)`
10. `updateCamera()`
11. visual/UI updates

**Door transition branch** short-circuits movement/combat and only runs
`updateDoorTransition` + camera/HUD visuals.

**Ordering invariants (must be preserved):**
- `updateMovement` must run before `updateCamera`.
- `processPendingDischargedSouls` must run before `updateVacuum`.
- `processQueuedSoulCaptures` must run after `updateVacuum` and `updateBattery`.
- `updateCamera` must complete before `renderMirrorDoor` snaps the mirror camera.
- `renderMirrorDoor` must run after world-state update and before final `renderer.render`.

---

### 1) Player movement + camera

**State**: `player`, `cursor`, `cameraMode`, `doorTransition`, `portalCameraCompression`

**Mutators**: `updateMovement` → `updatePlayerPhysics`, `updatePlayerActionPoseTimers`,
`updatePhoneVisualPose`; `updateCamera`, `constrainThirdPersonCamera`, `toggleCameraMode`

**Write targets**: `camera.position/lookAt`, `phone.visible`

**Cleanup**: `resetRunState`, `triggerRunDeath`

---

### 2) Portal door render/crossing pipeline

**State**: `room`, `doorTransition`, `fixedPortal`, `mirrorRenderTarget`, `mirrorCamera`,
`roomMirrorPlane`, `roomDoorMesh`, `portalCameraCompression`

**Crossing detect**: `updateRoomLoop`

**Transition lifecycle**:
```
startDoorTransition(mode)
  → updateDoorTransition(dt)
    → finishDoorTransition()
      if "advance" → enterNextRoomThroughPortal()
      if "loop"    → loopPlayerThroughClosedDoor()
```

**Body handoff**: `applyPortalBodyHandoff` (maps player position/velocity through portal)

**Mirror render**: `updateMirrorDoorCamera`, `renderMirrorDoor` (offscreen render target →
door plane texture)

**Cleanup**: `buildRoomEnvironment` / `clearRoomEnvironment` on room advance

**Dead code present before refactor**:
- `portalPreviewScene` / `portalPreviewGroup` — built and filled on every room rebuild but never
  rendered; active door render uses `mirrorCamera` + main scene, not a separate preview scene.
- `rebuildPortalPreviewEnvironment()` / `clearPortalPreviewEnvironment()` / `addPortalPreviewBox()`
  — only serve the dead preview scene.
- `updatePortalPreviewMotion()` — empty no-op compatibility stub.
- `enterNextRoom()` — never called; progression uses `enterNextRoomThroughPortal()`.

---

### 3) Human → soul → storage → projectile → capture

**State**: `targetData` (flat typed array), `soulState`, `soulDepositShot`, `soulCaptureQueue`,
`phoneStorage.storedCubes`, `pendingDischargedSouls`, `room.depositedSouls`, `roomGridCells`

**Lifecycle**:
```
Human
  → damageSoulShell / markSoulSlurpable
  → updateVacuum → setSoulState → queueSoulCapture → processQueuedSoulCaptures
  → storeCubeFromTarget (phoneStorage.storedCubes)
  → fireStoredCube → spawnDischargedSoul (soulDepositShot slot in targetData)
  → shotSoulHitsRoomGrid / depositShotSoulToRoom / damageHumansAlongDepositShot
```

**Dead code present before refactor**:
- `phoneStorage.cubeProjectiles` array — retired projectile array never populated by active code.
- `MAX_CUBE_PROJECTILES`, `cubeProjectileGeometry`, `cubeProjectileMaterial`, `cubeProjectileMesh`
  — InstancedMesh allocated and added to scene but never made visible or updated.
- `updateCubeProjectiles()` — function present but call-site commented out in `updateFrame`.

---

### 4) Battery / POWER drain + recharge

**State**: `battery`, `supplementalBattery`, `activePowerupStacks`, `phoneStorage`

**Mutators**: `spendBattery`, `gainBattery`, `updateBattery`, `consumeSupplementalBattery`,
`feedSupplementalBattery`, `addPowerupStack`, `clearActivePowerups`

**Rule**: `spendBattery` drains supplemental stock first, then normal battery.

**Write targets**: `updateBatteryHud`, `updateSupplementalBatteryHud`, battery ticker helpers

---

### 5) Audio playback

**State**: `audioSettings`, `audioMix`, `eventSoundState`, `sfxPools`, WebAudio nodes
(`slurpRingtoneSource/gain`), HTML audio (`gameMusic`, `gameOverMusic`)

**Routing**:
- Music: `startGameMusic` / `stopGameMusic` → HTML `<audio>` element
- SFX: `playEventSound` → `playPooledSfx` → WebAudio pool (per-source pool, finite voices)
- Slurp ringtone: `setSlurpRingtonePlaying` → singleton WebAudio `OscillatorNode` loop
- Battery events: `updateBatteryEventSounds` (called from `spendBattery` / `gainBattery`)

**Rule**: All volume-controlled sounds route through `getMusicLevel()` / `getSfxLevel()`.
`applyAudioLevels()` must run after mute/slider changes.

**Dead code present before refactor**:
- Three successive `<style id="energy-sources-strip-ui">`, `<style id="battery-symbol-impact-ui">`,
  and `<style id="battery-sequential-ticker-ui">` blocks all redefine `#battery-events`. Only the
  last one (sequential ticker) wins at runtime.

---

### 6) UI / HUD

**DOM nodes**: `battery*`, `goalSlots`, `room*`, `humanTiles`, `soulWindow`, `crosshair`,
controls/sound panel nodes

**Mutators**: `updateBatteryHud`, `updateHumanHud`, `updateSoulWindowHud`,
`updateSoulWindowMotion`, `renderGoalSlots`, `updateRoomVisuals`, `updateCrosshair`,
`applyCrosshairArmTransforms`

**Rule**: New HUD elements must be hidden when `body:not(.game-started)` is active.

---

### 7) Room generation / reset / cleanup

**State**: `room`, `roomGroup`, `roomGridCells`, `roomGridSoulCubes`, `roomColliders`,
`roomHumanRespawnQueue`

**Lifecycle**:
```
buildRoomEnvironment()   — geometry + colliders
resetRoomTargets()       — spawn initial humans
enterNextRoomThroughPortal() — advance room index, rebuild, respawn
resetRunState()          — full run reset (death/restart)
clearRoomEnvironment()   — dispose Three.js objects
```

**Dead code present before refactor**: `enterNextRoom()` — dead alternate entry point.

---

### 8) Enemy population + scaling

**State**: `targetData` human fields, `roomHumanRespawnQueue`

**Mutators**: `getActiveHumanTarget`, `resetTarget`, `updateHumanWalking`,
`queueHumanRespawnFromSoul`, `updateRoomPopulation`

---

### 9) Dead / retired systems (present before refactor)

| System | State | Status |
|--------|-------|--------|
| City layout | `createCityLayout`, `isOnStreetOrSidewalk`, `isInsideBuilding`, `canPlaceGrass`, `CITY_SIZE`, `BLOCK_SIZE`, `ROAD_WIDTH`, `SIDEWALK_WIDTH`, `BUILDING_FOOTPRINTS` | Call commented out; indoor lab loop is active setting |
| Grass | `createGrass`, `updateGrass`, `grassMaterial`, `GRASS_COUNT` | `createGrass()` call commented out; `updateGrass()` no-ops when `grassMaterial === null` |
| Cube projectiles | `cubeProjectileMesh`, `updateCubeProjectiles`, `phoneStorage.cubeProjectiles` | Frame call commented out; InstancedMesh allocated but never written |
| Portal preview scene | `portalPreviewScene`, `portalPreviewGroup`, `rebuildPortalPreviewEnvironment`, `updatePortalPreviewMotion` | Geometry built each room but never rendered; active door uses mirror camera |
| Legacy room advance | `enterNextRoom()` | Never called; all progression uses `enterNextRoomThroughPortal()` |

---

## Intended simplified ownership (after refactor)

### What changes

1. **Dead city/grass/projectile/preview systems removed** — no allocations or frame work for
   features that are fully disabled.

2. **Portal door pipeline** — same state and logic; `portalPreviewScene` removed so the door
   architecture is: `updateRoomLoop` detects crossing → `startDoorTransition` → `finishDoorTransition`
   → `enterNextRoomThroughPortal` or `loopPlayerThroughClosedDoor`. No separate preview scene.

3. **Room reset logic extracted** — `resetRoomState()` helper shared between
   `enterNextRoomThroughPortal` and `resetRunState`, eliminating duplicated field resets.

4. **CSS battery-events** — only the final sequential-ticker style block remains; earlier
   overridden blocks removed.

5. **Section comments** — key system boundaries labeled so future readers can navigate.

### What stays identical

- Frame pipeline order (all 11 hot-path steps preserved)
- Door transition lifecycle and portal math
- Soul state machine
- Battery drain/recharge contracts
- Audio routing and pool caps
- All WebAudio SFX contracts
- All external `/audio` asset references
- HUD layout and behavior
- Double-click `file://` play contract
