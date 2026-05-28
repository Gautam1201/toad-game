import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class House {
    constructor(scene, position) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.loader = new GLTFLoader();
        this.model = null;
        this.boundingBox = new THREE.Box3();
        this.collisionRadius = 0;

        this.group.position.copy(position);
        this.scene.add(this.group);

        this.loader.load(`${import.meta.env.BASE_URL}models/small_house.glb`, (gltf) => {
            this.model = gltf.scene;
            
            // Scale the model
            this.model.scale.setScalar(65);
            
            // Align with Z-up coordinate system
            this.model.rotation.x = Math.PI / 2;
            
            // Random rotation around Y-axis in multiples of Math.PI / 2
            const randomRotation = (Math.floor(Math.random() * 4)) * (Math.PI / 2);
            this.model.rotation.y = randomRotation;

            // Ensure house sits exactly on the ground level (Z = 0)
            const box = new THREE.Box3().setFromObject(this.model);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Calculate offset to sit on ground
            this.model.position.z = -box.min.z;

            // Set the final bounding box for collision detection
            this.boundingBox.setFromObject(this.model);
            // Move bounding box to group position
            this.boundingBox.translate(this.group.position);
            
            // Calculate collision radius for circular collision check if needed
            // But requirement says "Neither enemies nor the player should be able to pass through the houses."
            // We can use the bounding box or a radius.
            this.collisionRadius = Math.max(size.x, size.y) / 2;
            
            this.group.add(this.model);
        });
    }

    checkCollision(entityPosition, entityRadius) {
        // Simple circle-to-circle or circle-to-AABB collision
        // Given the requirement, AABB might be better if houses are rectangular, 
        // but the project uses checkCollision (circle-to-circle) for everything else.
        // Let's use circle-to-circle for consistency if needed, or AABB for houses.
        
        // Since the houses are rotated in multiples of PI/2, their AABB is quite accurate.
        // But the player/enemy is treated as a circle.
        
        // Let's implement a circle-AABB collision check
        const closestPoint = new THREE.Vector3(
            Math.max(this.boundingBox.min.x, Math.min(entityPosition.x, this.boundingBox.max.x)),
            Math.max(this.boundingBox.min.y, Math.min(entityPosition.y, this.boundingBox.max.y)),
            0
        );
        
        const distance = entityPosition.distanceTo(closestPoint);
        return distance < entityRadius;
    }
}
