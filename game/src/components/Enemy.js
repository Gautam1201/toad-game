import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { checkCollision } from '../utils/collision.js';

const ENEMY_SPEED = 0.5;

// Reference frame rate the original per-frame ENEMY_SPEED was tuned for.
const FRAME_RATE_REFERENCE = 60;

export default class Enemy {
    constructor(scene, player, spawnPosition) {
        this.scene = scene;
        this.player = player;
        this.group = new THREE.Group();
        this.loader = new GLTFLoader();
        this.model = null;
        this.baseZ = 0;
        this.collisionRadius = 0;
        this.shadow = null;
        this.hoverTime = Math.random() * Math.PI * 2; // Random start phase for variety

        this.group.position.copy(spawnPosition);
        this.scene.add(this.group);

        this.loader.load('/models/enemy.glb', (gltf) => {
            this.model = gltf.scene;
            
            // Set rotation
            this.model.rotation.x = Math.PI / 2;
            
            // Scale the model
            this.model.scale.setScalar(5);
            
            // Calculate height for Z-offset
            const box = new THREE.Box3().setFromObject(this.model);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Positioning on top of the ground with slight hover
            this.baseZ = size.z / 2 + 3; // Add 3 units hover height
            this.model.position.z = this.baseZ;

            // Use the average of width and depth for collision radius
            this.collisionRadius = (size.x + size.y) / 4;
            
            // Create shadow circle to visualize hitbox (lighter for enemies)
            const shadowGeometry = new THREE.CircleGeometry(this.collisionRadius, 32);
            const shadowMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.15, // Lighter shadow for hovering effect
                side: THREE.DoubleSide
            });
            this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
            this.shadow.position.z = 0.1;
            this.group.add(this.shadow);
            
            this.group.add(this.model);
        });
    }

    update(deltaTime, allEnemies = [], speed = ENEMY_SPEED, houses = []) {
        if (!this.model) return false;

        // Hovering animation (subtle up and down motion)
        this.hoverTime += deltaTime * 2; // 2 rad/sec for smooth oscillation
        const hoverOffset = Math.sin(this.hoverTime) * 2; // ±2 units amplitude
        this.model.position.z = this.baseZ + hoverOffset;

        // Direction toward the player's current coordinates
        const direction = new THREE.Vector3()
            .subVectors(this.player.group.position, this.group.position);

        // Project onto XY plane for movement and rotation
        const directionXY = new THREE.Vector3(direction.x, direction.y, 0).normalize();

        // Frame-rate-independent step: speed is now units-per-reference-frame; scale by dt.
        const stepDistance = speed * deltaTime * FRAME_RATE_REFERENCE;
        
        // Try multiple movement directions if direct path is blocked
        const attemptDirections = [
            directionXY.clone(),                                    // Direct path
            directionXY.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4),   // 45° right
            directionXY.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 4),  // 45° left
            directionXY.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),   // 90° right
            directionXY.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),  // 90° left
        ];

        let moved = false;
        let finalDirection = directionXY;

        for (const attemptDir of attemptDirections) {
            const nextPosition = this.group.position.clone().addScaledVector(attemptDir, stepDistance);

            // Collision check with player
            const collidesWithPlayer = checkCollision(
                nextPosition, this.collisionRadius,
                this.player.group.position, this.player.collisionRadius
            );

            if (collidesWithPlayer) {
                return true;
            }

            // Collision check with other enemies
            const collidesWithEnemy = allEnemies.some(other => {
                if (other === this || !other.model) return false;
                return checkCollision(
                    nextPosition, this.collisionRadius,
                    other.group.position, other.collisionRadius
                );
            });

            // Collision check with houses
            const collidesWithHouse = houses.some(house => house.checkCollision(nextPosition, this.collisionRadius));

            // If no collision, move in this direction
            if (!collidesWithEnemy && !collidesWithHouse) {
                this.group.position.copy(nextPosition);
                finalDirection = attemptDir;
                moved = true;
                break;
            }
        }

        // Rotate to face movement direction (or player if couldn't move)
        const angle = Math.atan2(finalDirection.y, finalDirection.x);
        this.model.rotation.y = angle + Math.PI / 2;

        return false;
    }
}
