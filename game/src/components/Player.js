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
        
        // Shadow to show hitbox
        this.shadow = null;
        
        this.loader.load('/models/tode.glb', (gltf) => {
            this.model = gltf.scene;
            
            // Set rotation
            this.model.rotation.x = Math.PI / 2;
            
            // Scale the model
            this.model.scale.setScalar(20);
            
            // Calculate height for Z-offset
            const box = new THREE.Box3().setFromObject(this.model);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Assuming the ground is at Z=0 and model should sit flush
            this.baseZ = size.z / 2;
            this.model.position.z = this.baseZ;

            // Use the average of width and depth for collision radius (more accurate for rounded characters)
            this.collisionRadius = (size.x + size.y) / 4;
            
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
            
            this.group.add(this.model);
        });
        
        // Place group at center of scene
        this.group.position.set(0, 0, 0);
    }

    move(dir, enemies = [], houses = []) {
        if (this.isMoving) return false;

        let direction = new THREE.Vector3();
        if (dir === 'ArrowUp') direction.set(0, 1, 0);
        if (dir === 'ArrowDown') direction.set(0, -1, 0);
        if (dir === 'ArrowLeft') direction.set(-1, 0, 0);
        if (dir === 'ArrowRight') direction.set(1, 0, 0);

        const targetPos = this.group.position.clone().addScaledVector(direction, JUMP_DISTANCE);

        // Collision check with enemies
        let triggeredGameOver = false;
        const hasEnemyCollision = enemies.some(enemy => {
            if (!enemy.model) return false;
            const collision = checkCollision(targetPos, this.collisionRadius, enemy.group.position, enemy.collisionRadius);
            if (collision) {
                triggeredGameOver = true;
                return true;
            }
            return false;
        });

        if (triggeredGameOver) return true;
        if (hasEnemyCollision) return false;

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
                side: THREE.DoubleSide
            });
            this.cooldownDial = new THREE.Mesh(geometry, material);
            this.cooldownDial.position.z = 0.26;
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

    update(deltaTime, moveSpeed = MOVE_SPEED, attackCooldown = ATTACK_COOLDOWN, attackRadius = ATTACK_RADIUS, enemies = []) {
        const now = Date.now();
        const cooldownElapsed = now - this.lastAttackTime;

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

        if (!this.isMoving) return false;

        // Frame-rate-independent progress: original was 0.02 per frame at 60fps,
        // which is 0.02 * 60 = 1.2 progress units per second.
        const progressRate = 0.02 * FRAME_RATE_REFERENCE; // 1.2 per second
        this.progress += progressRate * deltaTime * moveSpeed;

        if (this.progress >= 1) {
            this.progress = 1;
            this.isMoving = false;
        }

        // Update position
        this.group.position.lerpVectors(this.startPosition, this.targetPosition, this.progress);

        // Jump height (Z-axis)
        const jumpOffset = Math.sin(this.progress * Math.PI) * JUMP_HEIGHT;
        if (this.model) {
            this.model.position.z = this.baseZ + jumpOffset;
        }

        // Update shadow opacity based on jump height (more realistic)
        if (this.shadow) {
            // When on ground (jumpOffset = 0): opacity = 0.3
            // When at peak (jumpOffset = JUMP_HEIGHT): opacity = 0.1
            // Linear interpolation: opacity decreases as height increases
            const heightRatio = jumpOffset / JUMP_HEIGHT; // 0 to 1
            this.shadow.material.opacity = 0.3 - (heightRatio * 0.2); // 0.3 to 0.1
        }

        // Continuous collision check during hop: enemies may have moved into our path
        // since move() validated the target. Without this, the toad can tunnel through them.
        if (this.collisionRadius > 0) {
            for (const enemy of enemies) {
                if (!enemy.model) continue;
                const collision = checkCollision(
                    this.group.position, this.collisionRadius,
                    enemy.group.position, enemy.collisionRadius
                );
                if (collision) return true;
            }
        }

        return false;
    }
}
