import * as THREE from 'three';

export default class FloatingText {
    constructor(scene, text, position) {
        this.scene = scene;
        this.duration = 1500; // ms
        this.startTime = Date.now();
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.font = 'Bold 80px Arial';
        context.fillStyle = 'yellow';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0
        });
        
        this.sprite = new THREE.Sprite(material);
        this.sprite.position.copy(position);
        this.sprite.position.z += 20; // Start slightly above ground
        this.sprite.scale.set(40, 20, 1);
        
        this.scene.add(this.sprite);
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);

        if (progress >= 1) {
            this.scene.remove(this.sprite);
            // Dispose resources
            if (this.sprite.material.map) this.sprite.material.map.dispose();
            this.sprite.material.dispose();
            return false; // To be removed
        }

        // Move up
        this.sprite.position.z += 0.5;
        
        // Fade out - linear fade from start to finish
        this.sprite.material.opacity = 1 - progress;
        
        return true;
    }
}
