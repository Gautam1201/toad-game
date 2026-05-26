import * as THREE from 'three';

export function createCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 9000);
    
    camera.position.set(300, -300, 300);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    
    return camera;
}
