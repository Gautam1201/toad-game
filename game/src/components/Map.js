import * as THREE from 'three';

export default function createMap() {
    const group = new THREE.Group();

    const gridSize = 1000;
    const divisions = 20;
    const tileSize = gridSize / divisions;

    const darkGreen = new THREE.Color(0x228B22);
    const lightGreen = new THREE.Color(0x90EE90);

    const geometry = new THREE.PlaneGeometry(tileSize, tileSize);

    for (let i = 0; i < divisions; i++) {
        for (let j = 0; j < divisions; j++) {
            const color = (i + j) % 2 === 0 ? darkGreen : lightGreen;
            const material = new THREE.MeshStandardMaterial({ color });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.x = (i - divisions / 2 + 0.5) * tileSize;
            mesh.position.y = (j - divisions / 2 + 0.5) * tileSize;
            mesh.position.z = 0;

            group.add(mesh);
        }
    }

    return group;
}
