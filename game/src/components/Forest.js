import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class Forest {
    constructor(houses = []) {
        this.group = new THREE.Group();
        this.loader = new GLTFLoader();
        this.boundary = 500; // Fence boundary
        this.forestDepth = 150;
        this.trees = []; // Store tree positions for collision detection (only border trees)
        this.decorativeTrees = []; // Store decorative tree positions for enemy collision only
        this.houses = houses; // Store houses for collision checking
        
        this.createForestFloor();
        this.createSimpleTrees(); // Border trees with collision
        this.createDecorativeTrees(); // Interior decorative trees - enemies collide, player doesn't
        this.loadForestModel();
        this.loadGrassModels();
    }
    
    checkTreeCollision(position, radius) {
        // Check collision with all trees
        for (const tree of this.trees) {
            const distance = Math.sqrt(
                Math.pow(position.x - tree.x, 2) + 
                Math.pow(position.y - tree.y, 2)
            );
            if (distance < radius + tree.radius) {
                return true;
            }
        }
        return false;
    }
    
    checkDecorativeTreeCollision(position, radius) {
        // Check collision with decorative trees (enemies only, player ignores these)
        for (const tree of this.decorativeTrees) {
            const distance = Math.sqrt(
                Math.pow(position.x - tree.x, 2) + 
                Math.pow(position.y - tree.y, 2)
            );
            if (distance < radius + tree.radius) {
                return true;
            }
        }
        return false;
    }

    createForestFloor() {
        // Create a larger plane to accommodate all trees
        const floorSize = 1800; // Increased from 1400
        const floorGeometry = new THREE.PlaneGeometry(floorSize, floorSize);
        
        // Forest floor material - darker brown ground
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d1a0f, // Very dark brown
            roughness: 0.95
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.z = -1; // Below everything to avoid z-fighting
        this.group.add(floor);
    }

    createSimpleTrees() {
        const treeCount = 24; // Programmatically created trees
        
        // Simplified tree geometry (reused for performance)
        const trunkGeometry = new THREE.CylinderGeometry(3, 5, 35, 6);
        const canopyGeometry = new THREE.SphereGeometry(18, 6, 6);
        
        // Tree colors
        const trunkColor = 0x654321; // Brown
        const canopyColors = [0x1a5c1a, 0x0d4d0d, 0x1e6b1e]; // Dark greens
        
        for (let i = 0; i < treeCount; i++) {
            this.createSimpleTree(trunkGeometry, canopyGeometry, canopyColors);
        }
    }

    createSimpleTree(trunkGeometry, canopyGeometry, canopyColors) {
        const tree = new THREE.Group();
        
        // Trunk
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x654321,
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.rotation.x = Math.PI / 2; // Rotate to stand upright
        trunk.position.z = 17; // Half trunk height
        tree.add(trunk);
        
        // Single canopy
        const canopyColor = canopyColors[Math.floor(Math.random() * canopyColors.length)];
        const canopyMaterial = new THREE.MeshStandardMaterial({
            color: canopyColor,
            roughness: 0.85
        });
        
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.z = 38; // Top of trunk
        tree.add(canopy);
        
        // Position tree beyond fence with more clearance to avoid overlap
        const angle = Math.random() * Math.PI * 2;
        // Increased minimum distance to 150 units from fence to prevent overlap
        const distance = this.boundary + 150 + Math.random() * 100;
        tree.position.x = Math.cos(angle) * distance;
        tree.position.y = Math.sin(angle) * distance;
        
        // Random scale for variety
        const scale = 0.9 + Math.random() * 0.3;
        tree.scale.setScalar(scale);
        
        // Random rotation around Z axis
        tree.rotation.z = Math.random() * Math.PI * 2;
        
        // Store tree collision data (approximate radius based on canopy)
        this.trees.push({
            x: tree.position.x,
            y: tree.position.y,
            radius: 20 * scale // Canopy radius scaled
        });
        
        this.group.add(tree);
    }

    createDecorativeTrees() {
        // Create decorative trees at grid centers inside the playing area
        // Map is 1000x1000, tiles are 50x50, so grid centers are at -475, -425, ..., 425, 475
        const TILE_SIZE = 50;
        const MAP_HALF_SIZE = 500;
        
        // Reuse geometry for performance
        const trunkGeometry = new THREE.CylinderGeometry(2.5, 4, 30, 6);
        const canopyGeometry = new THREE.SphereGeometry(15, 6, 6);
        const canopyColors = [0x1a5c1a, 0x0d4d0d, 0x1e6b1e];
        
        // Place trees on grid centers with ~15% density (reduced from 25% for better spacing)
        for (let x = -MAP_HALF_SIZE + TILE_SIZE/2; x < MAP_HALF_SIZE; x += TILE_SIZE) {
            for (let y = -MAP_HALF_SIZE + TILE_SIZE/2; y < MAP_HALF_SIZE; y += TILE_SIZE) {
                // Skip most tiles randomly for natural distribution and better spacing
                if (Math.random() > 0.15) continue;
                
                // Skip center area to keep spawn clear
                if (Math.abs(x) < 150 && Math.abs(y) < 150) continue;
                
                // Check if too close to any house (collision check)
                const treePos = new THREE.Vector3(x, y, 0);
                const tooCloseToHouse = this.houses.some(house => {
                    const distance = treePos.distanceTo(house.group.position);
                    return distance < 120; // Keep 120 units clearance from houses (increased)
                });
                
                if (tooCloseToHouse) continue; // Skip this tree placement
                
                const tree = new THREE.Group();
                
                // Trunk
                const trunkMaterial = new THREE.MeshStandardMaterial({
                    color: 0x654321,
                    roughness: 0.9
                });
                const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                trunk.rotation.x = Math.PI / 2;
                trunk.position.z = 15;
                tree.add(trunk);
                
                // Canopy
                const canopyColor = canopyColors[Math.floor(Math.random() * canopyColors.length)];
                const canopyMaterial = new THREE.MeshStandardMaterial({
                    color: canopyColor,
                    roughness: 0.85
                });
                const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
                canopy.position.z = 32;
                tree.add(canopy);
                
                // Position at grid center
                tree.position.x = x;
                tree.position.y = y;
                
                // Smaller scale for decorative trees
                const scale = 0.7 + Math.random() * 0.2;
                tree.scale.setScalar(scale);
                
                // Random rotation
                tree.rotation.z = Math.random() * Math.PI * 2;
                
                // Store decorative tree collision data (for enemies only)
                this.decorativeTrees.push({
                    x: x,
                    y: y,
                    radius: 15 * scale // Canopy radius scaled
                });
                
                this.group.add(tree);
            }
        }
        
        console.log(`Created ${this.decorativeTrees.length} decorative trees (enemies collide, player doesn't)`);
    }

    loadForestModel() {
        // Load Forest.glb and create dense forest coverage outside the fence
        this.loader.load('/models/Forest.glb', (gltf) => {
            const forestModel = gltf.scene;
            
            console.log('Forest model loaded successfully - creating dense forest ring');
            
            // Create a dense ring of forest around the map
            const positions = [];
            
            // Inner ring at 600 units (20 positions) - just outside fence at 500
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                positions.push({
                    x: Math.cos(angle) * 600,
                    y: Math.sin(angle) * 600,
                    scale: 65 + Math.random() * 25,
                    rotZ: angle
                });
            }
            
            // Middle ring at 750 units (24 positions)
            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2 + 0.08;
                positions.push({
                    x: Math.cos(angle) * 750,
                    y: Math.sin(angle) * 750,
                    scale: 65 + Math.random() * 25,
                    rotZ: angle
                });
            }
            
            // Outer ring at 900 units (28 positions)
            for (let i = 0; i < 28; i++) {
                const angle = (i / 28) * Math.PI * 2 + 0.05;
                positions.push({
                    x: Math.cos(angle) * 900,
                    y: Math.sin(angle) * 900,
                    scale: 65 + Math.random() * 25,
                    rotZ: angle
                });
            }
            
            console.log(`Creating ${positions.length} forest instances for dense coverage`);
            
            positions.forEach((config, index) => {
                // Calculate forest radius based on scale
                const forestRadius = config.scale * 0.62; // Conservative estimate: 60% of scale
                const fenceBoundary = 500;
                const safetyMargin = 50; // Reduced margin to bring forests closer
                
                // Check if forest is completely outside the fence square
                // Forest is safe if it's entirely beyond the fence on any edge
                const completelyRight = config.x - forestRadius > fenceBoundary + safetyMargin;
                const completelyLeft = config.x + forestRadius < -fenceBoundary - safetyMargin;
                const completelyAbove = config.y - forestRadius > fenceBoundary + safetyMargin;
                const completelyBelow = config.y + forestRadius < -fenceBoundary - safetyMargin;
                
                const isCompletelyOutside = completelyRight || completelyLeft || completelyAbove || completelyBelow;
                
                // Skip if the forest would overlap the fence
                if (!isCompletelyOutside) {
                    return;
                }
                
                const forest = forestModel.clone();
                
                // Scale first
                forest.scale.setScalar(config.scale);
                
                // Rotate to align with Z-up coordinate system
                forest.rotation.x = Math.PI / 2;
                
                // CRITICAL: Force update matrices so bounding box is accurate
                forest.updateMatrixWorld(true);
                
                // Calculate proper ground offset after rotation and matrix update
                const box = new THREE.Box3().setFromObject(forest);
                const groundOffset = -box.min.z;
                
                // Position the forest
                forest.position.x = config.x;
                forest.position.y = config.y;
                forest.position.z = groundOffset; // Sits exactly on ground
                
                this.group.add(forest);
            });
        }, undefined, (error) => {
            console.error('Error loading Forest.glb:', error);
        });
    }

    loadGrassModels() {
        // Grass models temporarily removed due to orientation issues
        // Can be re-added later with correct rotation values for each model
        console.log('Grass models disabled temporarily');
    }
}
