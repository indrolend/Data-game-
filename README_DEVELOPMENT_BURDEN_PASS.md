# Digital Breakdown — Development Burden Pass 01

## Playback contract

`index.html` is still the only runtime file needed. The game should remain double-click playable from the ZIP/extracted folder.

No live JavaScript module imports were added in this pass.

## Why this pass exists

The current runtime has grown into a single large HTML file containing game code, UI, audio assets, embedded models, and embedded sound data. That preserves double-click play, but it makes future patches fragile because ownership boundaries are implicit.

This pass reduces reasoning burden without changing gameplay by documenting the runtime ownership map and keeping reference material small instead of duplicating the full embedded runtime.

## Current high-risk ownership areas

### Audio

Primary functions:

- `startGameMusic()`
- `startGameOverMusic()`
- `playEventSound()`
- `setSlurpRingtonePlaying()`
- `updateSlurpRingtoneLoop()`
- `resetEventSoundState()`
- `updateBatteryEventSounds()`
- `playDamageAckSound()`
- `playCaptureSlotSound()`
- `applyAudioLevels()`

Current rule:

- Music and SFX route through `audioSettings`.
- Music mute and SFX mute are separate.
- Slurp ringtone is a singleton loop.
- One-shot event sounds are created with `new Audio(src)`.

Patch caution:

- Do not call audio helpers before they are defined in module scope.
- Do not bypass `getMusicLevel()` / `getSfxLevel()` when adding new volume-controlled sounds.
- Do not pitch-shift uploaded phone-system sounds unless explicitly requested.

### UI

Primary areas:

- Controls panel
- Sound panel
- Battery HUD
- Soul window HUD
- Capture goal slots
- Crosshair state

Current rule:

- `CONTROLS` and `SOUND` are docked in the top-right UI area.
- Sound sliders are styled like the battery meter.
- Muted sliders should look locked/full and be non-interactive.

Patch caution:

- UI panels should not overlap.
- New HUD elements should be hidden when `body:not(.game-started)` is active.

### Soul lifecycle

Primary functions:

- `setSoulState()`
- `markSoulSlurpable()`
- `queueSoulCapture()`
- `processQueuedSoulCaptures()`
- `releaseSoulFromScreen()`
- `spawnDischargedSoul()`
- `fireStoredCube()`
- `processPendingDischargedSouls()`
- `updateVacuum()`

Current contract:

```text
Human
→ slurpable soul cube
→ stored soul
→ fired soul
→ captured slot / human hit / lost
```

Patch caution:

- Avoid creating duplicate projectile systems.
- Fired souls should use the current soul/projectile path, not the old cube projectile path.
- Slurped souls should not instantly respawn humans at the same position.

### Room progression

Primary functions:

- `buildRoomEnvironment()`
- `resetRoomTargets()`
- `enterNextRoom()`
- `updateRoomLoop()`
- `depositShotSoulToRoom()`
- `shotSoulHitsRoomGrid()`
- `queueHumanRespawnFromSoul()`
- `updateRoomPopulation()`

Current contract:

- Each room has capture slots.
- Filling all capture slots opens the portal/mirror door.
- Enemy count increases by room.
- Enemy damage increases by room.
- Idle battery recharge slows by room.
- Humans continue appearing while the door is closed.

Patch caution:

- Door unlock is room progress, not storage count.
- Capture sounds are assigned to slots by shuffled room assignment.
- Payment success should play when the final required slot opens the next room.

### Camera

Primary functions:

- `updateCamera()`
- `toggleCameraMode()`

Current contract:

- Default is third-person.
- `C` toggles first-person.
- First-person hides the phone body to avoid clipping.
- First-person slurp visuals move behind camera and fade/scale out after crossing the camera plane.

Patch caution:

- Do not route first-person slurp into the floor.
- Do not let stored/slurped soul cubes cover the camera.

## Recommended next structural step

Do not split the playable runtime into imported modules yet. Instead, keep `index.html` playable and maintain this ownership map as the working edit guide.

Future safe extraction targets:

1. Audio helpers and event map
2. Sound UI panel logic
3. Soul lifecycle constants and transitions
4. Room director / progression functions

Only convert to live modules if the project stops requiring direct double-click `file://` play.

## Audio stability pass

The SFX system now avoids interrupting active pooled voices. Earlier pooled playback could choose a busy voice and restart it, which could sound like glitching/clicking when music, slurp ringtone, and SFX overlapped. The mixer ducking pass was also relaxed because rapid HTMLAudio volume changes can sound like music/SFX contention in browsers.

Current contract:
- Music remains a steady singleton stream.
- Slurp ringtone remains a low-volume singleton loop.
- SFX use finite pools and only play on available idle voices.
- Per-sound and global SFX caps prevent browser audio overload.
- Repeated cue spam is throttled by minimum intervals.

## Powerup / HUD containment pass

- Soul HUD pixel motion is clamped tighter inside the HUD bounds.
- Brute humans drop a pentagonal flower powerup when their armor breaks into soul state.
- The flower fills a supplemental battery stock.
- While supplemental stock is active, battery costs drain the flower stock before normal battery.
- The flower stock disappears when depleted.
