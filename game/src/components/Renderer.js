import * as THREE from 'three';

export function createRenderer() {
    const canvas = document.querySelector('canvas.game');
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    return renderer;
}
