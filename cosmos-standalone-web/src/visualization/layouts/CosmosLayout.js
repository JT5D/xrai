import * as THREE from 'three';
import { gsap } from 'gsap';

export class CosmosLayout {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'Cosmos';
        this.particles = null;
        this.connections = [];
        this.time = 0;
    }
    
    async generate(graphData) {
        this.clear();
        this.scene.add(this.group);
        
        // Create particle system for nodes
        const particleCount = graphData.nodes.length;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const colorMap = {
            icosa: new THREE.Color(0xFF6B6B),
            objaverse: new THREE.Color(0x4ECDC4),
            github: new THREE.Color(0x95E1D3),
            local: new THREE.Color(0xF38181),
            web: new THREE.Color(0xAA96DA)
        };
        
        // Distribute nodes in spherical pattern
        graphData.nodes.forEach((node, i) => {
            const phi = Math.acos(1 - 2 * (i + 0.5) / particleCount);
            const theta = Math.PI * (1 + Math.sqrt(5)) * i;
            const radius = 50 + Math.random() * 30;
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            // Store position for connections
            node.cosmosPosition = new THREE.Vector3(x, y, z);
            
            // Set color based on type
            const color = colorMap[node.type] || new THREE.Color(0xFFFFFF);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            // Size based on importance
            sizes[i] = 3 + (node.val || 1) * 2;
        });
        
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Shader material for custom particle rendering
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                uniform float pixelRatio;
                
                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    // Gentle floating animation
                    pos.y += sin(time + position.x * 0.01) * 2.0;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    
                    if (dist > 0.5) discard;
                    
                    // Soft edges
                    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                    
                    // Pulsing effect
                    alpha *= 0.7 + 0.3 * sin(time * 2.0);
                    
                    // Glow effect
                    vec3 glow = vColor * (1.0 + (1.0 - dist) * 0.5);
                    
                    gl_FragColor = vec4(glow, alpha);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.group.add(this.particles);
        
        // Create connections
        this.createConnections(graphData);
        
        // Add nebula background
        this.createNebula();
        
        // Animate entrance
        this.animateEntrance();
    }
    
    createConnections(graphData) {
        const nodeMap = new Map();
        graphData.nodes.forEach(node => {
            nodeMap.set(node.id, node);
        });
        
        graphData.links.forEach(link => {
            const sourceNode = nodeMap.get(link.source);
            const targetNode = nodeMap.get(link.target);
            
            if (sourceNode?.cosmosPosition && targetNode?.cosmosPosition) {
                // Create curved connection
                const curve = new THREE.CatmullRomCurve3([
                    sourceNode.cosmosPosition,
                    new THREE.Vector3(
                        (sourceNode.cosmosPosition.x + targetNode.cosmosPosition.x) / 2,
                        (sourceNode.cosmosPosition.y + targetNode.cosmosPosition.y) / 2,
                        (sourceNode.cosmosPosition.z + targetNode.cosmosPosition.z) / 2
                    ).multiplyScalar(0.8),
                    targetNode.cosmosPosition
                ]);
                
                const points = curve.getPoints(20);
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                
                const material = new THREE.LineBasicMaterial({
                    color: 0x4488ff,
                    transparent: true,
                    opacity: 0.3,
                    blending: THREE.AdditiveBlending
                });
                
                const line = new THREE.Line(geometry, material);
                this.connections.push(line);
                this.group.add(line);
            }
        });
    }
    
    createNebula() {
        // Create nebula cloud effect
        const nebulaCount = 500;
        const nebulaPositions = new Float32Array(nebulaCount * 3);
        const nebulaColors = new Float32Array(nebulaCount * 3);
        
        for (let i = 0; i < nebulaCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = 80 + Math.random() * 40;
            
            nebulaPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            nebulaPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            nebulaPositions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Purple/blue nebula colors
            const hue = 0.7 + Math.random() * 0.2;
            const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
            nebulaColors[i * 3] = color.r;
            nebulaColors[i * 3 + 1] = color.g;
            nebulaColors[i * 3 + 2] = color.b;
        }
        
        const nebulaGeometry = new THREE.BufferGeometry();
        nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));
        nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));
        
        const nebulaMaterial = new THREE.PointsMaterial({
            size: 15,
            vertexColors: true,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending,
            depthTest: false
        });
        
        const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
        this.group.add(nebula);
    }
    
    animateEntrance() {
        // Scale up from center
        this.group.scale.set(0.1, 0.1, 0.1);
        gsap.to(this.group.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 2,
            ease: 'power2.out'
        });
        
        // Fade in connections
        this.connections.forEach((line, index) => {
            line.material.opacity = 0;
            gsap.to(line.material, {
                opacity: 0.3,
                duration: 1,
                delay: 0.5 + index * 0.01,
                ease: 'power2.in'
            });
        });
    }
    
    update() {
        if (this.particles) {
            this.time += 0.01;
            this.particles.material.uniforms.time.value = this.time;
            
            // Slow rotation
            this.group.rotation.y += 0.001;
        }
    }
    
    clear() {
        this.scene.remove(this.group);
        
        // Dispose resources
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Reset
        this.particles = null;
        this.connections = [];
        this.time = 0;
        
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }
    }
}