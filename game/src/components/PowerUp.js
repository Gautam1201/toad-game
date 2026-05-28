import * as THREE from 'three';

// Power-up types
export const PowerUpType = {
    HEALTH: 'health',
    SPEED: 'speed',
    ATTACK_RANGE: 'attack_range',
    INVINCIBILITY: 'invincibility'
};

export default class PowerUp {
    constructor(scene, position, type = PowerUpType.HEALTH) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.type = type;
        this.collisionRadius = 15;
        this.rotationSpeed = 2; // radians per second
        this.floatTime = Math.random() * Math.PI * 2; // Random phase for floating
        this.baseZ = 15; // Height off the ground
        this.spawnTime = 0; // Track spawn animation
        this.isSpawning = true;
            this.isUseful = true; // Track if this power-up is currently useful to the player
        
        // Create the power-up visual based on type
        this.createVisual();
        
        // Create spawn indicator
        this.createSpawnIndicator();
        
        // Position the power-up
        this.group.position.copy(position);
        this.group.position.z = this.baseZ; // Set initial Z to prevent jerk
        this.scene.add(this.group);
    }
    
    createVisual() {
        const config = this.getTypeConfig();
        
        // Main sphere - LOW-POLY with fewer segments for faceted look
        const geometry = new THREE.SphereGeometry(12, 8, 6);
        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.emissive,
            emissiveIntensity: 0.5,
            metalness: 0.3,
            roughness: 0.4,
            flatShading: true  // Faceted shading for low-poly look
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);
        
        // Outer glow ring - also low-poly
        const ringGeometry = new THREE.TorusGeometry(15, 2, 6, 12);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: config.glowColor,
            transparent: true,
            opacity: 0.6
        });
        
        this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
        this.ring.rotation.x = Math.PI / 2;
        this.group.add(this.ring);
        
        // Ground glow shadow - stays at ground level, helps show collection area
        const shadowGeometry = new THREE.CircleGeometry(this.collisionRadius, 32);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: config.glowColor,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.groundGlow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.groundGlow.renderOrder = 1;
        this.group.add(this.groundGlow);
        
        // Add icon/symbol based on type
        if (this.type === PowerUpType.HEALTH) {
            this.addHealthCross();
        } else if (this.type === PowerUpType.SPEED) {
            this.addSpeedBolt();
        } else if (this.type === PowerUpType.ATTACK_RANGE) {
            this.addAttackRangeIcon();
        } else if (this.type === PowerUpType.INVINCIBILITY) {
            this.addInvincibilityIcon();
        }
        
        // Point light for glow effect
        const light = new THREE.PointLight(config.glowColor, 1, 50);
        this.group.add(light);
    }
    
    addHealthCross() {
        // Group the cross so we can billboard it toward the camera
        this.crossGroup = new THREE.Group();
        
        const barGeometry = new THREE.BoxGeometry(14, 3, 3);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x90EE90,
            depthTest: false,
            transparent: true,
            opacity: 1.0
        });
        
        const horizontal = new THREE.Mesh(barGeometry, material);
        horizontal.renderOrder = 2;
        this.crossGroup.add(horizontal);
        
        const vertical = new THREE.Mesh(barGeometry, material.clone());
        vertical.rotation.z = Math.PI / 2;
        vertical.renderOrder = 2;
        this.crossGroup.add(vertical);
        
        // Make sphere slightly transparent so + is clearly visible
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = 0.85;
        
        this.group.add(this.crossGroup);
        this.crossParts = [horizontal, vertical];
    }
    
    addSpeedBolt() {
        // Create lightning bolt shape
        const shape = new THREE.Shape();
        shape.moveTo(0, 8);
        shape.lineTo(-3, 2);
        shape.lineTo(0, 2);
        shape.lineTo(-2, -8);
        shape.lineTo(3, -2);
        shape.lineTo(0, -2);
        shape.lineTo(2, 8);
        
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide
        });
        
        const bolt = new THREE.Mesh(geometry, material);
        this.group.add(bolt);
        
        // Store bolt reference for spawn animation
        this.boltSymbol = bolt;
    }
    
    addAttackRangeIcon() {
        // Create fire emoji as texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw fire emoji
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: false
        });
        
        this.attackRangeIcon = new THREE.Sprite(material);
        this.attackRangeIcon.scale.set(20, 20, 1);
        this.attackRangeIcon.renderOrder = 2;
        
        // Make sphere slightly transparent
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = 0.85;
        
        this.group.add(this.attackRangeIcon);
    }
    
    addInvincibilityIcon() {
        // Create shield emoji as texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw shield emoji
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0,
            depthTest: false
        });
        
        this.shieldIcon = new THREE.Sprite(material);
        this.shieldIcon.scale.set(20, 20, 1);
        this.shieldIcon.renderOrder = 2;
        
        // Make sphere slightly transparent
        this.mesh.material.transparent = true;
        this.mesh.material.opacity = 0.85;
        
        this.group.add(this.shieldIcon);
    }
    
    getTypeConfig() {
        switch (this.type) {
            case PowerUpType.HEALTH:
                return {
                    color: 0xff0000,      // Red
                    emissive: 0xff0000,
                    glowColor: 0xff3333
                };
            case PowerUpType.SPEED:
                return {
                    color: 0xffd700,      // Gold
                    emissive: 0xffd700,
                    glowColor: 0xffeb3b
                };
            case PowerUpType.ATTACK_RANGE:
                return {
                    color: 0x00bfff,      // Cyan Blue
                    emissive: 0x00bfff,
                    glowColor: 0x4dd0ff   // Cyan glow ring
                };
            case PowerUpType.INVINCIBILITY:
                return {
                    color: 0x9c27b0,      // Purple
                    emissive: 0x9c27b0,
                    glowColor: 0xba68c8
                };
            default:
                return {
                    color: 0xffffff,
                    emissive: 0xffffff,
                    glowColor: 0xffffff
                };
        }
    }
    
    createSpawnIndicator() {
        const config = this.getTypeConfig();
        
        // Ground circle indicator
        const circleGeometry = new THREE.RingGeometry(5, 8, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: config.glowColor,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.spawnIndicator = new THREE.Mesh(circleGeometry, circleMaterial);
        this.spawnIndicator.rotation.x = Math.PI / 2;
        this.spawnIndicator.position.z = 0.5; // Just above ground
        this.group.add(this.spawnIndicator);
        
        // Expanding rings
        this.spawnRings = [];
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(10, 12, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: config.glowColor,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.position.z = 1;
            ring.userData.delay = i * 0.2; // Stagger the rings
            this.group.add(ring);
            this.spawnRings.push(ring);
        }
        
        // Vertical beam
        const beamGeometry = new THREE.CylinderGeometry(3, 3, 40, 16);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: config.glowColor,
            transparent: true,
            opacity: 0.4
        });
        
        this.spawnBeam = new THREE.Mesh(beamGeometry, beamMaterial);
        this.spawnBeam.rotation.x = Math.PI / 2;
        this.spawnBeam.position.z = 20;
        this.group.add(this.spawnBeam);
    }
    
    updateUsefulnessVisual() {
        // Make the power-up faded/transparent when not useful
        const targetOpacity = this.isUseful ? 0.85 : 0.3;
        const targetRingOpacity = this.isUseful ? 0.6 : 0.2;
        const targetGroundGlowOpacity = this.isUseful ? 0.35 : 0.1;
        const targetEmissiveIntensity = this.isUseful ? 0.5 : 0.15;
        
        // Update sphere opacity
        if (this.mesh && this.mesh.material.transparent) {
            this.mesh.material.opacity = targetOpacity;
            this.mesh.material.emissiveIntensity = targetEmissiveIntensity;
        }
        
        // Update ring opacity
        if (this.ring) {
            this.ring.material.opacity = targetRingOpacity;
        }
        
        // Update ground glow
        if (this.groundGlow) {
            this.groundGlow.material.opacity = targetGroundGlowOpacity;
        }
        
        // Update cross opacity if health pack
        if (this.crossParts) {
            this.crossParts.forEach(part => {
                part.material.opacity = this.isUseful ? 1.0 : 0.3;
            });
        }
    }
    
    update(deltaTime, camera, player = null) {
        // Update usefulness state based on player status
        if (player && this.type === PowerUpType.HEALTH) {
            const health = player.getHealth();
            const wasUseful = this.isUseful;
            this.isUseful = health.current < health.max;
            
            // Update visual opacity when usefulness changes
            if (wasUseful !== this.isUseful) {
                this.updateUsefulnessVisual();
            }
        }
        
        // Handle spawn animation (first 1 second)
        if (this.isSpawning) {
            this.spawnTime += deltaTime;
            const spawnDuration = 1.0; // 1 second spawn animation
            
            if (this.spawnTime < spawnDuration) {
                const progress = this.spawnTime / spawnDuration;
                
                // Fade in main orb
                if (this.mesh) {
                    this.mesh.scale.setScalar(progress);
                }
                
                // Fade in cross parts
                if (this.crossParts) {
                    this.crossParts.forEach(part => {
                        part.scale.setScalar(progress);
                    });
                }
                
                // Fade in bolt symbol
                if (this.boltSymbol) {
                    this.boltSymbol.scale.setScalar(progress);
                }
                
                // Fade in attack range icon
                if (this.attackRangeIcon) {
                    this.attackRangeIcon.scale.setScalar(progress);
                }
                
                // Fade in shield icon
                if (this.shieldIcon) {
                    this.shieldIcon.scale.setScalar(progress);
                }
                
                // Fade in ring
                if (this.ring) {
                    this.ring.scale.setScalar(progress);
                }
                
                // Expand spawn rings
                this.spawnRings.forEach((ring, i) => {
                    const ringProgress = Math.max(0, progress - ring.userData.delay);
                    const scale = 1 + ringProgress * 3;
                    ring.scale.set(scale, scale, 1);
                    ring.material.opacity = Math.max(0, 0.6 * (1 - ringProgress));
                });
                
                // Pulse ground indicator
                if (this.spawnIndicator) {
                    const pulse = Math.sin(progress * Math.PI * 4) * 0.3 + 0.7;
                    this.spawnIndicator.scale.set(pulse, pulse, 1);
                }
                
                // Fade beam
                if (this.spawnBeam) {
                    this.spawnBeam.material.opacity = 0.4 * (1 - progress);
                }
            } else {
                // Spawn animation complete, clean up indicators
                this.isSpawning = false;
                
                // Remove spawn effects
                if (this.spawnIndicator) {
                    this.group.remove(this.spawnIndicator);
                    this.spawnIndicator.geometry.dispose();
                    this.spawnIndicator.material.dispose();
                    this.spawnIndicator = null;
                }
                
                this.spawnRings.forEach(ring => {
                    this.group.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                });
                this.spawnRings = [];
                
                if (this.spawnBeam) {
                    this.group.remove(this.spawnBeam);
                    this.spawnBeam.geometry.dispose();
                    this.spawnBeam.material.dispose();
                    this.spawnBeam = null;
                }
                
                // Ensure mesh is at full scale
                if (this.mesh) {
                    this.mesh.scale.setScalar(1);
                }
                
                if (this.crossParts) {
                    this.crossParts.forEach(part => {
                        part.scale.setScalar(1);
                    });
                }
                
                if (this.boltSymbol) {
                    this.boltSymbol.scale.setScalar(1);
                }
                
                if (this.attackRangeIcon) {
                    this.attackRangeIcon.scale.setScalar(1);
                }
                
                if (this.shieldIcon) {
                    this.shieldIcon.scale.setScalar(1);
                }
                
                if (this.ring) {
                    this.ring.scale.setScalar(1);
                }
                
                // Apply initial usefulness visual state
                this.updateUsefulnessVisual();
            }
        }
        
        // Normal floating animation
        this.floatTime += deltaTime * 2;
        const floatOffset = Math.sin(this.floatTime) * 5;
        this.group.position.z = this.baseZ + floatOffset;
        
        // Keep ground glow pinned at world z=1 regardless of float height
        if (this.groundGlow) {
            this.groundGlow.position.z = -(this.baseZ + floatOffset) + 1;
            
            // Pulse opacity based on float height - brighter when closer to ground
            const heightRatio = (floatOffset + 5) / 10; // 0 (low) to 1 (high)
            this.groundGlow.material.opacity = 0.5 - heightRatio * 0.25; // 0.5 → 0.25
            
            // Slightly shrink glow when orb is high up
            const glowScale = 1 - heightRatio * 0.2;
            this.groundGlow.scale.setScalar(glowScale);
        }
        
        // Rotation animation
        this.mesh.rotation.y += deltaTime * this.rotationSpeed;
        if (this.ring) {
            this.ring.rotation.z += deltaTime * this.rotationSpeed * 0.5;
        }
        
        // Billboard the cross to always face the camera
        if (this.crossGroup && camera) {
            this.crossGroup.lookAt(camera.position.clone().sub(this.group.position));
        }
        
        // Sprites (attack range and shield icons) automatically face the camera, no billboarding needed
        
        // Pulsing glow effect
        const pulseIntensity = 0.3 + Math.sin(this.floatTime * 2) * 0.2;
        this.mesh.material.emissiveIntensity = pulseIntensity;
        if (this.ring) {
            this.ring.material.opacity = 0.4 + Math.sin(this.floatTime * 2) * 0.2;
        }
    }
    
    checkCollision(playerPosition, playerRadius) {
        const distance = new THREE.Vector2(
            this.group.position.x - playerPosition.x,
            this.group.position.y - playerPosition.y
        ).length();
        
        return distance < (this.collisionRadius + playerRadius);
    }
    
    destroy() {
        // Clean up geometries and materials
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        if (this.ring) {
            this.ring.geometry.dispose();
            this.ring.material.dispose();
        }
        if (this.groundGlow) {
            this.groundGlow.geometry.dispose();
            this.groundGlow.material.dispose();
        }
        
        // Clean up spawn indicator if still present
        if (this.spawnIndicator) {
            this.spawnIndicator.geometry.dispose();
            this.spawnIndicator.material.dispose();
        }
        
        if (this.spawnRings) {
            this.spawnRings.forEach(ring => {
                ring.geometry.dispose();
                ring.material.dispose();
            });
        }
        
        if (this.spawnBeam) {
            this.spawnBeam.geometry.dispose();
            this.spawnBeam.material.dispose();
        }
        
        this.scene.remove(this.group);
    }
}
