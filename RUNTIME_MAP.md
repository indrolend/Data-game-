# Runtime Map (index.html)

Scope: `index.html` module runtime only (double-click `file://` play contract preserved).

## Global runtime order

- `animate()` → `updateFrame()` → `renderMirrorDoor()` → `renderer.render(scene, camera)`.
- `updateFrame()` hot path order:
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
  11. visuals/UI updates (`updateScreenFlash`, `updateTargets`, `updateParticles`, `updateProximityAttackVisuals`, `updateCrosshair`, `applyCrosshairArmTransforms`, `updateSoulWindowMotion`)
- Door transition branch short-circuits movement/combat and only updates transition/camera/HUD visuals.

---

## 1) Player movement + camera update order

- **Main state objects**: `player`, `cursor`, `cameraMode`, `doorTransition`, `portalCameraCompression`, `phoneCharacter`, `vacuum`, `roomColliders`.
- **Constants**: `PARKOUR.*`, `CAMERA_COLLISION_RADIUS`, `CAMERA_COLLISION_BACKOFF`, room bounds constants.
- **Mutators**:
  - Movement: `updateMovement` → `updatePlayerPhysics`, `updatePlayerActionPoseTimers`, `updatePhoneVisualPose`.
  - Camera: `updateCamera`, `constrainThirdPersonCamera`, `toggleCameraMode`.
- **Render-state writers**: `camera.position/lookAt`, `phone.visible`, crosshair transforms.
- **Cleanup**: no per-frame disposal; reset via `resetRunState` / `triggerRunDeath`.
- **Dup/stale**: none in core path; camera collision path is consolidated.
- **Hidden ordering assumptions**:
  - `updateMovement` must run before `updateCamera`.
  - `updateCamera` must run before `startDoorTransition` snapshots and before final render.

## 2) Portal door render/crossing pipeline

- **Main state objects**: `room`, `doorTransition`, `fixedPortal`, `mirrorRenderTarget`, `mirrorCamera`, `roomMirrorPlane`, `roomDoorMesh`.
- **Constants**: `ROOM_EXIT_Z`, `ROOM_START_Z`, `fixedPortal.*`, `portalCameraCompression.*`.
- **Mutators**:
  - Crossing detect: `updateRoomLoop`.
  - Transition lifecycle: `startDoorTransition` → `updateDoorTransition` → `finishDoorTransition`.
  - Body handoff: `applyPortalBodyHandoff`, `mapSameRoomPortalCrossingPosition`, `mapSameRoomPortalVelocity`.
  - Room advance/loop: `enterNextRoomThroughPortal`, `loopPlayerThroughClosedDoor`.
- **Render-state writers**:
  - Mirror camera: `updateMirrorDoorCamera`.
  - Door texture pass: `renderMirrorDoor` (offscreen render target).
- **Cleanup**: room rebuild via `buildRoomEnvironment`/`clearRoomEnvironment` on room advance.
- **Dup/stale**:
  - `enterNextRoom()` exists but portal flow uses `enterNextRoomThroughPortal()`.
  - `portalPreviewScene`/`portalPreviewGroup` still built but active door rendering now uses mirror camera.
  - `updatePortalPreviewMotion()` is empty compatibility stub.
- **Hidden ordering assumptions**:
  - `startDoorTransition` explicitly calls `updateCamera()` and `updateMirrorDoorCamera()` before snapshotting.
  - `renderMirrorDoor` must run after world state update but before final `renderer.render`.

## 3) Human → soul → storage → projectile → capture

- **Main state objects**:
  - `targetData` (humans/souls/projectiles in one pool)
  - `soulState`, `soulDepositShot`, `soulCaptureQueue`, `soulCaptureQueued`, `soulCaptureCommitted`
  - `phoneStorage.storedCubes`, `pendingDischargedSouls`
  - `room.depositedSouls`, `roomGridCells`
- **Constants**: `SOUL_*`, `DISCHARGE_*`, `ROOM_DEPOSIT_HIT_RADIUS`, `PHONE_CAPACITY`, `SOUL_CAPTURE_*`.
- **Mutators**:
  - Human→slurpable: `damageSoulShell`, `markSoulSlurpable`.
  - Vacuum capture state machine: `updateVacuum`, `setSoulState`, `queueSoulCapture`, `releaseSoulFromScreen`, `processQueuedSoulCaptures`, `completeTargetCapture`.
  - Storage/fire: `storeCubeFromTarget`, `fireStoredCube`, `processPendingDischargedSouls`, `spawnDischargedSoul`.
  - Projectile outcomes: `shotSoulHitsRoomGrid`, `depositShotSoulToRoom`, `damageHumansAlongDepositShot`.
- **Render-state writers**: `updateTargets` (instanced visual output), HUD via `updateStoredSoulDisplays`.
- **Cleanup**: `clearTargetSlot`, `resetTarget`, `resetTargetLattice`, room reset functions clear queues/storage.
- **Dup/stale**:
  - Old projectile path still present: `phoneStorage.cubeProjectiles`, `updateCubeProjectiles` (explicitly commented out in frame loop).
- **Hidden ordering assumptions**:
  - `processPendingDischargedSouls` runs before `updateVacuum` each frame.
  - `processQueuedSoulCaptures` runs after vacuum update and battery update.

## 4) Battery / POWER drain + recharge

- **Main state objects**: `battery`, `supplementalBattery`, `activePowerupStacks`, `phoneStorage`.
- **Constants**: `BATTERY_*`, `POWERUP_STOCK_*`, `FLOWER_*`, combo constants.
- **Mutators**: `spendBattery`, `gainBattery`, `updateBattery`, `consumeSupplementalBattery`, `feedSupplementalBattery`, `addPowerupStack`, `clearActivePowerups`.
- **Render-state writers**: `updateBatteryHud`, `updateSupplementalBatteryHud`, battery ticker helpers.
- **Cleanup**: `resetRunState`, `triggerRunDeath`, `clearActivePowerups`.
- **Dup/stale**: no behavioral duplicate; flow is centralized through `spendBattery/gainBattery`.
- **Hidden ordering assumptions**:
  - `spendBattery` consumes supplemental POWER first, then battery.
  - `updateBatteryEventSounds` is called from both spend and gain paths.

## 5) Audio playback

- **Main state objects**: `audioSettings`, `audioMix`, `eventSoundState`, `sfxPools`, WebAudio nodes (`slurpRingtoneSource/gain`), HTML audio (`gameMusic`, `gameOverMusic`).
- **Constants**: `EVENT_SFX_*`, `AUDIO_BUS`, SFX pool caps/throttles.
- **Mutators**: `applyAudioLevels`, `playEventSound`, `playPooledSfx`, `playCaptureSlotSound`, `setSlurpRingtonePlaying`, `updateSlurpRingtoneLoop`, `updateBatteryEventSounds`, `startGameMusic`, `startGameOverMusic`, stop/reset helpers.
- **Render-state writers**: N/A (audio output path).
- **Cleanup**: `resetEventSoundState`, `stopAllPooledSfx`, `setSlurpRingtonePlaying(false)`, run reset/death paths.
- **Dup/stale**:
  - External file map (`eventSoundUrls`) and embedded `SFX_AUDIO_BASE64` coexist (fallback layering).
- **Hidden ordering assumptions**:
  - `applyAudioLevels` must run after mute/slider changes and duck timer changes.
  - Slurp ringtone gating depends on soul states and `phoneStorage.isFull`.

## 6) UI/HUD update

- **Main state objects**: DOM nodes (`battery*`, `goalSlots`, `room*`, `humanTiles`, `soulWindow`, `crosshair`, controls/sound panel nodes), `crosshairState`.
- **Constants**: `INPUT_CONTRACT`, HUD style constants, battery/room text conventions.
- **Mutators**: `updateBatteryHud`, `updateHumanHud`, `updateSoulWindowHud`, `updateSoulWindowMotion`, `renderGoalSlots`, `updateRoomVisuals`, `updateCrosshair`, `applyCrosshairArmTransforms`, controls/sound panel event handlers.
- **Render-state writers**: direct DOM text/class/style updates.
- **Cleanup**: run reset/death clears some HUD containers (`battery-events`, start overlay states).
- **Dup/stale**:
  - `mode` API remains but runtime hard-sets vacuum mode (`setMode` forces `game.mode = "vacuum"`).
- **Hidden ordering assumptions**:
  - Stored soul HUD updates are centralized through `updateStoredSoulDisplays()`.
  - Crosshair uses `targetLock` produced by `updateVacuum`/ray pass.

## 7) Room generation / reset / cleanup

- **Main state objects**: `room`, `roomGroup`, `roomGridCells`, `roomGridSoulCubes`, `roomColliders`, `roomHumanRespawnQueue`.
- **Constants**: `ROOM_*`, `ROOM_REQUIRED_SOULS`.
- **Mutators**: `buildRoomEnvironment`, `resetRoomTargets`, `enterNextRoomThroughPortal`, `resetRunState`, `clearRoomEnvironment`.
- **Render-state writers**: `updateRoomVisuals` (door label, goal fill, mirror frame emissive).
- **Cleanup**: `disposeObjectTree`, `clearThreeGroup`, `clearRoomEnvironment`, `clearPortalPreviewEnvironment`.
- **Dup/stale**:
  - Two room-advance functions (`enterNextRoom`, `enterNextRoomThroughPortal`), with portal flow using the latter.
- **Hidden ordering assumptions**:
  - Room rebuild must happen before `resetRoomTargets` spawn pass.

## 8) Enemy population + scaling

- **Main state objects**: `targetData` human fields (`T_KIND`, `T_HEALTH`, `T_ARMOR`, attack timers), `roomHumanRespawnQueue`, `room.index`.
- **Constants**: `ACTIVE_HUMAN_TARGET`, `ACTIVE_HUMAN_TARGET_CAP`, `HUMAN_RESPAWN_*`, `SOUL_ARMOR_NORMAL`, `SOUL_ARMOR_BRUTE`, `HUMAN_WALK_SPEED`, attack constants.
- **Mutators**: `getActiveHumanTarget`, `resetTarget`, `updateHumanWalking`, `queueHumanRespawnFromSoul`, `updateRoomPopulation`.
- **Render-state writers**: `updateTargets` consumes target state for enemy/soul visuals.
- **Cleanup**: `clearTargetSlot`, `resetRoomTargets`, room reset paths.
- **Dup/stale**: scaling is spread (count scaling in `getActiveHumanTarget`; battery pressure from room index appears in constants/logic elsewhere), not encapsulated in one “difficulty director”.
- **Hidden ordering assumptions**:
  - Respawn queue processing assumes target slots are available only after capture/discharge state has cleared.

## 9) Resource disposal / memory cleanup

- **Main state objects**: Three object graphs under `roomGroup` and `portalPreviewGroup`; `mirrorRenderTarget` texture preservation set.
- **Constants/options**: `preservedTextures` contract in disposal helpers.
- **Mutators/cleanup**:
  - `disposeMaterialResource` (array materials + texture walk + material dispose)
  - `disposeObjectTree` (geometry/material traversal)
  - `clearThreeGroup`
  - `clearRoomEnvironment` / `clearPortalPreviewEnvironment`
- **Render-state writers**: none.
- **Dup/stale**:
  - Portal preview assets are still allocated/rebuilt despite mirror-camera replacing fake preview render.
- **Hidden ordering assumptions**:
  - `mirrorRenderTarget.texture` must be preserved when clearing room assets.

---

## Notable stale/retired systems observed

- Retired projectile path retained in code: `phoneStorage.cubeProjectiles` + `updateCubeProjectiles` (frame call commented out).
- Legacy portal preview scaffolding retained (`portalPreviewScene/group` + builder), while runtime door uses `renderMirrorDoor` + `mirrorCamera`.
- `updatePortalPreviewMotion()` is a no-op compatibility function.
- `enterNextRoom()` appears unused by active portal progression.
- `createGrass()` is disabled (`// createGrass();`) while `updateGrass()` remains gated by `if (!grassMaterial) return;`.
- `CORE_RUNTIME_CONTRACT.world` still says `"city"` although active gameplay loop is lab-room based.
