import * as THREE from 'three';
import './style.css';
import Player from './components/Player.js';
import Enemy from './components/Enemy.js';
import FloatingText from './components/FloatingText.js';
import PowerUp, { PowerUpType } from './components/PowerUp.js';
import SmokeParticle from './components/SmokeParticle.js';
import { createCamera } from './components/Camera.js';
import { createRenderer } from './components/Renderer.js';
import createMap from './components/Map.js';
import House from './components/House.js';
import Fence from './components/Fence.js';
import Forest from './components/Forest.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(-100, -100, 200);
scene.add(directionalLight);

const mapGroup = createMap();
scene.add(mapGroup);

const fence = new Fence();
scene.add(fence.group);

// Rejection sampling for house placement: reject positions too close to origin or existing houses.
// Conservative fixed spacing because actual collision radius is only known after GLB loads.
const houses = [];
const HOUSE_COUNT = 10;
const HOUSE_SPAWN_RANGE = 400;
const MIN_HOUSE_SPACING = 180;
const PLAYER_SPAWN_BUFFER = 120;
const MAX_SPAWN_ATTEMPTS = 30;

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

// Forest is created after houses so trees avoid overlapping them
const forest = new Forest(houses);
scene.add(forest.group);

const player = new Player();
scene.add(player.group);

const camera = createCamera();
scene.add(camera);
const cameraOffset = new THREE.Vector3(300, -300, 300);
let inspectCameraPosition = new THREE.Vector3();
const CAMERA_MOVE_SPEED = 10;

let cameraShakeIntensity = 0;
let cameraShakeDuration = 0;
const CAMERA_SHAKE_MAX_INTENSITY = 15;
const CAMERA_SHAKE_DURATION = 500;

const enemies = [];
const BASE_SPAWN_DELAY = 1000;
const BASE_MAX_ENEMIES = 10;
const COMPLEXITY_GROWTH_FACTOR = 0.005;
const SCALING_DELAY_SCORE = 100;
let spawnTimer = 0;

// Spawn points distributed around the inner forest ring so enemies emerge from the trees
const SPAWN_FOREST_MIN = 560;
const SPAWN_FOREST_MAX = 630;
const SPAWN_COUNT = 40;

function buildSpawnLocations() {
    const pts = [];
    for (let i = 0; i < SPAWN_COUNT; i++) {
        const angle = (i / SPAWN_COUNT) * Math.PI * 2;
        const radius = SPAWN_FOREST_MIN + Math.random() * (SPAWN_FOREST_MAX - SPAWN_FOREST_MIN);
        pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return pts;
}
const spawnLocations = buildSpawnLocations();
let lastSpawnIndex = -1;

const BASE_ENEMY_SPEED = 0.7;
const BASE_PLAYER_SPEED = 2.5;
const BASE_ATTACK_COOLDOWN = 1000;
const BASE_ATTACK_RADIUS = 50;

const MIN_SPAWN_DELAY = 500;
const MAX_MAX_ENEMIES = 20;
const MAX_ENEMY_SPEED = 1.8;
const MAX_PLAYER_SPEED = 4.0;
const MIN_ATTACK_COOLDOWN = 400;
const MAX_ATTACK_RADIUS = 100;

let currentSpawnDelay = BASE_SPAWN_DELAY;
let currentMaxEnemies = BASE_MAX_ENEMIES;
let currentEnemySpeed = BASE_ENEMY_SPEED;
let currentPlayerSpeed = BASE_PLAYER_SPEED;
let currentPlayerAttackCooldown = BASE_ATTACK_COOLDOWN;
let currentPlayerAttackRadius = BASE_ATTACK_RADIUS;

const SCORE_PER_SECOND = 0.1;
const SCORE_PER_KILL = 10;

const powerUps = [];
const POWERUP_SPAWN_BASE_INTERVAL = 8000;
const POWERUP_SPAWN_VARIANCE = 4000;
let powerUpSpawnTimer = 0;
let nextPowerUpSpawnDelay = POWERUP_SPAWN_BASE_INTERVAL;

// Max instances of each power-up type allowed on the map simultaneously
const MAX_POWERUPS_PER_TYPE = {
    [PowerUpType.HEALTH]: 3,
    [PowerUpType.SPEED]: 2,
    [PowerUpType.ATTACK_RANGE]: 2,
    [PowerUpType.INVINCIBILITY]: 2
};

function countPowerUpsByType(type) {
    return powerUps.filter(p => p.type === type).length;
}

function getRandomPowerUpInterval() {
    return POWERUP_SPAWN_BASE_INTERVAL + (Math.random() - 0.5) * 2 * POWERUP_SPAWN_VARIANCE;
}

function spawnPowerUp() {
    // Weight health drops higher (3 entries ≈ 35%) vs others (2 entries ≈ 25%/20%/20%)
    const availableTypes = [];
    if (countPowerUpsByType(PowerUpType.HEALTH) < MAX_POWERUPS_PER_TYPE[PowerUpType.HEALTH])
        availableTypes.push(PowerUpType.HEALTH, PowerUpType.HEALTH, PowerUpType.HEALTH);
    if (countPowerUpsByType(PowerUpType.SPEED) < MAX_POWERUPS_PER_TYPE[PowerUpType.SPEED])
        availableTypes.push(PowerUpType.SPEED, PowerUpType.SPEED);
    if (countPowerUpsByType(PowerUpType.ATTACK_RANGE) < MAX_POWERUPS_PER_TYPE[PowerUpType.ATTACK_RANGE])
        availableTypes.push(PowerUpType.ATTACK_RANGE, PowerUpType.ATTACK_RANGE);
    if (countPowerUpsByType(PowerUpType.INVINCIBILITY) < MAX_POWERUPS_PER_TYPE[PowerUpType.INVINCIBILITY])
        availableTypes.push(PowerUpType.INVINCIBILITY, PowerUpType.INVINCIBILITY);

    if (availableTypes.length === 0) return;

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const tileSize = 50;

    for (let attempt = 0; attempt < 30; attempt++) {
        const x = Math.round(((Math.random() - 0.5) * 800) / tileSize) * tileSize;
        const y = Math.round(((Math.random() - 0.5) * 800) / tileSize) * tileSize;
        const pos = new THREE.Vector3(x, y, 0);

        const tooCloseToHouse = houses.some(h => pos.distanceTo(h.group.position) < 100);
        const tooCloseToTree = forest && forest.checkTreeCollision(pos, 30);
        const tooCloseToPlayer = pos.distanceTo(player.group.position) < 100;
        const tooCloseToEnemy = enemies.some(e => pos.distanceTo(e.group.position) < 80);

        if (!tooCloseToHouse && !tooCloseToTree && !tooCloseToPlayer && !tooCloseToEnemy) {
            powerUps.push(new PowerUp(scene, pos, type));
            return;
        }
    }
}

// Scoring state
let score = 0;
let enemiesKilled = 0;
let gameStartTime = 0;
let isGameOver = false;
let gameStarted = false;
let isPaused = false;
const DEV_MODE = false; // Set true locally to enable inspect camera
let inspectMode = false;
const floatingTexts = [];
const smokeParticles = [];

// High score system
const HIGH_SCORE_KEY = 'todes_life_high_score';

function getHighScore() {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    return stored ? parseInt(stored, 10) : 0;
}

function setHighScore(score) {
    localStorage.setItem(HIGH_SCORE_KEY, score.toString());
}

function isNewHighScore(score) {
    return score > getHighScore();
}
const clock = new THREE.Clock();
let lastPlayerHealth = 3; // Track health to detect damage
const scoreElement = document.querySelector('.score');
const healthBarElement = document.querySelector('.health-bar');
const specialAttackUI = document.querySelector('.special-attack-ui');
const specialAttackFill = document.querySelector('.special-attack-fill');
const powerupStatusElement = document.querySelector('.powerup-status');
const powerupArrowsElement = document.querySelector('.powerup-arrows');
const gameOverElement = document.querySelector('.game-over');
const startScreenElement = document.querySelector('.start-screen');
const inspectModeElement = document.querySelector('.inspect-mode');
const pauseMenuElement = document.querySelector('.pause-menu');

if (DEV_MODE) {
    const pauseControls = document.querySelector('.pause-controls');
    if (pauseControls) {
        const devGroup = document.createElement('div');
        devGroup.className = 'control-group';
        devGroup.innerHTML = '<span class="control-key">I</span><span class="control-description">Inspect Mode (Dev)</span>';
        pauseControls.appendChild(devGroup);
    }
}
const pauseButtonUI = document.querySelector('.pause-button-ui');

// Inject high score display into start screen
function updateStartScreenHighScore() {
    const highScore = getHighScore();
    if (highScore > 0) {
        const startContent = document.querySelector('.start-content h1');
        if (startContent) {
            // Check if high score display already exists
            let highScoreDiv = document.querySelector('.start-high-score');
            if (!highScoreDiv) {
                highScoreDiv = document.createElement('div');
                highScoreDiv.className = 'start-high-score';
                startContent.insertAdjacentElement('afterend', highScoreDiv);
            }
            highScoreDiv.textContent = `High Score: ${highScore}`;
        }
    }
}

// Initialize high score display on load
updateStartScreenHighScore();

function dismissStartScreen(callback) {
    if (!startScreenElement) { callback(); return; }
    startScreenElement.classList.add('exiting');
    setTimeout(() => {
        startScreenElement.style.display = 'none';
        startScreenElement.classList.remove('exiting');
        callback();
    }, 350);
}

function showSurviveStrip() {
    const strip = document.createElement('div');
    strip.className = 'survive-strip';
    strip.innerHTML = '<span>Survive as long as possible!</span>';
    document.body.appendChild(strip);
    // Remove from DOM after animation completes (2.6s)
    setTimeout(() => strip.remove(), 2700);
}

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

function shakeHealthBar() {
    if (healthBarElement) {
        healthBarElement.classList.add('shake');
        setTimeout(() => healthBarElement.classList.remove('shake'), 500);
    }
}

function updateSpecialAttackUI() {
    if (!specialAttackFill || !specialAttackUI) return;
    
    const progress = player.getSpecialAttackProgress();
    specialAttackFill.style.width = `${progress * 100}%`;
    
    // Add pulsing effect when ready
    if (progress >= 1) {
        specialAttackUI.classList.add('ready');
    } else {
        specialAttackUI.classList.remove('ready');
    }
}

const POWERUP_CONFIG = {
    health:       { icon: '❤️',  color: '#ff4444', label: 'HEALTH' },
    speed:        { icon: '⚡',  color: '#ffd700', label: 'SPEED'  },
    attack_range: { icon: '🔥', color: '#00bfff', label: 'ATTACK' },
    invincibility:{ icon: '🛡️', color: '#9c27b0', label: 'SHIELD' },
};

function updatePowerupArrows() {
    if (!powerupArrowsElement) return;
    powerupArrowsElement.innerHTML = '';
    if (!powerUps.length) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const EDGE = 50; // distance from screen edge

    powerUps.forEach(powerUp => {
        // Project world position to screen coordinates
        const pos3D = powerUp.group.position.clone();
        pos3D.project(camera);

        const sx = (pos3D.x * 0.5 + 0.5) * W;
        const sy = (-pos3D.y * 0.5 + 0.5) * H;

        // Only show arrow when power-up is off-screen
        const onScreen = sx > 0 && sx < W && sy > 0 && sy < H && pos3D.z < 1;
        if (onScreen) return;

        // When the power-up is behind the camera (pos3D.z >= 1), the projected
        // NDC coordinates are mirrored — negate to get the true screen direction.
        const cx = W / 2, cy = H / 2;
        let dx = sx - cx, dy = sy - cy;
        if (pos3D.z >= 1) { dx = -dx; dy = -dy; }
        const angle = Math.atan2(dy, dx);

        // Find edge intersection
        const absDx = Math.abs(dx), absDy = Math.abs(dy);
        let ex, ey;
        if (absDx / (W / 2 - EDGE) > absDy / (H / 2 - EDGE)) {
            // Hits left/right edge
            ex = cx + Math.sign(dx) * (W / 2 - EDGE);
            ey = cy + Math.tan(angle) * Math.sign(dx) * (W / 2 - EDGE);
        } else {
            // Hits top/bottom edge
            ey = cy + Math.sign(dy) * (H / 2 - EDGE);
            ex = cx + (1 / Math.tan(angle)) * Math.sign(dy) * (H / 2 - EDGE);
        }
        ex = Math.max(EDGE, Math.min(W - EDGE, ex));
        ey = Math.max(EDGE, Math.min(H - EDGE, ey));

        const config = POWERUP_CONFIG[powerUp.type] || POWERUP_CONFIG.health;

        const el = document.createElement('div');
        el.className = 'powerup-arrow';
        el.style.left = `${ex}px`;
        el.style.top  = `${ey}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI / 2}rad)`;
        el.style.color = config.color;
        el.style.setProperty('--rotate', `rotate(${angle + Math.PI / 2}rad)`);
        el.innerHTML = `
            <div class="arrow-icon">${config.icon}</div>
            <div class="arrow-label" style="transform: rotate(${-(angle + Math.PI / 2)}rad)">▼</div>
        `;
        powerupArrowsElement.appendChild(el);
    });
}

function updatePowerupUI() {
    if (!powerupStatusElement) return;
    
    powerupStatusElement.innerHTML = '';
    
    // Speed boost
    if (player.activeEffects.speedBoost) {
        const timeLeft = Math.ceil(player.effectTimers.speedBoost / 1000);
        const indicator = document.createElement('div');
        indicator.className = 'powerup-indicator speed';
        indicator.innerHTML = `
            <span class="icon">⚡</span>
            <span>SPEED BOOST</span>
            <span class="timer">${timeLeft}s</span>
        `;
        powerupStatusElement.appendChild(indicator);
    }
    
    // Attack range boost
    if (player.activeEffects.attackRangeBoost) {
        const timeLeft = Math.ceil(player.effectTimers.attackRangeBoost / 1000);
        const indicator = document.createElement('div');
        indicator.className = 'powerup-indicator attack';
        indicator.innerHTML = `
            <span class="icon">🔥</span>
            <span>ATTACK BOOST</span>
            <span class="timer">${timeLeft}s</span>
        `;
        powerupStatusElement.appendChild(indicator);
    }
    
    // Invincibility shield
    if (player.activeEffects.invincibilityShield) {
        const timeLeft = Math.ceil(player.effectTimers.invincibilityShield / 1000);
        const indicator = document.createElement('div');
        indicator.className = 'powerup-indicator shield';
        indicator.innerHTML = `
            <span class="icon">🛡️</span>
            <span>SHIELD</span>
            <span class="timer">${timeLeft}s</span>
        `;
        powerupStatusElement.appendChild(indicator);
    }
}

function spawnEnemy() {
    if (isGameOver || enemies.length >= currentMaxEnemies) return;
    
    // Build a shuffled candidate list, excluding the last used index to avoid clustering
    const indices = spawnLocations
        .map((_, i) => i)
        .filter(i => i !== lastSpawnIndex)
        .sort(() => Math.random() - 0.5);
    
    for (const idx of indices) {
        const location = spawnLocations[idx];
        
        const blockedByHouse = houses.some(h => location.distanceTo(h.group.position) < 100);
        const blockedByTree  = forest.checkTreeCollision(location, 40);
        const tooCloseToPlayer = location.distanceTo(player.group.position) < 150;
        // Don't stack too many enemies at one spot
        const crowded = enemies.filter(e => location.distanceTo(e.group.position) < 80).length >= 2;
        
        if (!blockedByHouse && !blockedByTree && !tooCloseToPlayer && !crowded) {
            lastSpawnIndex = idx;
            enemies.push(new Enemy(scene, player, location));
            return;
        }
    }
    // All edge points exhausted — skip this spawn tick rather than spawning inside the map
}

function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    
    const timeSurvived = Math.floor((Date.now() - gameStartTime) / 1000);
    const finalScore = Math.floor(score);
    const previousHighScore = getHighScore();
    const isNewHigh = isNewHighScore(finalScore);
    
    if (isNewHigh) setHighScore(finalScore);
    
    if (gameOverElement) {
        const highScoreHTML = isNewHigh
            ? `<div class="new-high-score-badge">🎉 NEW HIGH SCORE! 🎉</div>`
            : `<div class="high-score-display">High Score: ${previousHighScore}</div>`;
        
        // Phase 1: show header only
        gameOverElement.innerHTML = `
            <div class="game-over-content">
                <h1><img src="/tode.svg" class="game-over-tode-icon" alt="Tode"/> GAME OVER</h1>
                ${highScoreHTML}
                <div class="game-over-stats-wrap" style="opacity:0; transform:translateY(20px); transition: opacity 0.4s ease 0s, transform 0.4s ease 0s;">
                    <div class="stat-item-hero">
                        <span class="stat-label">Final Score</span>
                        <span class="stat-value">${finalScore}</span>
                    </div>
                    <div class="game-stats">
                        <div class="stat-item">
                            <span class="stat-label">Enemies Defeated</span>
                            <span class="stat-value">⚔️ ${enemiesKilled}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Time Survived</span>
                            <span class="stat-value">⏱ ${Math.floor(timeSurvived / 60)}:${String(timeSurvived % 60).padStart(2, '0')}</span>
                        </div>
                    </div>
                    <div class="restart-button" style="opacity:0; pointer-events:none;">Press SPACE or Click to Restart</div>
                </div>
            </div>
        `;
        gameOverElement.style.display = 'flex';
        requestAnimationFrame(() => gameOverElement.classList.add('entering'));
        
        // Phase 2: reveal stats after the panel has slid in
        setTimeout(() => {
            const wrap = gameOverElement.querySelector('.game-over-stats-wrap');
            if (wrap) {
                wrap.style.opacity = '1';
                wrap.style.transform = 'translateY(0)';
            }
        }, 500);
        
        // Phase 3: reveal restart button and unlock input after an additional pause
        setTimeout(() => {
            const btn = gameOverElement.querySelector('.restart-button');
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.style.transition = 'opacity 0.3s ease';
            }
            gameOverElement.dataset.restartReady = 'true';
        }, 1800);
    }
    
    if (pauseButtonUI) pauseButtonUI.style.display = 'none';
    if (specialAttackUI) specialAttackUI.style.display = 'none';
    player.group.visible = false;
    
    // Reset power-up effects immediately
    player.activeEffects = {
        speedBoost: false,
        attackRangeBoost: false,
        invincibilityShield: false
    };
    player.effectTimers = {
        speedBoost: 0,
        attackRangeBoost: 0,
        invincibilityShield: 0
    };
    
    // Update health UI one final time to show 0 hearts
    updateHealthUI();
    // Update power-up UI to clear any active effects
    updatePowerupUI();
    // Clear held keys
    keysPressed.clear();
}

function togglePause() {
    if (!gameStarted || isGameOver) return;
    
    isPaused = !isPaused;
    
    if (pauseMenuElement) {
        if (isPaused) {
            pauseMenuElement.style.display = 'flex';
            pauseMenuElement.classList.remove('exiting');
            pauseMenuElement.classList.add('entering');
        } else {
            pauseMenuElement.classList.remove('entering');
            pauseMenuElement.classList.add('exiting');
            setTimeout(() => {
                pauseMenuElement.style.display = 'none';
                pauseMenuElement.classList.remove('exiting');
            }, 200);
        }
    }
    
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
    if (gameOverElement) {
        gameOverElement.style.display = 'none';
        gameOverElement.classList.remove('entering');
        delete gameOverElement.dataset.restartReady;
    }
    if (pauseButtonUI) pauseButtonUI.style.display = 'flex'; // Show pause button when game resets
    if (specialAttackUI) specialAttackUI.style.display = 'block';
    
    // Reset game stats
    score = 0;
    enemiesKilled = 0;
    gameStartTime = Date.now();
    
    // Reset player
    player.group.position.set(0, 0, 0);
    player.group.visible = true;
    player.isMoving = false;
    player.progress = 0;
    player.startPosition.set(0, 0, 0);
    player.targetPosition.set(0, 0, 0);
    
    // Reset health
    player.currentHealth = player.maxHealth;
    
    // Reset power-up effects
    player.activeEffects = {
        speedBoost: false,
        attackRangeBoost: false,
        invincibilityShield: false
    };
    player.effectTimers = {
        speedBoost: 0,
        attackRangeBoost: 0,
        invincibilityShield: 0
    };
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
    
    // Clear power-ups
    powerUps.forEach(powerUp => {
        powerUp.destroy();
    });
    powerUps.length = 0;
    powerUpSpawnTimer = 0;
    nextPowerUpSpawnDelay = getRandomPowerUpInterval(); // Reset with random delay

    // Clear floating texts
    floatingTexts.forEach(text => {
        scene.remove(text.sprite);
        if (text.sprite.material.map) text.sprite.material.map.dispose();
        text.sprite.material.dispose();
    });
    floatingTexts.length = 0;

    // Spawn initial enemies at 4 well-separated points within the forest ring
    const initialCorners = [
        new THREE.Vector3( Math.cos(Math.PI * 0.25) * 600,  Math.sin(Math.PI * 0.25) * 600, 0),
        new THREE.Vector3( Math.cos(Math.PI * 0.75) * 600,  Math.sin(Math.PI * 0.75) * 600, 0),
        new THREE.Vector3( Math.cos(Math.PI * 1.25) * 600,  Math.sin(Math.PI * 1.25) * 600, 0),
        new THREE.Vector3( Math.cos(Math.PI * 1.75) * 600,  Math.sin(Math.PI * 1.75) * 600, 0),
    ];
    lastSpawnIndex = -1;
    
    for (const location of initialCorners) {
        const blockedByHouse = houses.some(h => location.distanceTo(h.group.position) < 100);
        const blockedByTree  = forest.checkTreeCollision(location, 40);
        
        let spawnPos = location;
        if (blockedByHouse || blockedByTree) {
            // Walk along the same edge to find a clear point
            const candidates = spawnLocations.filter(
                p => !houses.some(h => p.distanceTo(h.group.position) < 100) &&
                     !forest.checkTreeCollision(p, 40)
            );
            if (candidates.length) {
                spawnPos = candidates[Math.floor(Math.random() * candidates.length)];
            }
        }
        enemies.push(new Enemy(scene, player, spawnPos));
    }

    // Reset clock
    clock.getDelta();
    showSurviveStrip();
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
        gameStartTime = Date.now();
        dismissStartScreen(() => {});
        if (pauseButtonUI) pauseButtonUI.style.display = 'flex';
        if (specialAttackUI) specialAttackUI.style.display = 'block';
        clock.getDelta();
        updateHealthUI();
        showSurviveStrip();
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

    if (DEV_MODE && event.code === 'KeyI') {
        inspectMode = !inspectMode;
        if (inspectModeElement) {
            inspectModeElement.style.display = inspectMode ? 'block' : 'none';
        }
        if (inspectMode) inspectCameraPosition.copy(camera.position);
        return;
    }

    if (isGameOver) {
        if (event.code === 'Space' && gameOverElement?.dataset.restartReady === 'true') {
            resetGame();
        }
        return;
    }
    
    // Check if it's a movement key (Arrow or WASD)
    if (keyMap[event.code]) {
        keysPressed.add(keyMap[event.code]);
        event.preventDefault(); // Prevent browser scrolling
    } else if (event.code === 'Space') {
        const effectiveAttackRadius = currentPlayerAttackRadius * player.getAttackRangeMultiplier();
        const { kills, positions } = player.attack(enemies, scene, effectiveAttackRadius, currentPlayerAttackCooldown);
        if (kills > 0) {
            score += kills * SCORE_PER_KILL;
            enemiesKilled += kills;
            positions.forEach(pos => {
                floatingTexts.push(new FloatingText(scene, `+${SCORE_PER_KILL}`, pos));
            });
        }
    } else if (event.code === 'KeyQ') {
        // Special Attack - Ground Slam
        const success = player.initiateSpecialAttack(enemies, houses, fence, forest);
        if (success) {
            console.log('Special Attack initiated!');
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
            gameStartTime = Date.now();
            dismissStartScreen(() => {});
            if (pauseButtonUI) pauseButtonUI.style.display = 'flex';
            if (specialAttackUI) specialAttackUI.style.display = 'block';
            clock.getDelta();
            updateHealthUI();
            showSurviveStrip();
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
    
    // Restart game - only if clicking the restart button
    if (isGameOver) {
        const restartButton = document.querySelector('.restart-button');
        if (restartButton && (event.target === restartButton || restartButton.contains(event.target))
            && gameOverElement?.dataset.restartReady === 'true') {
            resetGame();
        }
        return;
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
        spawnTimer += deltaTime * 1000;
        if (spawnTimer >= currentSpawnDelay) {
            spawnEnemy();
            spawnTimer = 0;
        }
        
        powerUpSpawnTimer += deltaTime * 1000;
        if (powerUpSpawnTimer >= nextPowerUpSpawnDelay) {
            spawnPowerUp();
            powerUpSpawnTimer = 0;
            nextPowerUpSpawnDelay = getRandomPowerUpInterval();
        }
    }
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.update(deltaTime, camera, player);
        
        if (powerUp.checkCollision(player.group.position, player.collisionRadius)) {
            let collected = false;
            
            switch (powerUp.type) {
                case PowerUpType.HEALTH:
                    collected = player.applyHealthPack();
                    if (collected) {
                        floatingTexts.push(new FloatingText(scene, powerUp.group.position, '+1 HEALTH', 0x00ff00));
                    }
                    break;
                case PowerUpType.SPEED:
                    player.applySpeedBoost(10000);
                    floatingTexts.push(new FloatingText(scene, powerUp.group.position, 'SPEED BOOST!', 0xffd700));
                    collected = true;
                    break;
                case PowerUpType.ATTACK_RANGE:
                    player.applyAttackRangeBoost(10000);
                    floatingTexts.push(new FloatingText(scene, powerUp.group.position, 'ATTACK BOOST!', 0x00bfff));
                    collected = true;
                    break;
                case PowerUpType.INVINCIBILITY:
                    player.applyInvincibilityShield(5000);
                    floatingTexts.push(new FloatingText(scene, powerUp.group.position, 'SHIELD!', 0x9c27b0));
                    collected = true;
                    break;
            }
            
            if (collected) {
                powerUp.destroy();
                powerUps.splice(i, 1);
            }
        }
    }
    
    if (scoreElement) {
        scoreElement.textContent = `Score: ${Math.floor(score)}`;
    }
    
    updateSpecialAttackUI();
    
    const currentHealth = player.getHealth().current;
    if (currentHealth < lastPlayerHealth) {
        showDamageFlash();
        shakeHealthBar();
    }
    lastPlayerHealth = currentHealth;
    
    updateHealthUI();
    updatePowerupUI();
    updatePowerupArrows();

    if (inspectMode) {
        if (keysPressed.size > 0) {
            keysPressed.forEach(direction => {
                if (direction === 'ArrowUp') inspectCameraPosition.y += CAMERA_MOVE_SPEED;
                else if (direction === 'ArrowDown') inspectCameraPosition.y -= CAMERA_MOVE_SPEED;
                else if (direction === 'ArrowLeft') inspectCameraPosition.x -= CAMERA_MOVE_SPEED;
                else if (direction === 'ArrowRight') inspectCameraPosition.x += CAMERA_MOVE_SPEED;
            });
        }
        camera.position.lerp(inspectCameraPosition.clone().add(cameraOffset), 0.1);
        camera.lookAt(inspectCameraPosition.clone());
    } else {
        if (!player.isMoving && keysPressed.size > 0) {
            const nextMove = Array.from(keysPressed).pop();
            const collision = player.move(nextMove, enemies, houses, fence, forest);
            if (collision) triggerGameOver();
        }
        const targetCameraPos = player.group.position.clone().add(cameraOffset);
        camera.position.lerp(targetCameraPos, 0.05);
        camera.lookAt(player.group.position);
    }

    const effectiveSpeed = currentPlayerSpeed * player.getSpeedMultiplier();
    const effectiveAttackRadius = currentPlayerAttackRadius * player.getAttackRangeMultiplier();
    const playerResult = player.update(deltaTime, effectiveSpeed, currentPlayerAttackCooldown, effectiveAttackRadius, enemies);
    
    if (playerResult && playerResult.specialAttackImpact) {
        const { kills, positions } = player.performSpecialAttackImpact(enemies, scene);
        if (kills > 0) {
            score += kills * SCORE_PER_KILL;
            enemiesKilled += kills;
            positions.forEach(pos => {
                floatingTexts.push(new FloatingText(scene, `+${SCORE_PER_KILL}`, pos));
            });
        }
        
        // Create smoke particles at impact
        smokeParticles.push(new SmokeParticle(scene, player.group.position.clone(), 30));
        
        // Trigger camera shake
        cameraShakeIntensity = CAMERA_SHAKE_MAX_INTENSITY;
        cameraShakeDuration = CAMERA_SHAKE_DURATION;
    }
    
    // Check for player death
    if (playerResult === true && !inspectMode) {
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

    // Update smoke particles
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        if (!smokeParticles[i].update()) {
            smokeParticles.splice(i, 1);
        }
    }

    // Apply camera shake
    if (cameraShakeDuration > 0) {
        cameraShakeDuration -= deltaTime * 1000; // Convert to ms
        const shakeProgress = cameraShakeDuration / CAMERA_SHAKE_DURATION;
        const currentIntensity = cameraShakeIntensity * shakeProgress;
        
        // Add random offset to camera position
        const shakeX = (Math.random() - 0.5) * currentIntensity * 2;
        const shakeY = (Math.random() - 0.5) * currentIntensity * 2;
        const shakeZ = (Math.random() - 0.5) * currentIntensity;
        
        camera.position.set(
            player.group.position.x + cameraOffset.x + shakeX,
            player.group.position.y + cameraOffset.y + shakeY,
            cameraOffset.z + shakeZ
        );
    }

    renderer.render(scene, camera);
});

