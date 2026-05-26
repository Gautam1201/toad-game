import * as THREE from 'three';
import './style.css';
import Player from './components/Player.js';
import Enemy from './components/Enemy.js';
import FloatingText from './components/FloatingText.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import createMap from './components/Map.js';
import House from './components/House.js';

// Scene setup
const scene = new THREE.Scene();

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// Map
const mapGroup = createMap();
scene.add(mapGroup);

// Houses
// Rejection sampling: pick a random spot, reject if too close to the player spawn
// (origin) or to any previously-placed house. The house's real collision radius is
// only known after its GLB loads, so we use a conservative pre-known spacing.
const houses = [];
const HOUSE_COUNT = 3;
const HOUSE_SPAWN_RANGE = 400;        // square half-width around origin
const MIN_HOUSE_SPACING = 180;        // > expected house footprint to leave walkable gaps
const PLAYER_SPAWN_BUFFER = 120;      // keep origin clear so the toad never spawns inside
const MAX_SPAWN_ATTEMPTS = 30;        // bounded retry: infeasible configs fail loud, not hang

function findHouseSpawnPosition(existing) {
    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
        const candidate = new THREE.Vector3(
            (Math.random() - 0.5) * HOUSE_SPAWN_RANGE * 2,
            (Math.random() - 0.5) * HOUSE_SPAWN_RANGE * 2,
            0
        );
        if (candidate.length() < PLAYER_SPAWN_BUFFER) continue;
        const tooClose = existing.some(pos => candidate.distanceTo(pos) < MIN_HOUSE_SPACING);
        if (!tooClose) return candidate;
    }
    return null;
}

const placedPositions = [];
for (let i = 0; i < HOUSE_COUNT; i++) {
    const pos = findHouseSpawnPosition(placedPositions);
    if (!pos) {
        console.warn(`Could not place house ${i} after ${MAX_SPAWN_ATTEMPTS} attempts; skipping.`);
        continue;
    }
    placedPositions.push(pos);
    const house = new House(scene, pos);
    houses.push(house);
    mapGroup.add(house.group);
}

// Player
const player = new Player();
scene.add(player.group);

// Camera
const camera = createCamera();
scene.add(camera);
const cameraOffset = new THREE.Vector3(300, -300, 300);

// Enemies
const enemies = [];
const BASE_SPAWN_DELAY = 1000; // 1 second
const BASE_MAX_ENEMIES = 10;
const COMPLEXITY_GROWTH_FACTOR = 0.01; // Difficulty increase per score unit
const SCALING_DELAY_SCORE = 100; // Delay scaling until score reaches this value
let spawnTimer = 0;

const spawnLocations = [
    new THREE.Vector3(500, 500, 0),
    new THREE.Vector3(-500, 500, 0),
    new THREE.Vector3(500, -500, 0),
    new THREE.Vector3(-500, -500, 0)
];

// Base values for scaling
const BASE_ENEMY_SPEED = 0.5;
const BASE_PLAYER_SPEED = 2;
const BASE_ATTACK_COOLDOWN = 1000;
const BASE_ATTACK_RADIUS = 50;

// Max/Min limits for scaling
const MIN_SPAWN_DELAY = 200;
const MAX_MAX_ENEMIES = 50;
const MAX_ENEMY_SPEED = 3.0;
const MAX_PLAYER_SPEED = 5.0;
const MIN_ATTACK_COOLDOWN = 200;
const MAX_ATTACK_RADIUS = 150;

// Current values
let currentSpawnDelay = BASE_SPAWN_DELAY;
let currentMaxEnemies = BASE_MAX_ENEMIES;
let currentEnemySpeed = BASE_ENEMY_SPEED;
let currentPlayerSpeed = BASE_PLAYER_SPEED;
let currentPlayerAttackCooldown = BASE_ATTACK_COOLDOWN;
let currentPlayerAttackRadius = BASE_ATTACK_RADIUS;

// Scoring constants
const SCORE_PER_SECOND = 0.1;
const SCORE_PER_KILL = 10;

// Scoring state
let score = 0;
let isGameOver = false;
const floatingTexts = [];
const clock = new THREE.Clock();
const scoreElement = document.querySelector('.score');
const gameOverElement = document.querySelector('.game-over');

function spawnEnemy() {
    if (isGameOver || enemies.length >= currentMaxEnemies) return;
    const location = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
    enemies.push(new Enemy(scene, player, location));
}

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    if (gameOverElement) gameOverElement.style.display = 'block';
    player.group.visible = false;
    // Clear input queue
    inputQueue.length = 0;
}

function resetGame() {
    isGameOver = false;
    if (gameOverElement) gameOverElement.style.display = 'none';
    
    // Reset player
    player.group.position.set(0, 0, 0);
    player.group.visible = true;
    player.isMoving = false;
    player.progress = 0;
    player.startPosition.set(0, 0, 0);
    player.targetPosition.set(0, 0, 0);

    // Reset score
    score = 0;
    if (scoreElement) scoreElement.textContent = `Score: 0`;

    // Clear enemies
    enemies.forEach(enemy => {
        scene.remove(enemy.group);
    });
    enemies.length = 0;

    // Clear floating texts
    floatingTexts.forEach(text => {
        scene.remove(text.sprite);
        if (text.sprite.material.map) text.sprite.material.map.dispose();
        text.sprite.material.dispose();
    });
    floatingTexts.length = 0;

    // Respawn enemies at corners
    spawnLocations.forEach(location => {
        enemies.push(new Enemy(scene, player, location));
    });

    // Reset clock
    clock.getDelta();
}

// Renderer
const renderer = createRenderer();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Input collection
const inputQueue = [];
window.addEventListener('keydown', (event) => {
    if (isGameOver) {
        if (event.code === 'Space') {
            resetGame();
        }
        return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        inputQueue.push(event.key);
    } else if (event.code === 'Space') {
        const { kills, positions } = player.attack(enemies, scene, currentPlayerAttackRadius, currentPlayerAttackCooldown);
        if (kills > 0) {
            score += kills * SCORE_PER_KILL;
            positions.forEach(pos => {
                floatingTexts.push(new FloatingText(scene, `+${SCORE_PER_KILL}`, pos));
            });
        }
    }
});

// Animation loop
// Clamp dt to avoid huge jumps after tab-blur / GC pause / breakpoints,
// which would otherwise teleport enemies past the player in a single tick.
const MAX_DELTA_TIME = 0.1; // seconds

renderer.setAnimationLoop(() => {
    const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

    if (isGameOver) {
        renderer.render(scene, camera);
        return;
    }

    // Update score based on survival time
    score += deltaTime * SCORE_PER_SECOND;

    // Difficulty scaling logic
    const difficultyFactor = Math.max(0, score - SCALING_DELAY_SCORE) * COMPLEXITY_GROWTH_FACTOR;
    
    // Enemy parameters scale slightly faster (factor 1.5 for example)
    const enemyScalingFactor = difficultyFactor * 1.5;
    const playerScalingFactor = difficultyFactor;

    currentSpawnDelay = Math.max(MIN_SPAWN_DELAY, BASE_SPAWN_DELAY / (1 + enemyScalingFactor));
    currentMaxEnemies = Math.min(MAX_MAX_ENEMIES, Math.floor(BASE_MAX_ENEMIES * (1 + enemyScalingFactor * 0.5)));
    currentEnemySpeed = Math.min(MAX_ENEMY_SPEED, BASE_ENEMY_SPEED * (1 + enemyScalingFactor));

    currentPlayerSpeed = Math.min(MAX_PLAYER_SPEED, BASE_PLAYER_SPEED * (1 + playerScalingFactor * 0.5));
    currentPlayerAttackCooldown = Math.max(MIN_ATTACK_COOLDOWN, BASE_ATTACK_COOLDOWN / (1 + playerScalingFactor));
    currentPlayerAttackRadius = Math.min(MAX_ATTACK_RADIUS, BASE_ATTACK_RADIUS * (1 + playerScalingFactor * 0.2));

    // Enemy spawning with accumulated timer
    spawnTimer += deltaTime * 1000; // convert to ms
    if (spawnTimer >= currentSpawnDelay) {
        spawnEnemy();
        spawnTimer = 0;
    }
    
    // Update UI
    if (scoreElement) {
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
    }

    if (!player.isMoving && inputQueue.length > 0) {
        const nextMove = inputQueue.shift();
        if (player.move(nextMove, enemies, houses)) {
            triggerGameOver();
        }
    }

    // player.update now returns true if a mid-hop collision with an enemy occurred.
    if (player.update(deltaTime, currentPlayerSpeed, currentPlayerAttackCooldown, currentPlayerAttackRadius, enemies)) {
        triggerGameOver();
    }

    // Update enemies
    for (const enemy of enemies) {
        if (enemy.update(deltaTime, enemies, currentEnemySpeed, houses)) {
            triggerGameOver();
            break;
        }
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        if (!floatingTexts[i].update()) {
            floatingTexts.splice(i, 1);
        }
    }

    // Smooth camera follow
    const targetCameraPos = player.group.position.clone().add(cameraOffset);
    camera.position.lerp(targetCameraPos, 0.05);
    camera.lookAt(player.group.position);

    renderer.render(scene, camera);
});

