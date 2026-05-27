import * as THREE from 'three';
import './style.css';
import Player from './components/Player.js';
import Enemy from './components/Enemy.js';
import FloatingText from './components/FloatingText.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import createMap from './components/Map.js';
import House from './components/House.js';
import Fence from './components/Fence.js';
import Forest from './components/Forest.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue instead of white

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

// Map
const mapGroup = createMap();
scene.add(mapGroup);

// Fence boundary
const fence = new Fence();
scene.add(fence.group);

// Houses
// Rejection sampling: pick a random spot, reject if too close to the player spawn
// (origin) or to any previously-placed house. The house's real collision radius is
// only known after its GLB loads, so we use a conservative pre-known spacing.
const houses = [];
const HOUSE_COUNT = 10; // More visual density for 2000x2000 map
const HOUSE_SPAWN_RANGE = 400;        // Back to original for 1000x1000 map
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

// Forest background - created after houses so decorative trees can avoid them
const forest = new Forest(houses);
scene.add(forest.group);

// Player
const player = new Player();
scene.add(player.group);

// Camera
const camera = createCamera();
scene.add(camera);
const cameraOffset = new THREE.Vector3(300, -300, 300);
let inspectCameraPosition = new THREE.Vector3();
const CAMERA_MOVE_SPEED = 10; // Units per frame in inspect mode

// Enemies
const enemies = [];
const BASE_SPAWN_DELAY = 1000; // 1 second
const BASE_MAX_ENEMIES = 10;
const COMPLEXITY_GROWTH_FACTOR = 0.005; // Slower difficulty increase (was 0.01)
const SCALING_DELAY_SCORE = 100; // Delay scaling until score reaches this value
let spawnTimer = 0;

const spawnLocations = [
    new THREE.Vector3(350, 350, 0),
    new THREE.Vector3(-350, 350, 0),
    new THREE.Vector3(350, -350, 0),
    new THREE.Vector3(-350, -350, 0)
];

// Base values for scaling
const BASE_ENEMY_SPEED = 0.7;
const BASE_PLAYER_SPEED = 2.5;
const BASE_ATTACK_COOLDOWN = 1000;
const BASE_ATTACK_RADIUS = 50;

// Max/Min limits for scaling
const MIN_SPAWN_DELAY = 500;       // Slower spawn rate at max difficulty
const MAX_MAX_ENEMIES = 20;        // Cap at 20 enemies instead of 50
const MAX_ENEMY_SPEED = 1.8;       // Slower max speed (was 3.0)
const MAX_PLAYER_SPEED = 4.0;      // Slightly slower max (was 5.0)
const MIN_ATTACK_COOLDOWN = 400;   // Longer cooldown at max (was 200)
const MAX_ATTACK_RADIUS = 100;     // Smaller max radius (was 150)

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
let gameStarted = false;
let isPaused = false; // Pause state
let inspectMode = false; // Developer inspect mode
const floatingTexts = [];
const clock = new THREE.Clock();
let lastPlayerHealth = 3; // Track health to detect damage
const scoreElement = document.querySelector('.score');
const healthBarElement = document.querySelector('.health-bar');
const gameOverElement = document.querySelector('.game-over');
const startScreenElement = document.querySelector('.start-screen');
const inspectModeElement = document.querySelector('.inspect-mode');
const pauseMenuElement = document.querySelector('.pause-menu');
const pauseButtonUI = document.querySelector('.pause-button-ui');

function updateHealthUI() {
    if (!healthBarElement) return;
    
    const health = player.getHealth();
    healthBarElement.innerHTML = '';
    
    for (let i = 0; i < health.max; i++) {
        const heartContainer = document.createElement('div');
        heartContainer.className = 'heart';
        
        if (i < health.current) {
            // Full heart - show colored toad
            const img = document.createElement('img');
            img.src = '/tode.svg';
            img.alt = 'Health';
            heartContainer.appendChild(img);
        } else {
            // Empty heart - show grayscale/faded toad
            const img = document.createElement('img');
            img.src = '/tode.svg';
            img.alt = 'Lost Health';
            heartContainer.classList.add('empty');
            heartContainer.appendChild(img);
        }
        
        healthBarElement.appendChild(heartContainer);
    }
}

function showDamageFlash() {
    const flash = document.createElement('div');
    flash.className = 'damage-flash';
    document.body.appendChild(flash);
    
    // Remove after animation completes
    setTimeout(() => {
        document.body.removeChild(flash);
    }, 300);
}

function spawnEnemy() {
    if (isGameOver || enemies.length >= currentMaxEnemies) return;
    
    // Try to find a valid spawn location that's not blocked
    const maxAttempts = 10;
    let spawnPos = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const location = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
        
        // Check if this location is blocked by houses
        const blockedByHouse = houses.some(house => {
            const distance = location.distanceTo(house.group.position);
            return distance < 100; // Conservative check: 100 units clearance
        });
        
        // Check if blocked by trees
        const blockedByTree = forest.checkTreeCollision(location, 30);
        
        // Check if too close to player (at least 150 units away)
        const tooCloseToPlayer = location.distanceTo(player.group.position) < 150;
        
        if (!blockedByHouse && !blockedByTree && !tooCloseToPlayer) {
            spawnPos = location;
            break;
        }
    }
    
    // If we couldn't find a valid spawn, use a fallback dynamic position
    if (!spawnPos) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 350;
        spawnPos = new THREE.Vector3(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            0
        );
    }
    
    enemies.push(new Enemy(scene, player, spawnPos));
}

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    if (gameOverElement) gameOverElement.style.display = 'block';
    if (pauseButtonUI) pauseButtonUI.style.display = 'none'; // Hide pause button on game over
    player.group.visible = false;
    // Update health UI one final time to show 0 hearts
    updateHealthUI();
    // Clear held keys
    keysPressed.clear();
}

function togglePause() {
    // Can't pause if game hasn't started or is over
    if (!gameStarted || isGameOver) return;
    
    isPaused = !isPaused;
    
    if (pauseMenuElement) {
        pauseMenuElement.style.display = isPaused ? 'flex' : 'none';
    }
    
    // Hide pause button when paused, show when playing
    if (pauseButtonUI) {
        pauseButtonUI.style.display = isPaused ? 'none' : 'flex';
    }
    
    // Clear held keys when pausing
    if (isPaused) {
        keysPressed.clear();
    }
}

// Pause button click handler
if (pauseButtonUI) {
    pauseButtonUI.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent triggering other click handlers
        togglePause();
    });
}

function resetGame() {
    isGameOver = false;
    if (gameOverElement) gameOverElement.style.display = 'none';
    if (pauseButtonUI) pauseButtonUI.style.display = 'flex'; // Show pause button when game resets
    
    // Reset player
    player.group.position.set(0, 0, 0);
    player.group.visible = true;
    player.isMoving = false;
    player.progress = 0;
    player.startPosition.set(0, 0, 0);
    player.targetPosition.set(0, 0, 0);
    
    // Reset health
    player.currentHealth = player.maxHealth;
    player.isInvulnerable = false;
    lastPlayerHealth = player.maxHealth;
    updateHealthUI();
    
    // Reset player model position to ground level
    if (player.model) {
        player.model.position.z = player.baseZ;
    }
    
    // Reset player shadow opacity
    if (player.shadow) {
        player.shadow.material.opacity = 0.3;
    }

    // Clear held keys
    keysPressed.clear();

    // Reset score
    score = 0;
    if (scoreElement) scoreElement.textContent = `Score: 0`;
    
    // Reset difficulty parameters
    currentSpawnDelay = BASE_SPAWN_DELAY;
    currentMaxEnemies = BASE_MAX_ENEMIES;
    currentEnemySpeed = BASE_ENEMY_SPEED;
    currentPlayerSpeed = BASE_PLAYER_SPEED;
    currentPlayerAttackCooldown = BASE_ATTACK_COOLDOWN;
    currentPlayerAttackRadius = BASE_ATTACK_RADIUS;
    spawnTimer = 0;

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

    // Respawn enemies at corners with validation
    for (let i = 0; i < spawnLocations.length; i++) {
        const location = spawnLocations[i];
        
        // Check if this location is blocked by houses or trees
        const blockedByHouse = houses.some(house => {
            const distance = location.distanceTo(house.group.position);
            return distance < 100; // Conservative check: 100 units clearance
        });
        
        const blockedByTree = forest.checkTreeCollision(location, 30);
        
        // If blocked, find an alternative position nearby
        let spawnPos = location;
        if (blockedByHouse || blockedByTree) {
            // Try offsets in different directions
            const offsets = [
                new THREE.Vector3(100, 0, 0),
                new THREE.Vector3(-100, 0, 0),
                new THREE.Vector3(0, 100, 0),
                new THREE.Vector3(0, -100, 0),
                new THREE.Vector3(70, 70, 0),
                new THREE.Vector3(-70, 70, 0),
                new THREE.Vector3(70, -70, 0),
                new THREE.Vector3(-70, -70, 0)
            ];
            
            for (const offset of offsets) {
                const testPos = location.clone().add(offset);
                const houseBlocked = houses.some(house => testPos.distanceTo(house.group.position) < 100);
                const treeBlocked = forest.checkTreeCollision(testPos, 30);
                
                if (!houseBlocked && !treeBlocked) {
                    spawnPos = testPos;
                    break;
                }
            }
        }
        
        enemies.push(new Enemy(scene, player, spawnPos));
    }

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

// Input collection - Key state tracking for hold-to-move
const keysPressed = new Set();

// Map WASD to Arrow keys
const keyMap = {
    'KeyW': 'ArrowUp',
    'KeyS': 'ArrowDown',
    'KeyA': 'ArrowLeft',
    'KeyD': 'ArrowRight',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight'
};

window.addEventListener('keydown', (event) => {
    // Handle start screen
    if (!gameStarted && event.code === 'Space') {
        gameStarted = true;
        if (startScreenElement) startScreenElement.style.display = 'none';
        if (pauseButtonUI) pauseButtonUI.style.display = 'flex'; // Show pause button when game starts
        clock.getDelta(); // Reset clock when game starts
        updateHealthUI(); // Initialize health display
        return;
    }

    if (!gameStarted) return;
    
    // Handle ESC key for pause (works during gameplay)
    if (event.code === 'Escape') {
        togglePause();
        return;
    }
    
    // Don't process other keys if paused
    if (isPaused) return;

    // Toggle inspect mode (works even if game over)
    if (event.code === 'KeyI') {
        inspectMode = !inspectMode;
        if (inspectModeElement) {
            inspectModeElement.style.display = inspectMode ? 'block' : 'none';
        }
        
        // Store camera position when entering inspect mode
        if (inspectMode) {
            inspectCameraPosition.copy(camera.position);
        }
        
        console.log('Inspect Mode:', inspectMode ? 'ON' : 'OFF');
        return;
    }

    if (isGameOver) {
        if (event.code === 'Space') {
            resetGame();
        }
        return;
    }
    
    // Check if it's a movement key (Arrow or WASD)
    if (keyMap[event.code]) {
        keysPressed.add(keyMap[event.code]);
        event.preventDefault(); // Prevent browser scrolling
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

// Track key releases for hold-to-move
window.addEventListener('keyup', (event) => {
    if (keyMap[event.code]) {
        keysPressed.delete(keyMap[event.code]);
    }
});

// Mouse click support for start/restart/pause
window.addEventListener('click', (event) => {
    // Only start game if clicking the start button
    if (!gameStarted) {
        const startButton = document.querySelector('.start-button');
        if (startButton && (event.target === startButton || startButton.contains(event.target))) {
            gameStarted = true;
            if (startScreenElement) startScreenElement.style.display = 'none';
            if (pauseButtonUI) pauseButtonUI.style.display = 'flex'; // Show pause button when game starts
            clock.getDelta(); // Reset clock when game starts
            updateHealthUI(); // Initialize health display
        }
        return;
    }
    
    // Resume from pause - only if clicking the pause button or dark overlay (not the pause content panel)
    if (isPaused && pauseMenuElement && pauseMenuElement.style.display !== 'none') {
        const pauseContent = document.querySelector('.pause-content');
        const pauseButton = document.querySelector('.pause-button');
        
        // Check if click is on the resume button OR outside the content panel (on dark overlay)
        if (event.target.classList.contains('pause-button') || 
            event.target === pauseMenuElement ||
            pauseButton?.contains(event.target)) {
            togglePause();
        }
        return;
    }
    
    if (isGameOver) {
        resetGame();
    }
});

// Animation loop
// Clamp dt to avoid huge jumps after tab-blur / GC pause / breakpoints,
// which would otherwise teleport enemies past the player in a single tick.
const MAX_DELTA_TIME = 0.1; // seconds

renderer.setAnimationLoop(() => {
    const deltaTime = Math.min(clock.getDelta(), MAX_DELTA_TIME);

    // Always render, but only update game logic if started
    if (!gameStarted) {
        renderer.render(scene, camera);
        return;
    }

    if (isGameOver) {
        renderer.render(scene, camera);
        return;
    }
    
    // Don't update game logic if paused
    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    // Update score based on survival time (pause score in inspect mode)
    if (!inspectMode) {
        score += deltaTime * SCORE_PER_SECOND;
    }

    // Difficulty scaling logic
    const difficultyFactor = Math.max(0, score - SCALING_DELAY_SCORE) * COMPLEXITY_GROWTH_FACTOR;
    
    // Enemy and player parameters scale at similar rates now
    const enemyScalingFactor = difficultyFactor * 1.0;  // Reduced from 1.5 to 1.0
    const playerScalingFactor = difficultyFactor;

    currentSpawnDelay = Math.max(MIN_SPAWN_DELAY, BASE_SPAWN_DELAY / (1 + enemyScalingFactor));
    currentMaxEnemies = Math.min(MAX_MAX_ENEMIES, Math.floor(BASE_MAX_ENEMIES * (1 + enemyScalingFactor * 0.5)));
    currentEnemySpeed = Math.min(MAX_ENEMY_SPEED, BASE_ENEMY_SPEED * (1 + enemyScalingFactor));

    currentPlayerSpeed = Math.min(MAX_PLAYER_SPEED, BASE_PLAYER_SPEED * (1 + playerScalingFactor * 0.5));
    currentPlayerAttackCooldown = Math.max(MIN_ATTACK_COOLDOWN, BASE_ATTACK_COOLDOWN / (1 + playerScalingFactor));
    currentPlayerAttackRadius = Math.min(MAX_ATTACK_RADIUS, BASE_ATTACK_RADIUS * (1 + playerScalingFactor * 0.2));

    // Enemy spawning with accumulated timer (disabled in inspect mode)
    if (!inspectMode) {
        spawnTimer += deltaTime * 1000; // convert to ms
        if (spawnTimer >= currentSpawnDelay) {
            spawnEnemy();
            spawnTimer = 0;
        }
    }
    
    // Update UI
    if (scoreElement) {
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
    }
    
    // Check if player took damage
    const currentHealth = player.getHealth().current;
    if (currentHealth < lastPlayerHealth) {
        showDamageFlash();
    }
    lastPlayerHealth = currentHealth;
    
    updateHealthUI();

    // In inspect mode: move camera with WASD/arrows, otherwise move player
    if (inspectMode) {
        // Camera movement in inspect mode
        if (keysPressed.size > 0) {
            keysPressed.forEach(direction => {
                if (direction === 'ArrowUp') {
                    inspectCameraPosition.y += CAMERA_MOVE_SPEED;
                } else if (direction === 'ArrowDown') {
                    inspectCameraPosition.y -= CAMERA_MOVE_SPEED;
                } else if (direction === 'ArrowLeft') {
                    inspectCameraPosition.x -= CAMERA_MOVE_SPEED;
                } else if (direction === 'ArrowRight') {
                    inspectCameraPosition.x += CAMERA_MOVE_SPEED;
                }
            });
        }
        
        // Smooth camera movement in inspect mode
        camera.position.lerp(inspectCameraPosition.clone().add(cameraOffset), 0.1);
        
        // Calculate lookAt point (where camera is centered)
        const lookAtPoint = inspectCameraPosition.clone();
        camera.lookAt(lookAtPoint);
    } else {
        // Normal mode: player movement and camera follows player
        if (!player.isMoving && keysPressed.size > 0) {
            // Use the most recently pressed key (last key wins)
            const nextMove = Array.from(keysPressed).pop();
            const collision = player.move(nextMove, enemies, houses, fence, forest);
            // Only trigger game over if not in inspect mode
            if (collision) {
                triggerGameOver();
            }
        }

        // Smooth camera follow player
        const targetCameraPos = player.group.position.clone().add(cameraOffset);
        camera.position.lerp(targetCameraPos, 0.05);
        camera.lookAt(player.group.position);
    }

    // player.update for visual updates (collision damage disabled in inspect mode)
    const playerCollision = player.update(deltaTime, currentPlayerSpeed, currentPlayerAttackCooldown, currentPlayerAttackRadius, enemies);
    if (playerCollision && !inspectMode) {
        triggerGameOver();
    }

    // Update enemies (frozen in inspect mode)
    if (!inspectMode) {
        for (const enemy of enemies) {
            if (enemy.update(deltaTime, enemies, currentEnemySpeed, houses, fence, forest)) {
                triggerGameOver();
                break;
            }
        }
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        if (!floatingTexts[i].update()) {
            floatingTexts.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
});

