import * as THREE from 'three';

export default class Fence {
    constructor() {
        this.group = new THREE.Group();
        this.boundary = 500; // Half of map size (1000/2)
        
        this.createFence();
    }

    createFence() {
        // Fence post dimensions
        const postWidth = 8;
        const postHeight = 30;
        const postDepth = 8;
        const postSpacing = 50;
        
        // Fence colors - wooden aesthetic
        const postColor = 0x8B4513; // Saddle brown
        const railColor = 0xA0522D; // Sienna
        
        // Calculate number of posts per side (add 1 to close corners)
        const postsPerSide = Math.ceil((this.boundary * 2) / postSpacing) + 1;
        
        // Create posts around perimeter
        const postGeometry = new THREE.BoxGeometry(postWidth, postWidth, postHeight);
        const postMaterial = new THREE.MeshStandardMaterial({ color: postColor });
        
        // Top and bottom horizontal rails
        const railHeight = 3;
        const railWidth = postSpacing;
        const railGeometry = new THREE.BoxGeometry(railWidth, railHeight, postHeight * 0.6);
        const railMaterial = new THREE.MeshStandardMaterial({ color: railColor });
        
        // Create fence on all four sides
        this.createFenceSide('top', postsPerSide, postGeometry, postMaterial, railGeometry, railMaterial);
        this.createFenceSide('bottom', postsPerSide, postGeometry, postMaterial, railGeometry, railMaterial);
        this.createFenceSide('left', postsPerSide, postGeometry, postMaterial, railGeometry, railMaterial);
        this.createFenceSide('right', postsPerSide, postGeometry, postMaterial, railGeometry, railMaterial);
    }

    createFenceSide(side, count, postGeometry, postMaterial, railGeometry, railMaterial) {
        const postSpacing = 50;
        const postHeight = 30;
        
        for (let i = 0; i < count; i++) {
            // Create post
            const post = new THREE.Mesh(postGeometry, postMaterial);
            
            // Position post based on side
            switch(side) {
                case 'top':
                    post.position.x = -this.boundary + (i * postSpacing);
                    post.position.y = this.boundary;
                    break;
                case 'bottom':
                    post.position.x = -this.boundary + (i * postSpacing);
                    post.position.y = -this.boundary;
                    break;
                case 'left':
                    post.position.x = -this.boundary;
                    post.position.y = -this.boundary + (i * postSpacing);
                    break;
                case 'right':
                    post.position.x = this.boundary;
                    post.position.y = -this.boundary + (i * postSpacing);
                    break;
            }
            
            post.position.z = postHeight / 2;
            this.group.add(post);
            
            // Add horizontal rail between posts (except last post)
            if (i < count - 1) {
                const rail = new THREE.Mesh(railGeometry, railMaterial);
                rail.position.copy(post.position);
                
                // Offset rail to be between posts
                if (side === 'top' || side === 'bottom') {
                    rail.position.x += postSpacing / 2;
                } else {
                    rail.position.y += postSpacing / 2;
                    rail.rotation.z = Math.PI / 2;
                }
                
                rail.position.z = postHeight * 0.6;
                this.group.add(rail);
            }
        }
    }

    checkCollision(position, radius) {
        // Check if position would go outside boundary
        const safetyMargin = radius + 5; // Add buffer for collision radius
        
        return (
            position.x - safetyMargin < -this.boundary ||
            position.x + safetyMargin > this.boundary ||
            position.y - safetyMargin < -this.boundary ||
            position.y + safetyMargin > this.boundary
        );
    }
}
