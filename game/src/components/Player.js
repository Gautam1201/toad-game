import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { checkCollision } from '../utils/collision.js';

const MOVE_SPEED = 2;
const JUMP_HEIGHT = 40;
const JUMP_DISTANCE = 50;
const ATTACK_RADIUS = 50;
const ATTACK_COOLDOWN = 1000; // 1 second in ms

// Reference frame rate the original per-frame constants were tuned for.
// Multiplying deltaTime by this keeps existing speed/progress constants calibrated
// while making the loop frame-rate independent.
const FRAME_RATE_REFERENCE = 60;

export default class Player {
    constructor() {
        this.group = new THREE.Group();
        this.loader = new GLTFLoader();
        this.model = null;

        // Movement state
        this.isMoving = false;
        this.progress = 0;
        this.direction = new THREE.Vector3();
        this.startPosition = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.baseZ = 0;
        this.collisionRadius = 0;

        // Attack state
        this.lastAttackTime = 0;
        this.attackCircle = null;
        this.cooldownDial = null;
        this.attackVisualDuration = 200; // ms
        this.attackVisualStartTime = 0;
        
        // Health system
        this.maxHealth = 3;
        this.currentHealth = 3;
        this.isInvulnerable = false;
        this.invulnerabilityDuration = 1000; // 1 second of invulnerability after taking damage
        this.lastDamageTime = 0;
        
        // Power-up effects
        this.activeEffects = {
            speedBoost: false,
            attackRangeBoost: false,
            invincibilityShield: false
        };
        this.effectTimers = {
            speedBoost: 0,
            attackRangeBoost: 0,
            invincibilityShield: 0
        };
        
        // Special attack system
        this.specialAttackReady = true;
        this.specialAttackCooldown = 8000; // 8 seconds to recharge
        this.lastSpecialAttackTime = 0;
        this.isPerformingSpecialAttack = false;
        this.specialAttackRotation = 0;
        this.specialAttackImpactRadius = 200; // 4 blocks (50 units per block)
        
        // Shadow to show hitbox
        this.shadow = null;
        
        this.loader.load(`${import.meta.env.BASE_URL}models/tode.glb`, (gltf) => {
            this.model = gltf.scene;
            
            // Set rotation
            this.model.rotation.x = Math.PI / 2;
            
            // Scale the model
            this.model.scale.setScalar(20);
            
            // Store original material colors for speed boost effect
            this.originalColors = new Map();
            this.model.traverse((child) => {
                if (child.isMesh && child.material) {
                    this.originalColors.set(child, {
                        color: child.material.color.clone(),
                        emissive: child.material.emissive ? child.material.emissive.clone() : null
                    });
                }
            });
            
            // Calculate height for Z-offset
            const box = new THREE.Box3().setFromObject(this.model);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Assuming the ground is at Z=0 and model should sit flush
            this.baseZ = size.z / 2;
            this.model.position.z = this.baseZ;

            // Use the average of width and depth for collision radius, reduced for smaller hitbox
            this.collisionRadius = (size.x + size.y) / 5; // Reduced from /4 to /5
            
            // Create shadow circle to visualize hitbox
            const shadowGeometry = new THREE.CircleGeometry(this.collisionRadius, 32);
            const shadowMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
            this.shadow.position.z = 0.1;
            this.group.add(this.shadow);
            
            // Create red glow ring for attack boost (initially hidden)
            const glowGeometry = new THREE.RingGeometry(this.collisionRadius * 1.1, this.collisionRadius * 1.3, 32);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.25,
                side: THREE.DoubleSide
            });
            this.glowRing = new THREE.Mesh(glowGeometry, glowMaterial);
            this.glowRing.position.z = 0.15;
            this.glowRing.visible = false; // Hidden by default
            this.group.add(this.glowRing);
            
            // Create shield sphere for invincibility (initially hidden)
            const shieldGeometry = new THREE.SphereGeometry(this.collisionRadius * 2, 16, 12);
            const shieldMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
                wireframe: false
            });
            this.shieldSphere = new THREE.Mesh(shieldGeometry, shieldMaterial);
            this.shieldSphere.position.z = this.baseZ;
            this.shieldSphere.visible = false;
            this.group.add(this.shieldSphere);
            
            this.group.add(this.model);
        });
        
        // Place group at center of scene
        this.group.position.set(0, 0, 0);
    }

    move(dir, enemies = [], houses = [], fence = null, forest = null) {
        if (this.isMoving) return false;

        let direction = new THREE.Vector3();
        if (dir === 'ArrowUp') direction.set(0, 1, 0);
        if (dir === 'ArrowDown') direction.set(0, -1, 0);
        if (dir === 'ArrowLeft') direction.set(-1, 0, 0);
        if (dir === 'ArrowRight') direction.set(1, 0, 0);

        const targetPos = this.group.position.clone().addScaledVector(direction, JUMP_DISTANCE);

        // Collision check with fence boundary
        if (fence && fence.checkCollision(targetPos, this.collisionRadius)) {
            return false; // Blocked by fence
        }

        // Collision check with trees
        if (forest && forest.checkTreeCollision(targetPos, this.collisionRadius)) {
            return false; // Blocked by tree
        }

        // Collision check with enemies
        if (!this.isInvulnerable) {
            const hasEnemyCollision = enemies.some(enemy => {
                if (!enemy.model) return false;
                const collision = checkCollision(targetPos, this.collisionRadius, enemy.group.position, enemy.collisionRadius);
                if (collision) {
                    // Take damage instead of blocking movement
                    return this.takeDamage(1); // Returns true if player died (will block movement if dead)
                }
                return false;
            });

            if (hasEnemyCollision) {
                // If we took damage and died, block the movement
                if (this.currentHealth <= 0) return true;
                // Otherwise allow the jump but player took damage
            }
        }

        // Collision check with houses
        const hasHouseCollision = houses.some(house => house.checkCollision(targetPos, this.collisionRadius));
        if (hasHouseCollision) return false;

        this.isMoving = true;
        this.progress = 0;
        
        this.startPosition.copy(this.group.position);
        this.direction.copy(direction);
        this.targetPosition.copy(targetPos);

        // Rotate model to face direction
        if (this.model) {
            const angle = Math.atan2(this.direction.y, this.direction.x);
            this.model.rotation.y = angle + Math.PI / 2;
        }

        return false;
    }

    attack(enemies, scene, radius = ATTACK_RADIUS, cooldown = ATTACK_COOLDOWN) {
        const now = Date.now();
        if (now - this.lastAttackTime < cooldown) return { kills: 0, positions: [] };

        this.lastAttackTime = now;
        let kills = 0;
        const positions = [];

        // Visual feedback
        if (!this.attackCircle || this.attackCircle.geometry.parameters.radius !== radius) {
            if (this.attackCircle) {
                this.attackCircle.geometry.dispose();
                this.group.remove(this.attackCircle);
            }
            const geometry = new THREE.CircleGeometry(radius, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0xffff00, 
                transparent: true, 
                opacity: 0.5,
                side: THREE.DoubleSide
            });
            this.attackCircle = new THREE.Mesh(geometry, material);
            this.attackCircle.position.z = 0.25;
        }

        // Cooldown dial
        if (!this.cooldownDial || this.cooldownDial.geometry.parameters.innerRadius !== radius + 5) {
            if (this.cooldownDial) {
                this.cooldownDial.geometry.dispose();
                this.group.remove(this.cooldownDial);
            }
            const geometry = new THREE.RingGeometry(radius + 5, radius + 15, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthTest: false
            });
            this.cooldownDial = new THREE.Mesh(geometry, material);
            this.cooldownDial.position.z = 0.26;
            this.cooldownDial.renderOrder = 999;
        }

        this.group.add(this.attackCircle);
        this.attackVisualStartTime = now;

        // Combat logic
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const distance = this.group.position.distanceTo(enemy.group.position);
            if (distance <= radius) {
                positions.push(enemy.group.position.clone());
                scene.remove(enemy.group);
                enemies.splice(i, 1);
                kills++;
            }
        }
        return { kills, positions };
    }
    
    takeDamage(amount = 1) {
        // Can't take damage if invulnerable, has shield, or is performing special attack
        if (this.isInvulnerable || this.isShielded() || this.isPerformingSpecialAttack) return false;
        
        this.currentHealth -= amount;
        this.lastDamageTime = Date.now();
        this.isInvulnerable = true;
        
        // Return true if player died
        return this.currentHealth <= 0;
    }
    
    initiateSpecialAttack(enemies = [], houses = [], fence = null, forest = null) {
        // Check if special attack is ready
        if (!this.specialAttackReady || this.isMoving || this.isPerformingSpecialAttack) {
            return false;
        }
        
        // Can't perform if blocked by obstacles in current position
        const targetPos = this.group.position.clone();
        
        if (fence && fence.checkCollision(targetPos, this.collisionRadius)) return false;
        if (forest && forest.checkTreeCollision(targetPos, this.collisionRadius)) return false;
        
        const hasHouseCollision = houses.some(house => house.checkCollision(targetPos, this.collisionRadius));
        if (hasHouseCollision) return false;
        
        // Start special attack
        this.isPerformingSpecialAttack = true;
        this.isMoving = true;
        this.progress = 0;
        this.specialAttackRotation = 0;
        this.specialAttackReady = false;
        this.lastSpecialAttackTime = Date.now();
        
        // Store position (no movement, just jump in place)
        this.startPosition.copy(this.group.position);
        this.targetPosition.copy(this.group.position);
        
        return true;
    }
    
    performSpecialAttackImpact(enemies, scene) {
        // Create impact effect and damage enemies within radius
        let kills = 0;
        const positions = [];
        
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const distance = this.group.position.distanceTo(enemy.group.position);
            if (distance <= this.specialAttackImpactRadius) {
                positions.push(enemy.group.position.clone());
                scene.remove(enemy.group);
                enemies.splice(i, 1);
                kills++;
            }
        }
        
        return { kills, positions };
    }
    
    getSpecialAttackProgress() {
        if (this.specialAttackReady) return 1;
        const elapsed = Date.now() - this.lastSpecialAttackTime;
        return Math.min(elapsed / this.specialAttackCooldown, 1);
    }
    
    getHealth() {
        return {
            current: this.currentHealth,
            max: this.maxHealth
        };
    }
    
    // Power-up methods
    applyHealthPack() {
        if (this.currentHealth < this.maxHealth) {
            this.currentHealth = Math.min(this.currentHealth + 1, this.maxHealth);
            return true; // Successfully used
        }
        return false; // Health already full
    }
    
    applySpeedBoost(duration = 10000) {
        this.activeEffects.speedBoost = true;
        this.effectTimers.speedBoost = duration;
    }
    
    applyAttackRangeBoost(duration = 10000) {
        this.activeEffects.attackRangeBoost = true;
        this.effectTimers.attackRangeBoost = duration;
    }
    
    applyInvincibilityShield(duration = 5000) {
        this.activeEffects.invincibilityShield = true;
        this.effectTimers.invincibilityShield = duration;
    }
    
    getSpeedMultiplier() {
        return this.activeEffects.speedBoost ? 1.5 : 1.0;
    }
    
    getAttackRangeMultiplier() {
        return this.activeEffects.attackRangeBoost ? 1.5 : 1.0;
    }
    
    isShielded() {
        return this.activeEffects.invincibilityShield;
    }

    update(deltaTime, moveSpeed = MOVE_SPEED, attackCooldown = ATTACK_COOLDOWN, attackRadius = ATTACK_RADIUS, enemies = []) {
        const now = Date.now();
        const cooldownElapsed = now - this.lastAttackTime;
        const deltaTimeMs = deltaTime * 1000;
        
        // Update power-up effect timers
        for (const effect in this.effectTimers) {
            if (this.activeEffects[effect]) {
                this.effectTimers[effect] -= deltaTimeMs;
                if (this.effectTimers[effect] <= 0) {
                    this.activeEffects[effect] = false;
                    this.effectTimers[effect] = 0;
                }
            }
        }
        
        // Update special attack cooldown (always, even during movement/special)
        if (!this.specialAttackReady) {
            const elapsed = now - this.lastSpecialAttackTime;
            if (elapsed >= this.specialAttackCooldown) {
                this.specialAttackReady = true;
            }
        }
        
        // Update visual effects based on active power-ups
        if (this.model) {
            // Speed boost: tint model yellow, with flash warning when expiring
            if (this.activeEffects.speedBoost) {
                const timeRemaining = this.effectTimers.speedBoost;
                const isExpiring = timeRemaining <= 2000; // 2 seconds warning
                
                // Flash between yellow and original green when expiring
                let shouldShowYellow = true;
                if (isExpiring) {
                    const flashRate = 150; // Flash every 150ms for urgency
                    shouldShowYellow = Math.floor(now / flashRate) % 2 === 0;
                }
                
                this.model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        if (shouldShowYellow) {
                            child.material.color.setHex(0xFFC700); // Vibrant yellow #FFC700
                            if (child.material.emissive) {
                                child.material.emissive.setHex(0x8b7500);
                            }
                        } else {
                            // Show original color during flash
                            if (this.originalColors && this.originalColors.has(child)) {
                                const original = this.originalColors.get(child);
                                child.material.color.copy(original.color);
                                if (child.material.emissive && original.emissive) {
                                    child.material.emissive.copy(original.emissive);
                                }
                            }
                        }
                    }
                });
            } else {
                // Restore original colors
                this.model.traverse((child) => {
                    if (child.isMesh && child.material && this.originalColors && this.originalColors.has(child)) {
                        const original = this.originalColors.get(child);
                        child.material.color.copy(original.color);
                        if (child.material.emissive && original.emissive) {
                            child.material.emissive.copy(original.emissive);
                        }
                    }
                });
            }
        }
        
        // Attack boost: show red glow ring with flashing warning when expiring
        if (this.glowRing) {
            if (this.activeEffects.attackRangeBoost) {
                const timeRemaining = this.effectTimers.attackRangeBoost;
                const isExpiring = timeRemaining <= 2000; // 2 seconds warning
                
                // Flash the glow ring when expiring
                if (isExpiring) {
                    const flashRate = 150;
                    this.glowRing.visible = Math.floor(now / flashRate) % 2 === 0;
                } else {
                    this.glowRing.visible = true;
                }
                
                this.glowRing.material.color.setHex(0xff0000); // Red
                this.glowRing.material.opacity = 0.25;
            } else {
                this.glowRing.visible = false; // Hidden when not active
            }
        }
        
        // Invincibility shield: show/hide shield sphere with flashing warning when expiring
        if (this.shieldSphere) {
            if (this.activeEffects.invincibilityShield) {
                const timeRemaining = this.effectTimers.invincibilityShield;
                const isExpiring = timeRemaining <= 2000; // 2 seconds warning
                
                // Flash the shield when expiring
                if (isExpiring) {
                    const flashRate = 150;
                    this.shieldSphere.visible = Math.floor(now / flashRate) % 2 === 0;
                } else {
                    this.shieldSphere.visible = true;
                }
                
                // Vertical pulsing effect from bottom to top (when visible)
                if (this.shieldSphere.visible) {
                    const waveSpeed = 0.003;
                    const waveTime = (now * waveSpeed) % (Math.PI * 2);
                    
                    const scaleZ = 1 + Math.sin(waveTime) * 0.15;
                    this.shieldSphere.scale.set(1, 1, scaleZ);
                    
                    const opacityPulse = Math.sin(waveTime) * 0.05 + 0.2;
                    this.shieldSphere.material.opacity = opacityPulse;
                }
            } else {
                this.shieldSphere.visible = false;
            }
        }
        
        // Update invulnerability state
        if (this.isInvulnerable) {
            const timeSinceDamage = now - this.lastDamageTime;
            if (timeSinceDamage >= this.invulnerabilityDuration) {
                this.isInvulnerable = false;
                // Ensure model is visible when invulnerability ends
                if (this.model) this.model.visible = true;
            } else {
                // Blink effect during invulnerability
                if (this.model) {
                    const blinkRate = 100; // Blink every 100ms
                    this.model.visible = Math.floor(timeSinceDamage / blinkRate) % 2 === 0;
                }
            }
        }

        // Update attack visual
        if (this.attackCircle && this.attackCircle.parent) {
            const elapsed = now - this.attackVisualStartTime;
            if (elapsed > this.attackVisualDuration) {
                this.group.remove(this.attackCircle);
            } else {
                this.attackCircle.material.opacity = 0.5 * (1 - elapsed / this.attackVisualDuration);
            }
        }

        // Update cooldown dial
        if (this.cooldownDial) {
            if (cooldownElapsed < attackCooldown) {
                if (!this.cooldownDial.parent) {
                    this.group.add(this.cooldownDial);
                }
                const progress = cooldownElapsed / attackCooldown;
                // Update ring geometry to show progress
                this.cooldownDial.geometry.dispose();
                this.cooldownDial.geometry = new THREE.RingGeometry(
                    attackRadius + 5, 
                    attackRadius + 15, 
                    32, 
                    1, 
                    0, 
                    Math.PI * 2 * progress
                );
            } else if (this.cooldownDial.parent) {
                this.group.remove(this.cooldownDial);
            }
        }

        if (!this.isMoving) {
            return false;
        }

        const isSpecialAttack = this.isPerformingSpecialAttack;
        // Special attack runs at 0.5x speed for a dramatic arc
        const progressRate = 0.02 * FRAME_RATE_REFERENCE * (isSpecialAttack ? 0.5 : 1.0);
        this.progress += progressRate * deltaTime * moveSpeed;

        if (this.progress >= 1) {
            this.progress = 1;
            this.isMoving = false;
            
            if (isSpecialAttack) {
                this.isPerformingSpecialAttack = false;
                this.model.rotation.z = 0;
                // Cooldown starts from landing, not from initiation
                this.lastSpecialAttackTime = Date.now();
                
                const slamRadius = this.specialAttackImpactRadius;
                const circleGeo = new THREE.CircleGeometry(slamRadius, 32);
                const circleMat = new THREE.MeshBasicMaterial({
                    color: 0xffc700,
                    transparent: true,
                    opacity: 0.5,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                if (this.attackCircle) this.group.remove(this.attackCircle);
                this.attackCircle = new THREE.Mesh(circleGeo, circleMat);
                this.attackCircle.position.z = 1;
                this.attackVisualStartTime = Date.now();
                this.attackVisualDuration = 400;
                this.group.add(this.attackCircle);
                
                // Force-create the cyan cooldown dial so it's visible immediately
                this.lastAttackTime = Date.now();
                if (this.cooldownDial) {
                    this.cooldownDial.geometry.dispose();
                    this.group.remove(this.cooldownDial);
                }
                const dialGeo = new THREE.RingGeometry(attackRadius + 5, attackRadius + 15, 32, 1, 0, 0.001);
                const dialMat = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide,
                    depthTest: false
                });
                this.cooldownDial = new THREE.Mesh(dialGeo, dialMat);
                this.cooldownDial.position.z = 0.26;
                this.cooldownDial.renderOrder = 999;
                this.group.add(this.cooldownDial);
                
                return { specialAttackImpact: true };
            }
        }

        // Update position
        this.group.position.lerpVectors(this.startPosition, this.targetPosition, this.progress);

        // Jump height (Z-axis) - higher for special attack
        const jumpHeight = isSpecialAttack ? JUMP_HEIGHT * 2.5 : JUMP_HEIGHT;
        const jumpOffset = Math.sin(this.progress * Math.PI) * jumpHeight;
        
        if (this.model) {
            this.model.position.z = this.baseZ + jumpOffset;
            
            if (isSpecialAttack) {
                this.specialAttackRotation = this.progress * Math.PI * 2;
                this.model.rotation.z = this.specialAttackRotation;
            } else {
                this.model.rotation.z = 0;
            }
        }

        if (this.shieldSphere && this.model) {
            this.shieldSphere.position.z = this.baseZ + jumpOffset;
        }

        if (this.shadow) {
            const heightRatio = jumpOffset / jumpHeight;
            this.shadow.material.opacity = 0.3 - (heightRatio * 0.2);
            
            // Shadow grows as the toad descends during a slam, telegraphing the impact zone
            if (isSpecialAttack && this.progress > 0.5) {
                const impactScale = 1 + (this.progress - 0.5) * 4;
                this.shadow.scale.set(impactScale, impactScale, 1);
            } else {
                this.shadow.scale.set(1, 1, 1);
            }
        }

        // Re-check collisions mid-hop: enemies can move into the path after move() validated it
        if (this.collisionRadius > 0 && !this.isInvulnerable) {
            for (const enemy of enemies) {
                if (!enemy.model) continue;
                const collision = checkCollision(
                    this.group.position, this.collisionRadius,
                    enemy.group.position, enemy.collisionRadius
                );
                if (collision) return this.takeDamage(1);
            }
        }

        return false;
    }
}
