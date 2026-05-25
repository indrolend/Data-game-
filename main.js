import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

RectAreaLightUniformsLib.init();

// ========= DOM =========
const canvas = document.getElementById("game-canvas");
const startOverlay = document.getElementById("start-overlay");
const startButton = document.getElementById("start");
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
// ...rest of the gameplay logic from the <script type="module"> block...
