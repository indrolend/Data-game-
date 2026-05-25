import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

RectAreaLightUniformsLib.init();

// ========= DOM =========
const canvas = document.getElementById("game-canvas");
const startOverlay = document.getElementById("start-overlay");
const crosshair = document.getElementById("crosshair");

// ========= CONSTANTS =========
const TARGET_COUNT = 32;
const TARGET_STRIDE = 14;
const T_X = 0;
const T_Y = 1;
const T_Z = 2;
const T_FLOAT = 3;
const T_SPIN = 4;
const T_ALIVE = 5;
const T_SCALE = 6;
const T_HITFLASH = 7;
const T_CHAR = 8;
const T_RENDER_Y = 9;
const T_HEALTH = 10;
const T_VX = 11;
const T_VY = 12;
const T_VZ = 13;

const PARTICLE_COUNT = 256;
const PARTICLE_STRIDE = 8;
const P_X = 0;
const P_Y = 1;
const P_Z = 2;
const P_VX = 3;
const P_VY = 4;
const P_VZ = 5;
const P_LIFE = 6;
const P_MAXLIFE = 7;

const GRASS_COUNT = 2000;

// ========= MOVEMENT CONSTANTS =========
// Tuned for delta-time integration, matches original snappy feel but is frame-rate independent.
const WALK_ACCEL = 8;
const RUN_ACCEL = 18;
const WALK_MAX_SPEED = 9;
const RUN_MAX_SPEED = 19.2;
const BASE_FRICTION = 0.88;

// ========= CORE SETUP =========

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecae6);
scene.fog = new THREE.FogExp2(0x8ecae6, 0.018);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const clock = new THREE.Clock();

scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x315c38, 1.1));

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(30, 60, 25);
scene.add(sun);

const fill = new THREE.DirectionalLight(0x90caf9, 0.35);
fill.position.set(-20, 25, -30);
scene.add(fill);

const floor = new THREE.Mesh(
	new THREE.PlaneGeometry(120, 120),
	new THREE.MeshStandardMaterial({ color: 0x3f7448, roughness: 0.85 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// ========= CITY FOOTPRINTS AND FILTERS =========
// ========= CITY FOOTPRINTS AND FILTERS =========

const BUILDING_FOOTPRINTS = [];

const CITY_SIZE = 96;
const BLOCK_SIZE = 16;
const ROAD_WIDTH = 4;
const SIDEWALK_WIDTH = 1.2;
const ROAD_CLEARANCE = ROAD_WIDTH / 2 + SIDEWALK_WIDTH + 0.4;

function isOnStreetOrSidewalk(x, z) {
	function distToNearestGridLine(v) {
		const shifted = v + CITY_SIZE / 2;
		const mod = ((shifted % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
		return Math.min(mod, BLOCK_SIZE - mod);
	}
	return (
		distToNearestGridLine(x) < ROAD_CLEARANCE ||
		distToNearestGridLine(z) < ROAD_CLEARANCE
	);
}

function isInsideBuilding(x, z) {
	for (const b of BUILDING_FOOTPRINTS) {
		if (
			x > b.x - b.w / 2 &&
			x < b.x + b.w / 2 &&
			z > b.z - b.d / 2 &&
			z < b.z + b.d / 2
		) {
			return true;
		}
	}
	return false;
}

function canPlaceGrass(x, z) {
	return !isOnStreetOrSidewalk(x, z) && !isInsideBuilding(x, z);
}

function createCityLayout() {
	const roadMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.9 });
	const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9a8f, roughness: 0.8 });
	const smallMat = new THREE.MeshStandardMaterial({ color: 0x777f88, roughness: 0.7 });
	const mediumMat = new THREE.MeshStandardMaterial({ color: 0x59636f, roughness: 0.75 });
	const tallMat = new THREE.MeshStandardMaterial({ color: 0x3f4855, roughness: 0.8 });
	const citySize = CITY_SIZE;
	const blockSize = BLOCK_SIZE;
	const roadWidth = ROAD_WIDTH;
	const sidewalkWidth = SIDEWALK_WIDTH;
	function addFlatRect(width, depth, x, z, mat, y = 0.012) {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, depth), mat);
		mesh.position.set(x, y, z);
		scene.add(mesh);
		return mesh;
	}
	for (let p = -citySize / 2; p <= citySize / 2; p += blockSize) {
		addFlatRect(roadWidth, citySize, p, 0, roadMat);
		addFlatRect(sidewalkWidth, citySize, p - roadWidth / 2 - sidewalkWidth / 2, 0, sidewalkMat, 0.018);
		addFlatRect(sidewalkWidth, citySize, p + roadWidth / 2 + sidewalkWidth / 2, 0, sidewalkMat, 0.018);
		addFlatRect(citySize, roadWidth, 0, p, roadMat);
		addFlatRect(citySize, sidewalkWidth, 0, p - roadWidth / 2 - sidewalkWidth / 2, sidewalkMat, 0.018);
		addFlatRect(citySize, sidewalkWidth, 0, p + roadWidth / 2 + sidewalkWidth / 2, sidewalkMat, 0.018);
	}
	for (let x = -citySize / 2 + blockSize / 2; x < citySize / 2; x += blockSize) {
		for (let z = -citySize / 2 + blockSize / 2; z < citySize / 2; z += blockSize) {
			if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
			const r = Math.random();
			let w, d, h, mat;
			if (r < 0.45) {
				w = 4 + Math.random() * 2;
				d = 4 + Math.random() * 2;
				h = 2 + Math.random() * 2;
				mat = smallMat;
			} else if (r < 0.82) {
				w = 5 + Math.random() * 3;
				d = 5 + Math.random() * 3;
				h = 5 + Math.random() * 4;
				mat = mediumMat;
			} else {
				w = 5 + Math.random() * 3;
				d = 5 + Math.random() * 3;
				h = 10 + Math.random() * 8;
				mat = tallMat;
			}
			const jitterX = (Math.random() - 0.5) * 3;
			const jitterZ = (Math.random() - 0.5) * 3;
			const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
			building.position.set(x + jitterX, h / 2, z + jitterZ);
			scene.add(building);
			BUILDING_FOOTPRINTS.push({
				x: x + jitterX,
				z: z + jitterZ,
				w: w + 1.0,
				d: d + 1.0
			});
		}
	}
}

createCityLayout();

// ========= STATE =========

let gameStarted = false;
let screenFlashTime = -9999;

const keys = {};

const PHONE_HEIGHT = 0.16;
const GROUND_Y = PHONE_HEIGHT / 2;

// ===== VACUUM SYSTEM =====
let isVacuuming = false;
let vacuumPower = 0;
let vacuumPose = 0;
let vacuumFieldStrength = 0;
let vacuumConeTightness = 0;
const VACUUM_CHARGE_SPEED = 3.5;
const VACUUM_DECAY_SPEED = 6.0;
const VACUUM_DAMAGE = 0.28;
const VACUUM_MOVE_MULT = 0.35;
const INGEST_DISTANCE = 0.45;

// ===== PHONE CAPACITY STATE =====
const PHONE_CAPACITY = 5;
let absorbedCubes = 0;
let phoneIsFull = false;

// ===== CAPTURED HUMANS HUD =====
const humanHud = document.getElementById("human-hud");
const humanTiles = [];
for (let i = 0; i < PHONE_CAPACITY; i++) {
	const tile = document.createElement("div");
	tile.className = "human-tile";
	humanHud.appendChild(tile);
	humanTiles.push(tile);
}
function updateHumanHud() {
	for (let i = 0; i < PHONE_CAPACITY; i++) {
		if (i < absorbedCubes) {
			humanTiles[i].className = "human-tile filled";
		} else {
			humanTiles[i].className = "human-tile";
		}
	}
}
updateHumanHud();
function getVacuumInfluence(targetX, targetY, targetZ) {
	screen.getWorldPosition(vacuumPullPoint);
	camera.getWorldDirection(shotDir);
	shotDir.normalize();
	toTarget.set(
		targetX - vacuumPullPoint.x,
		targetY - vacuumPullPoint.y,
		targetZ - vacuumPullPoint.z
	);
	const dist = toTarget.length();
	if (dist <= 0.001) return 1;
	toTarget.normalize();
	const forwardness = toTarget.dot(shotDir);
	const wideDot = 0.45;
	const tightDot = 0.82;
	const coneDot = wideDot + (tightDot - wideDot) * vacuumConeTightness;
	if (forwardness < coneDot) return 0;
	const distanceFalloff = 1 - THREE.MathUtils.clamp(dist / 14, 0, 1);
	const coneFalloff = (forwardness - coneDot) / (1 - coneDot);
	return coneFalloff * distanceFalloff * vacuumFieldStrength;
}

// ===== TARGET LOCK SYSTEM =====
let lockedTarget = -1;
let lockStrength = 0;
const LOCK_BREAK_DOT = 0.35;
const LOCK_BREAK_DISTANCE = 18;
function isTargetLockValid(i) {
	if (i < 0) return false;
	const idx = i * TARGET_STRIDE;
	hitCenter.set(
		targetData[idx + T_X],
		targetData[idx + T_RENDER_Y],
		targetData[idx + T_Z]
	);
	flatToTarget.set(
		targetData[idx + T_X] - player.pos.x,
		0,
		targetData[idx + T_Z] - player.pos.z
	).normalize();
	characterForward.set(
		-Math.sin(player.theta),
		0,
		-Math.cos(player.theta)
	).normalize();
	const facingDot = flatToTarget.dot(characterForward);
	if (facingDot < LOCK_BREAK_DOT) return false;
	const distSq = player.pos.distanceToSquared(hitCenter);
	if (distSq > LOCK_BREAK_DISTANCE * LOCK_BREAK_DISTANCE) return false;
	return true;
}

const player = {
	pos: new THREE.Vector3(0, GROUND_Y, 0),
	vel: new THREE.Vector3(0, 0, 0),
	theta: 0,
	phi: 0,
	grounded: true,
	jumpVel: 0
};

const targetData = new Float32Array(TARGET_COUNT * TARGET_STRIDE);
const particleData = new Float32Array(PARTICLE_COUNT * PARTICLE_STRIDE);
let nextParticle = 0;

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

const dummy = new THREE.Object3D();
const vForward = new THREE.Vector3();
const vRight = new THREE.Vector3();
const vMove = new THREE.Vector3();
const vCamPos = new THREE.Vector3();
const vLookAt = new THREE.Vector3();
// Phone pose helpers
const phoneTargetPos = new THREE.Vector3();
const phoneAimTarget = new THREE.Vector3();
const phoneTargetQuat = new THREE.Quaternion();
const phoneBaseQuat = new THREE.Quaternion();
const phoneAimQuat = new THREE.Quaternion();
const phoneUp = new THREE.Vector3(0, 1, 0);
const screenForward = new THREE.Vector3();
// Vacuum visual helpers
const vacuumPullPoint = new THREE.Vector3();
const targetToVacuum = new THREE.Vector3();
const targetVisualPos = new THREE.Vector3();

// ========= PHONE =========

const phone = new THREE.Mesh(
	new THREE.BoxGeometry(0.08, 0.16, 0.012),
	new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.55, roughness: 0.25 })
);
scene.add(phone);

const screen = new THREE.Mesh(
	new THREE.PlaneGeometry(0.07, 0.125),
	new THREE.MeshStandardMaterial({
		color: 0x16202a,
		emissive: 0x12304a,
		emissiveIntensity: 0.75
	})
);
screen.position.z = 0.007;
phone.add(screen);

const screenLight = new THREE.RectAreaLight(0xffffff, 0, 0.08, 0.16);
screenLight.position.set(0, 0, 0.02);
screen.add(screenLight);

const cameraBump = new THREE.Mesh(
	new THREE.CylinderGeometry(0.009, 0.009, 0.004, 20),
	new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.25 })
);
cameraBump.rotation.x = Math.PI / 2;
cameraBump.position.set(-0.02, 0.055, -0.008);
phone.add(cameraBump);

// ========= GRASS: INSTANCED + SHADER =========

let grassMaterial = null;

// ===== GRASS BLAST GLOBALS =====
const shootOrigin = new THREE.Vector3();
const shootDir = new THREE.Vector3();
let shootImpulseTime = -9999;

function createGrass() {
	const geometry = new THREE.BoxGeometry(0.08, 0.45, 0.035);
	grassMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uPlayerPos: { value: new THREE.Vector3() },
			uColor: { value: new THREE.Color(0x4a7c59) },
			uShootOrigin: { value: new THREE.Vector3() },
			uShootDir: { value: new THREE.Vector3(0, 0, -1) },
			uShootTime: { value: -9999 },
			uVacuumPower: { value: 0 }
		},
		vertexShader: `
			varying vec2 vUv;
			uniform float uTime;
			uniform vec3 uPlayerPos;
			uniform vec3 uShootOrigin;
			uniform vec3 uShootDir;
			uniform float uShootTime;
			uniform float uVacuumPower;
			void main() {
				vUv = uv;
				vec4 worldPos = instanceMatrix * vec4(position, 1.0);
				vec3 transformed = position;
				float h = clamp(position.y / 0.45, 0.0, 1.0);
				float windDist = distance(worldPos.xz, uPlayerPos.xz);
				float windMask = 1.0 - smoothstep(4.0, 12.0, windDist);
				float wind =
					sin(uTime + worldPos.x * 0.65 + worldPos.z * 0.45) *
					0.07 *
					h *
					windMask;
				transformed.x += wind;
				float dist = distance(worldPos.xz, uPlayerPos.xz);
				float radius = 0.9;
				if (dist < radius && position.y > 0.0) {
					float power = 1.0 - dist / radius;
					vec2 dir = normalize(worldPos.xz - uPlayerPos.xz);
					transformed.x += dir.x * power * 0.3 * h;
					transformed.z += dir.y * power * 0.3 * h;
					transformed.y -= power * 0.08 * h;
				}
				// ===== RADIAL SHOOT IMPULSE WITH DECAY =====
				float age = uTime - uShootTime;
				if (age >= 0.0 && age < 1.4) {
					vec2 toBlade = worldPos.xz - uShootOrigin.xz;
					float distFromShot = length(toBlade);
					vec2 radialDir = normalize(toBlade + vec2(0.0001, 0.0001));
					float waveFront = age * 7.5;
					float waveWidth = 0.85;
					float ring = 1.0 - smoothstep(0.0, waveWidth, abs(distFromShot - waveFront));
					float rangeFade = 1.0 - smoothstep(0.0, 7.5, distFromShot);
					float decay = exp(-age * 2.4);
					float wobble = sin(age * 18.0 - distFromShot * 2.0) * decay;
					float blast = ring * rangeFade * decay * h;
					float afterMotion = wobble * rangeFade * h * 0.22;
					transformed.x += radialDir.x * (blast * 0.9 + afterMotion);
					transformed.z += radialDir.y * (blast * 0.9 + afterMotion);
					transformed.y -= blast * 0.14;
				}
				// ===== VACUUM INWARD PULL =====
				if (uVacuumPower > 0.01) {
					vec2 toVacuum = uShootOrigin.xz - worldPos.xz;
					float vacuumDist = length(toVacuum);
					vec2 pullDir = normalize(toVacuum + vec2(0.0001, 0.0001));
					float pullMask = 1.0 - smoothstep(0.5, 8.0, vacuumDist);
					float pulse = 0.75 + 0.25 * sin(uTime * 18.0 + vacuumDist * 3.0);
					float pull = pullMask * pulse * uVacuumPower * h;
					transformed.x += pullDir.x * pull * 0.45;
					transformed.z += pullDir.y * pull * 0.45;
					transformed.y -= pull * 0.1;
				}
				gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
			}
		`,
		fragmentShader: `
			varying vec2 vUv;
			uniform vec3 uColor;
			void main() {
				float shade = 0.42 + vUv.y * 0.85;
				gl_FragColor = vec4(uColor * shade, 1.0);
			}
		`
	});
	const grass = new THREE.InstancedMesh(geometry, grassMaterial, GRASS_COUNT);
	const patchCount = 42;
	const area = 70;
	const patchCenters = [];
	for (let p = 0; p < patchCount; p++) {
		patchCenters.push({
			x: (Math.random() - 0.5) * area,
			z: (Math.random() - 0.5) * area,
			radius: 1.4 + Math.random() * 3.2,
			density: 0.45 + Math.random() * 0.75
		});
	}
	for (let i = 0; i < GRASS_COUNT; i++) {
		let x;
		let z;
		if (Math.random() < 0.82) {
			const patch = patchCenters[Math.floor(Math.random() * patchCenters.length)];
			const angle = Math.random() * Math.PI * 2;
			const r = Math.sqrt(Math.random()) * patch.radius;
			x = patch.x + Math.cos(angle) * r;
			z = patch.z + Math.sin(angle) * r;
		} else {
			x = (Math.random() - 0.5) * area;
			z = (Math.random() - 0.5) * area;
		}
		x += (Math.random() - 0.5) * 0.45;
		z += (Math.random() - 0.5) * 0.45;
		let attempts = 0;
		while (!canPlaceGrass(x, z) && attempts < 20) {
			if (Math.random() < 0.82) {
				const patch = patchCenters[Math.floor(Math.random() * patchCenters.length)];
				const angle = Math.random() * Math.PI * 2;
				const r = Math.sqrt(Math.random()) * patch.radius;
				x = patch.x + Math.cos(angle) * r;
				z = patch.z + Math.sin(angle) * r;
			} else {
				x = (Math.random() - 0.5) * area;
				z = (Math.random() - 0.5) * area;
			}
			x += (Math.random() - 0.5) * 0.45;
			z += (Math.random() - 0.5) * 0.45;
			attempts++;
		}
		if (!canPlaceGrass(x, z)) {
			dummy.position.set(0, -999, 0);
			dummy.scale.setScalar(0);
			dummy.updateMatrix();
			grass.setMatrixAt(i, dummy.matrix);
			continue;
		}
		dummy.position.set(x, 0.225, z);
		dummy.rotation.y = Math.random() * Math.PI;
		const heightVariation = 0.5 + Math.random() * 1.25;
		dummy.scale.set(
			0.6 + Math.random() * 0.9,
			heightVariation,
			0.6 + Math.random() * 0.9
		);
		dummy.updateMatrix();
		grass.setMatrixAt(i, dummy.matrix);
	}
	grass.instanceMatrix.needsUpdate = true;
	scene.add(grass);
}

createGrass();

// ========= TARGETS: DATA + INSTANCED VIEW =========

const targetGeometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
const targetMaterial = new THREE.MeshStandardMaterial({
	color: 0xffffff,
	transparent: true,
	opacity: 0.32,
	roughness: 0.2,
	metalness: 0.1
});

const targetMesh = new THREE.InstancedMesh(targetGeometry, targetMaterial, TARGET_COUNT);
scene.add(targetMesh);

// ========= GELATIN STRAND MESH =========
const strandGeometry = new THREE.BoxGeometry(0.18, 0.18, 1);
const strandMaterial = new THREE.MeshStandardMaterial({
	color: 0xffffff,
	transparent: true,
	opacity: 0.22,
	roughness: 0.2,
	metalness: 0.05
});
const strandMesh = new THREE.InstancedMesh(strandGeometry, strandMaterial, TARGET_COUNT);
scene.add(strandMesh);

// ===== SYMBOLS =====
const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function resetTarget(i) {
	const idx = i * TARGET_STRIDE;
	targetData[idx + T_X] = (Math.random() - 0.5) * 24;
	targetData[idx + T_Y] = 0.65;
	targetData[idx + T_Z] = (Math.random() - 0.5) * 24;
	targetData[idx + T_FLOAT] = Math.random() * Math.PI * 2;
	targetData[idx + T_SPIN] = 0.4 + Math.random() * 0.8;
	targetData[idx + T_ALIVE] = 1;
	targetData[idx + T_SCALE] = 1;
	targetData[idx + T_HITFLASH] = 0;
	targetData[idx + T_HEALTH] = 1;
	targetData[idx + T_CHAR] = Math.floor(Math.random() * SYMBOLS.length);
	targetData[idx + T_VX] = 0;
	targetData[idx + T_VY] = 0;
	targetData[idx + T_VZ] = 0;
}

for (let i = 0; i < TARGET_COUNT; i++) resetTarget(i);

function updateCamera() {
	const distance = 3;
	const height = 1.1;
	const minCameraY = GROUND_Y + 0.8;
	vAimDir.set(
		-Math.sin(player.theta) * Math.cos(player.phi),
		Math.sin(player.phi),
		-Math.cos(player.theta) * Math.cos(player.phi)
	).normalize();
	vCameraOffset.copy(vAimDir).multiplyScalar(-distance);
	vCameraOffset.y += height;
	vCamPos.copy(player.pos).add(vCameraOffset);
	if (vCamPos.y < minCameraY) {
		vCamPos.y = minCameraY;
	}
	camera.position.copy(vCamPos);
	vLookAt.copy(player.pos).addScaledVector(vAimDir, 10);
	vLookAt.y += 0.45;
	camera.lookAt(vLookAt);
}

const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const particleMaterial = new THREE.MeshBasicMaterial({
	color: 0xff4444,
	transparent: true,
	opacity: 0.9
});
const particleMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, PARTICLE_COUNT);
scene.add(particleMesh);

function spawnParticleBurst(x, y, z) {
	for (let n = 0; n < 22; n++) {
		const i = nextParticle;
		nextParticle = (nextParticle + 1) % PARTICLE_COUNT;
		const idx = i * PARTICLE_STRIDE;
		const life = 0.55 + Math.random() * 0.35;
		particleData[idx + P_X] = x;
		particleData[idx + P_Y] = y;
		particleData[idx + P_Z] = z;
		particleData[idx + P_VX] = (Math.random() - 0.5) * 5;
		particleData[idx + P_VY] = Math.random() * 4;
		particleData[idx + P_VZ] = (Math.random() - 0.5) * 5;
		particleData[idx + P_LIFE] = life;
		particleData[idx + P_MAXLIFE] = life;
	}
}

function updateParticles(dt) {
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const idx = i * PARTICLE_STRIDE;
		let life = particleData[idx + P_LIFE];
		if (life <= 0) {
			dummy.position.set(0, -999, 0);
			dummy.scale.setScalar(0);
			dummy.updateMatrix();
			particleMesh.setMatrixAt(i, dummy.matrix);
			continue;
		}
		particleData[idx + P_VY] -= 8 * dt;
		particleData[idx + P_X] += particleData[idx + P_VX] * dt;
		particleData[idx + P_Y] += particleData[idx + P_VY] * dt;
		particleData[idx + P_Z] += particleData[idx + P_VZ] * dt;
		life -= dt;
		particleData[idx + P_LIFE] = life;
		const t = Math.max(life / particleData[idx + P_MAXLIFE], 0);
		dummy.position.set(
			particleData[idx + P_X],
			particleData[idx + P_Y],
			particleData[idx + P_Z]
		);
		dummy.rotation.set(life * 8, life * 4, life * 6);
		dummy.scale.setScalar(t);
		dummy.updateMatrix();
		particleMesh.setMatrixAt(i, dummy.matrix);
	}
	particleMesh.instanceMatrix.needsUpdate = true;
}

const hitCenter = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const shotOrigin = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const characterForward = new THREE.Vector3();
const flatToTarget = new THREE.Vector3();
const AIM_CONE_DOT = 0.72;

function rayHitsTarget(origin, direction) {
	let bestIndex = -1;
	let bestDistance = Infinity;
	const ray = new THREE.Ray(origin, direction);
	characterForward.set(
		-Math.sin(player.theta),
		0,
		-Math.cos(player.theta)
	).normalize();
	for (let i = 0; i < TARGET_COUNT; i++) {
		const idx = i * TARGET_STRIDE;
		hitCenter.set(
			targetData[idx + T_X],
			targetData[idx + T_RENDER_Y],
			targetData[idx + T_Z]
		);
		toTarget.copy(hitCenter).sub(origin);
		const cameraForwardDistance = toTarget.dot(direction);
		if (cameraForwardDistance <= 0) continue;
		flatToTarget.set(
			targetData[idx + T_X] - player.pos.x,
			0,
			targetData[idx + T_Z] - player.pos.z
		).normalize();
		const facingDot = flatToTarget.dot(characterForward);
		if (facingDot < AIM_CONE_DOT) continue;
		const radius = 0.55;
		const distSq = ray.distanceSqToPoint(hitCenter);
		if (distSq < radius * radius && cameraForwardDistance < bestDistance) {
			bestDistance = cameraForwardDistance;
			bestIndex = i;
		}
	}
	return bestIndex;
}

function updateVacuum(dt, time) {
	const targetPose = isVacuuming ? 1 : 0;
	vacuumPose += (targetPose - vacuumPose) * Math.min(1, dt * 10);
	if (phoneIsFull) {
		isVacuuming = false;
		vacuumPower = 0;
		vacuumFieldStrength = 0;
		vacuumConeTightness = 0;
		lockedTarget = -1;
		lockStrength = 0;
		return;
	}
	vacuumFieldStrength += ((isVacuuming ? 1 : 0) - vacuumFieldStrength) * Math.min(1, dt * 5);
	vacuumConeTightness += ((lockedTarget !== -1 ? 1 : 0) - vacuumConeTightness) * Math.min(1, dt * 4);
	if (isVacuuming) {
		vacuumPower = Math.min(1, vacuumPower + VACUUM_CHARGE_SPEED * dt);
	} else {
		vacuumPower = Math.max(0, vacuumPower - VACUUM_DECAY_SPEED * dt);
	}
	if (vacuumPower <= 0) return;
	screenFlashTime = performance.now();
	screen.getWorldPosition(shootOrigin);
	camera.getWorldDirection(shootDir);
	shootDir.y = 0;
	shootDir.normalize();
	camera.getWorldPosition(shotOrigin);
	camera.getWorldDirection(shotDir);
	shotDir.normalize();
	if (isVacuuming && lockedTarget === -1) {
		lockedTarget = rayHitsTarget(shotOrigin, shotDir);
	}
	if (!isVacuuming) {
		lockedTarget = -1;
		lockStrength = 0;
	}
	if (lockedTarget !== -1 && !isTargetLockValid(lockedTarget)) {
		lockedTarget = -1;
		lockStrength = 0;
	}
	const hit = lockedTarget;
	screen.getWorldPosition(vacuumPullPoint);
	for (let i = 0; i < TARGET_COUNT; i++) {
		const idx = i * TARGET_STRIDE;
		if (targetData[idx + T_HEALTH] <= 0) continue;
		const influence = getVacuumInfluence(
			targetData[idx + T_X],
			targetData[idx + T_RENDER_Y],
			targetData[idx + T_Z]
		);
		targetToVacuum.set(
			vacuumPullPoint.x - targetData[idx + T_X],
			vacuumPullPoint.y - targetData[idx + T_RENDER_Y],
			vacuumPullPoint.z - targetData[idx + T_Z]
		);
		targetData[idx + T_VX] += targetToVacuum.x * influence * 8 * dt;
		targetData[idx + T_VY] += targetToVacuum.y * influence * 5 * dt;
		targetData[idx + T_VZ] += targetToVacuum.z * influence * 8 * dt;
		targetData[idx + T_VX] *= Math.pow(0.08, dt);
		targetData[idx + T_VY] *= Math.pow(0.08, dt);
		targetData[idx + T_VZ] *= Math.pow(0.08, dt);
		const suctionAmount = 1 - targetData[idx + T_HEALTH];
		const bodyGive = THREE.MathUtils.smoothstep(suctionAmount, 0.55, 1.0);
		targetData[idx + T_X] += targetData[idx + T_VX] * dt * bodyGive;
		targetData[idx + T_Y] += targetData[idx + T_VY] * dt * bodyGive;
		targetData[idx + T_Z] += targetData[idx + T_VZ] * dt * bodyGive;
	}
	if (hit !== -1) {
		lockStrength = Math.min(1, lockStrength + dt * 2.5);
		const idx = hit * TARGET_STRIDE;
		const pullPower = vacuumPower * lockStrength;
		targetData[idx + T_HEALTH] -= VACUUM_DAMAGE * pullPower * dt;
		targetData[idx + T_SCALE] = 1;
		targetVisualPos.set(
			targetData[idx + T_X],
			targetData[idx + T_RENDER_Y],
			targetData[idx + T_Z]
		);
		const closeEnoughToScreen =
			targetVisualPos.distanceToSquared(vacuumPullPoint) < INGEST_DISTANCE * INGEST_DISTANCE;
		const fullyDrained = targetData[idx + T_HEALTH] <= 0;
		if (fullyDrained || closeEnoughToScreen) {
			spawnParticleBurst(
				targetData[idx + T_X],
				targetData[idx + T_RENDER_Y],
				targetData[idx + T_Z]
			);
						absorbedCubes++;
						updateHumanHud();

						// Add capture pulse animation to the most recently filled tile
						const capturedIndex = Math.min(absorbedCubes - 1, humanTiles.length - 1);
						if (capturedIndex >= 0) {
							const tile = humanTiles[capturedIndex];
							tile.classList.remove("capture-pulse");
							void tile.offsetWidth;
							tile.classList.add("capture-pulse");
						}
			if (absorbedCubes >= PHONE_CAPACITY) {
				phoneIsFull = true;
			}
			resetTarget(hit);
			lockedTarget = -1;
			lockStrength = 0;
		}
	}
}

startButton.onclick = () => {
	gameStarted = true;
	startOverlay.style.display = "none";
	crosshair.style.display = "block";
	renderer.domElement.requestPointerLock();
};

window.addEventListener("keydown", (e) => {
	keys[e.code] = true;
	if (!gameStarted) return;
	if (e.code === "Space" && player.grounded) {
		player.jumpVel = 4.5;
		player.grounded = false;
	}
});

window.addEventListener("keyup", (e) => {
	keys[e.code] = false;
});

window.addEventListener("mousemove", (e) => {
	if (!gameStarted) return;
	if (document.pointerLockElement !== renderer.domElement) return;
	player.theta -= e.movementX * 0.003;
	const MAX_PITCH = Math.PI * 0.48;
	player.phi = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, player.phi - e.movementY * 0.003));
});
const vAimDir = new THREE.Vector3();
const vCameraOffset = new THREE.Vector3();

window.addEventListener("mousedown", () => {
	if (!gameStarted) return;
	if (document.pointerLockElement !== renderer.domElement) return;
	isVacuuming = true;
});

window.addEventListener("mouseup", () => {
	isVacuuming = false;
});

window.addEventListener("resize", () => {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(innerWidth, innerHeight);
});

function updateMovement(dt) {
	const running = keys.ShiftLeft || keys.ShiftRight;
	const accel = running ? RUN_ACCEL : WALK_ACCEL;
	const maxSpeed = running ? RUN_MAX_SPEED : WALK_MAX_SPEED;
	const vacuumSlow = 1.0 - vacuumPose * (1.0 - VACUUM_MOVE_MULT);
	vForward.set(-Math.sin(player.theta), 0, -Math.cos(player.theta));
	vRight.set(Math.cos(player.theta), 0, -Math.sin(player.theta));
	vMove.set(0, 0, 0);
	if (keys.KeyW) vMove.add(vForward);
	if (keys.KeyS) vMove.sub(vForward);
	if (keys.KeyA) vMove.sub(vRight);
	if (keys.KeyD) vMove.add(vRight);
	if (vMove.lengthSq() > 0) {
		vMove.normalize();
		player.vel.addScaledVector(vMove, accel * vacuumSlow * dt);
	}
	if (player.vel.length() > maxSpeed * vacuumSlow) {
		player.vel.setLength(maxSpeed * vacuumSlow);
	}
	if (!player.grounded) {
		player.jumpVel -= 14 * dt;
		player.pos.y += player.jumpVel * dt;
		if (player.pos.y <= GROUND_Y) {
			player.pos.y = GROUND_Y;
			player.jumpVel = 0;
			player.grounded = true;
		}
	}
	player.pos.addScaledVector(player.vel, dt);
	player.vel.multiplyScalar(Math.pow(BASE_FRICTION, dt * 60));
	phoneTargetPos.copy(player.pos);
	phoneTargetPos.y += vacuumPose * 0.65;
	phoneTargetPos.x += Math.sin(player.theta) * vacuumPose * 0.25;
	phoneTargetPos.z += Math.cos(player.theta) * vacuumPose * 0.25;
	phone.position.lerp(phoneTargetPos, Math.min(1, dt * 12));
	const leanAmount = running ? 0.5 : 0.35;
	const leanX = -vMove.z * leanAmount;
	const leanZ = vMove.x * leanAmount;
	if (typeof window.phoneVacuumTurn === 'undefined') window.phoneVacuumTurn = 0;
	let phoneVacuumTurn = window.phoneVacuumTurn;
	phoneVacuumTurn += ((isVacuuming ? 1 : 0) - phoneVacuumTurn) * Math.min(1, dt * 4.5);
	window.phoneVacuumTurn = phoneVacuumTurn;
	const easedTurn = phoneVacuumTurn * phoneVacuumTurn * (3 - 2 * phoneVacuumTurn);
	dummy.rotation.set(leanX, player.theta, leanZ);
	phoneBaseQuat.copy(dummy.quaternion);
	camera.getWorldDirection(screenForward).normalize();
	phoneAimTarget.copy(phone.position).addScaledVector(screenForward, 10);
	dummy.position.copy(phone.position);
	dummy.lookAt(phoneAimTarget);
	phoneAimQuat.copy(dummy.quaternion);
	phone.quaternion.copy(phoneBaseQuat).slerp(phoneAimQuat, easedTurn);
	const ritualFlip = Math.sin(easedTurn * Math.PI) * 0.75;
	const vacuumWobble = Math.sin(performance.now() * 0.018) * 0.035 * vacuumPose;
	phone.rotateX(-ritualFlip);
	phone.rotateZ(vacuumWobble);
	if (phoneIsFull) {
		const now = performance.now();
		const cycle = (now % 1100) / 1100;
		if (cycle < 0.32) {
			const burst = Math.sin((cycle / 0.32) * Math.PI);
			const ring = Math.sin(now * 0.055);
			phone.rotateZ(ring * 0.16 * burst);
			phone.rotateX(Math.abs(ring) * 0.045 * burst);
			phone.position.x += ring * 0.01 * burst;
		}
		screen.material.emissive.set(0xff3333);
		screen.material.emissiveIntensity = 1.25;
		screenLight.intensity = 4.5;
	}
}

function updateTargets(time) {
	for (let i = 0; i < TARGET_COUNT; i++) {
		const idx = i * TARGET_STRIDE;
		const x = targetData[idx + T_X];
		const baseY = targetData[idx + T_Y];
		const z = targetData[idx + T_Z];
		const floatOffset = targetData[idx + T_FLOAT];
		const spinSpeed = targetData[idx + T_SPIN];
		const scale = targetData[idx + T_SCALE];
		const charIdx = targetData[idx + T_CHAR];
		const y = baseY + Math.sin(time * 0.002 + floatOffset) * 0.18;
		targetData[idx + T_RENDER_Y] = y;
		const rot = time * 0.001 * spinSpeed;
		dummy.position.set(x, y, z);
		const health = targetData[idx + T_HEALTH];
		const suctionAmount = 1 - health;
		if (suctionAmount > 0.01 && vacuumPower > 0.01) {
			dummy.lookAt(vacuumPullPoint);
			const wobble = Math.sin(time * 0.02 + i * 3.1) * suctionAmount * 0.35;
			dummy.rotateZ(wobble);
			const collapse = THREE.MathUtils.smoothstep(suctionAmount, 0.75, 1.0);
			dummy.scale.setScalar(scale * (1.0 - collapse * 0.45));
		} else {
			dummy.rotation.set(0, rot, 0);
			dummy.scale.setScalar(scale);
		}
		dummy.updateMatrix();
		targetMesh.setMatrixAt(i, dummy.matrix);
		if (suctionAmount > 0.01 && vacuumPower > 0.01) {
			targetVisualPos.set(x, y, z);
			const midX = (targetVisualPos.x + vacuumPullPoint.x) * 0.5;
			const midY = (targetVisualPos.y + vacuumPullPoint.y) * 0.5;
			const midZ = (targetVisualPos.z + vacuumPullPoint.z) * 0.5;
			const rawDist = targetVisualPos.distanceTo(vacuumPullPoint);
			const dist = Math.min(rawDist, 4.5);
			dummy.position.set(midX, midY, midZ);
			dummy.lookAt(vacuumPullPoint);
			const wobble = Math.sin(time * 0.018 + i * 4.1) * 0.08 * suctionAmount;
			dummy.rotateX(wobble);
			dummy.rotateZ(wobble * 0.7);
			const strandIn = THREE.MathUtils.smoothstep(suctionAmount, 0.08, 0.35);
			dummy.scale.set(
				(1.0 - suctionAmount * 0.55) * strandIn,
				(1.0 - suctionAmount * 0.55) * strandIn,
				dist * strandIn
			);
			dummy.updateMatrix();
			strandMesh.setMatrixAt(i, dummy.matrix);
		} else {
			dummy.position.set(0, -999, 0);
			dummy.scale.setScalar(0);
			dummy.updateMatrix();
			strandMesh.setMatrixAt(i, dummy.matrix);
		}
	}
	targetMesh.instanceMatrix.needsUpdate = true;
	strandMesh.instanceMatrix.needsUpdate = true;
}

function updateScreenFlash() {
	const elapsed = performance.now() - screenFlashTime;
	if (elapsed < 120) {
		const t = elapsed / 120;
		screen.material.emissive.set(0xffffff);
		screen.material.emissiveIntensity = 2.8 - 2.2 * t;
		screenLight.intensity = 24 - 22 * t;
	} else {
		screen.material.emissive.set(0x12304a);
		screen.material.emissiveIntensity = 0.75;
		screenLight.intensity = 0;
	}
}

function updateGrass(time) {
	grassMaterial.uniforms.uTime.value = time * 0.002;
	grassMaterial.uniforms.uPlayerPos.value.copy(player.pos);
	grassMaterial.uniforms.uShootOrigin.value.copy(shootOrigin);
	grassMaterial.uniforms.uShootDir.value.copy(shootDir);
	grassMaterial.uniforms.uShootTime.value = shootImpulseTime * 0.002;
	grassMaterial.uniforms.uVacuumPower.value = vacuumPower;
}

function updateCrosshair() {
	camera.getWorldPosition(shotOrigin);
	camera.getWorldDirection(shotDir);
	shotDir.normalize();
	const candidate = rayHitsTarget(shotOrigin, shotDir);
	crosshair.className = lockedTarget !== -1 || candidate !== -1 ? "locked" : "";
}

function animate(time = 0) {
	requestAnimationFrame(animate);
	const dt = Math.min(clock.getDelta(), 0.1);
	if (gameStarted) updateMovement(dt);
	updateVacuum(dt, time);
	updateCamera();
	updateScreenFlash();
	updateGrass(time);
	updateTargets(time);
	updateParticles(dt);
	updateCrosshair();
	renderer.render(scene, camera);
}

animate();
