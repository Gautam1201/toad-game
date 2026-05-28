import * as THREE from 'three';

export default class SmokeParticle {
    constructor(scene, position, count = 20) {
        this.scene = scene;
        this.particles = [];
        this.lifetime = 1000; // 1 second
        this.startTime = Date.now();
        
        // Create multiple smoke puffs
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(10 + Math.random() * 10, 8, 6);
            const material = new THREE.MeshBasicMaterial({
                color: 0xaaaaaa,
                transparent: true,
                opacity: 0.6,
                flatShading: true
            });
            
            const particle = new THREE.Mesh(geometry, material);
            
            // Position particles in a circle around the impact point
            const angle = (i / count) * Math.PI * 2;
            const distance = 30 + Math.random() * 40;
            particle.position.set(
                position.x + Math.cos(angle) * distance,
                position.y + Math.sin(angle) * distance,
                5 + Math.random() * 10
            );
            
            // Store velocity for animation
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * (20 + Math.random() * 20),
                Math.sin(angle) * (20 + Math.random() * 20),
                30 + Math.random() * 20
            );
            
            this.particles.push(particle);
            scene.add(particle);
        }
    }
    
    update() {
        const now = Date.now();
        const elapsed = now - this.startTime;
        const progress = elapsed / this.lifetime;
        
        if (progress >= 1) {
            // Remove all particles
            this.particles.forEach(particle => {
                particle.geometry.dispose();
                particle.material.dispose();
                this.scene.remove(particle);
            });
            return false; // Signal removal
        }
        
        // Update each particle
        this.particles.forEach(particle => {
            // Move particle
            particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016)); // ~60fps
            
            // Rise and slow down
            particle.userData.velocity.multiplyScalar(0.95);
            
            // Fade out and grow
            particle.material.opacity = 0.6 * (1 - progress);
            particle.scale.setScalar(1 + progress * 2);
        });
        
        return true; // Still active
    }
}
