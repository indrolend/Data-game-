# Refactor Changelog

## Overview

Surgical dead-code removal and consolidation pass on `index.html`.  
File reduced from **8053 lines → 7385 lines** (−668 lines, −8%).  
No build step added. No framework introduced. All audio assets unchanged.

---

## What Changed

### 1. Dead CSS blocks removed (−212 lines)

| Block ID | What it defined | Why removed |
|---|---|---|
| `battery-event-data-ui` | `.battery-event` class | JS uses `.energy-ticker`, never `.battery-event` |
| `battery-event-visibility-fix` | `.battery-event` overrides | Same — dead class |
| `energy-sources-strip-ui` | `.battery-event` + `#battery-events` override | Dead class + redundant `!important` chain |
| `battery-symbol-impact-ui` | `.energy-symbol` + `#battery-events` override | `.energy-symbol` never written by JS |

### 2. Dead city layout system removed (−102 lines)

Constants `BUILDING_FOOTPRINTS`, `CITY_SIZE`, `CITY_BLOCK_SIZE`, `CITY_ROAD_WIDTH`, `CITY_SIDEWALK_WIDTH` and functions `isOnStreetOrSidewalk()`, `isInsideBuilding()`, `canPlaceGrass()`, `createCityLayout()` removed.  
The `createCityLayout()` call was already commented out.

### 3. Dead portal preview system removed (−68 lines)

`portalPreviewScene`, `portalPreviewGroup`, preview lights, and functions `clearPortalPreviewEnvironment()`, `addPortalPreviewBox()`, `rebuildPortalPreviewEnvironment()` removed.  
Active door rendering uses `mirrorCamera` + `mirrorRenderTarget` on the **main scene** — the preview scene was built every room transition but never rendered.  
Removed stale `rebuildPortalPreviewEnvironment()` call from `buildRoomEnvironment()`.  
Removed `portalPreviewChildren` field from `getRuntimeResourceSnapshot()`.

Portal door contract comment added above `buildRoomEnvironment()` explaining the full pipeline.

### 4. Dead `enterNextRoom()` function removed (−27 lines)

All room progression uses `enterNextRoomThroughPortal()`.  
`enterNextRoom()` existed as a near-duplicate with direct `player.pos` mutation — unreachable in active code.

### 5. Dead grass system removed (−160 lines)

`grassMaterial`, `createGrass()`, associated shader uniforms, and the disabled `createGrass()` call removed.  
`updateGrass()` also removed (guarded by `if (!grassMaterial) return` — always returned immediately).  
`updateGrass()` call removed from `updateFrame()`.

### 6. Dead cube projectile path removed (−78 lines)

`MAX_CUBE_PROJECTILES`, `cubeProjectileGeometry`, `cubeProjectileMaterial`, `cubeProjectileMesh` (InstancedMesh, `visible=false`) removed.  
`updateCubeProjectiles()` function removed — the frame call was already commented out.  
`phoneStorage.cubeProjectiles` field removed — `fireStoredCube()` uses `spawnDischargedSoul()` which writes to `targetData`, not this array.

### 7. Dead `updatePortalPreviewMotion()` stub removed (−4 lines)

Was an empty function body with no calls.

### 8. `resetRoomInventory()` helper extracted (+17 lines, reduces duplication)

Both `enterNextRoomThroughPortal()` and `resetRunState()` shared 13 lines of identical room teardown/rebuild logic.  
Extracted into `resetRoomInventory(doorLoopCooldown = 0)`:

```js
function resetRoomInventory(doorLoopCooldown = 0) {
    room.requiredSouls = ROOM_REQUIRED_SOULS;
    room.depositedSouls = 0;
    room.doorOpen = false;
    room.depositCooldown = 0;
    room.doorLoopCooldown = doorLoopCooldown;
    phoneStorage.storedCubes.length = 0;
    pendingDischargedSouls.length = 0;
    roomHumanRespawnQueue.length = 0;
    shuffleCaptureSlotSounds();
    syncStoredMirror();
    updateStoredSoulDisplays();
    buildRoomEnvironment();
    resetRoomTargets();
}
```

`enterNextRoomThroughPortal()` calls `resetRoomInventory(0.30)` (preserving the 0.30s cooldown that prevents immediate re-trigger after advancing).  
`resetRunState()` calls `resetRoomInventory(0)` (no cooldown on fresh game start).

---

## Why It Changed

Each removed system was confirmed dead via:
- Call sites commented out or absent
- Guarding early-return (`if (!grassMaterial) return`)
- `visible = false` with no toggle path
- Duplicate function body that is never reached
- CSS class never written by JS

The `resetRoomInventory` extraction reduces the chance of future divergence between the new-game and advance-room paths.

---

## What Behavior Should Remain the Same

- Double-click `index.html` loads game ✓
- START begins gameplay and music ✓
- Movement, jump, camera rotation work ✓
- Souls spawn, can be slurped, can be fired ✓
- Capture slots fill and trigger door open ✓
- Door loops when closed (no cost) ✓
- Door advances when open (room.index++, full rebuild) ✓
- Battery and POWER bars drain/refill ✓
- Powerup drops work ✓
- SOUND and CONTROLS panels work ✓
- Audio does not break under many SFX ✓
- No console errors from removed systems ✓

---

## What Behavior May Feel Slightly Different

- **None expected.** All removed code was unreachable at runtime. The `resetRoomInventory` extraction preserves call ordering.

---

## Manual Test Checklist

- [ ] Double-click `index.html` loads game without console errors
- [ ] Press START → gameplay begins, background music plays
- [ ] WASD/arrow movement and mouse-look camera work
- [ ] Walk into souls → slurp animation + sound
- [ ] Press Fire → soul fires toward crosshair target
- [ ] Firing into portal slot fills capture slot HUD
- [ ] Fill all capture slots → door opens (HUD updates)
- [ ] Walk through open door → advances to next room (Room 2), battery gains 18
- [ ] Walk through closed door → loops player back to start of room (no progress)
- [ ] Battery drain causes GAME OVER when empty
- [ ] Restart after GAME OVER → room resets to index 1
- [ ] Power pickup spawns occasionally → POWER bar fills
- [ ] SOUND button opens sound panel; volume sliders work
- [ ] CONTROLS button opens controls panel
- [ ] No obvious console errors during full play session
- [ ] Audio (SFX and music) continues to work after many events
