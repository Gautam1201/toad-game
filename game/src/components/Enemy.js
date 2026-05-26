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
            
            // Positioning on top of the ground
            this.baseZ = size.z / 2;
            this.model.position.z = this.baseZ;

            // Use the average of width and depth for collision radius
            this.collisionRadius = (size.x + size.y) / 4;
            
            this.group.add(this.model);
        });
    }

    update(deltaTime, allEnemies = [], speed = ENEMY_SPEED, houses = []) {
        if (!this.model) return false;

        // Direction toward the player's current coordinates
        const direction = new THREE.Vector3()
            .subVectors(this.player.group.position, this.group.position);

        // Project onto XY plane for movement and rotation
        const directionXY = new THREE.Vector3(direction.x, direction.y, 0).normalize();

        // Frame-rate-independent step: speed is now units-per-reference-frame; scale by dt.
        const stepDistance = speed * deltaTime * FRAME_RATE_REFERENCE;
        const nextPosition = this.group.position.clone().addScaledVector(directionXY, stepDistance);

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

        // Only move if no collision
        if (!collidesWithEnemy && !collidesWithHouse) {
            this.group.position.copy(nextPosition);
        }

        // Rotate to face player (based on direction vector in the XY plane)
        const angle = Math.atan2(directionXY.y, directionXY.x);
        this.model.rotation.y = angle + Math.PI / 2;

        return false;
    }
}
