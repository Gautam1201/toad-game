import * as THREE from 'three';

export const COLLISION_DISTANCE = 5;

export function checkCollision(pos1, radius1, pos2, radius2) {
    const dist = pos1.distanceTo(pos2);
    return dist < (radius1 + radius2 + COLLISION_DISTANCE);
}
