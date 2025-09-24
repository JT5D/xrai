import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
// import ForceGraph3D from '3d-force-graph';
import { gsap } from 'gsap';
import { VisualizationManager } from './visualization/VisualizationManager.js';
import { DataManager } from './data/DataManager.js';
import { ModelLoader } from './loaders/ModelLoader.js';
import { UIController } from './ui/UIController.js';

class CosmosVisualizer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.currentMode = 'graph';
        this.forceGraph = null;
        
        // Managers
        this.visualizationManager = null;
        this.dataManager = new DataManager();
        this.modelLoader = new ModelLoader();
        this.uiController = new UIController(this);
        
        this.init();
    }
    
    async init() {
        console.log('Initializing Cosmos Visualizer...');
        try {
            await this.setupScene();
            console.log('Scene setup complete');
            
            this.setupManagers();
            console.log('Managers setup complete');
            
            this.setupEventListeners();
            console.log('Event listeners setup complete');
            
            this.animate();
            console.log('Animation started');
            
            // Load initial data if available
            await this.loadInitialData();
            console.log('Initial data loaded');
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }
    
    async setupScene() {
        console.log('Setting up scene...');
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a); // Slightly lighter than black
        this.scene.fog = new THREE.Fog(0x0a0a0a, 100, 1000);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2000
        );
        this.camera.position.set(0, 50, 100);
        
        // Renderer with WebGPU support check
        const canvas = document.getElementById('canvas');
        
        if (navigator.gpu) {
            // WebGPU is available
            console.log('WebGPU detected, using WebGPU renderer');
            // Would use WebGPURenderer here when Three.js fully supports it
            this.renderer = new THREE.WebGLRenderer({ 
                canvas, 
                antialias: true,
                powerPreference: 'high-performance'
            });
        } else {
            // Fallback to WebGL
            this.renderer = new THREE.WebGLRenderer({ 
                canvas, 
                antialias: true 
            });
        }
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Add starfield
        await this.createStarfield();
        
        // Load HDRI environment
        await this.loadEnvironment();
    }
    
    async createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 0.7,
            transparent: true,
            opacity: 0.8
        });
        
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }
    
    async loadEnvironment() {
        const rgbeLoader = new RGBELoader();
        try {
            const texture = await rgbeLoader.loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/moonless_golf_1k.hdr');
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
        } catch (error) {
            console.warn('Failed to load HDRI environment:', error);
        }
    }
    
    setupManagers() {
        this.visualizationManager = new VisualizationManager(this.scene, this.camera);
        
        // Setup model loader callbacks
        this.modelLoader.onProgress = (progress) => {
            this.uiController.updateLoadingProgress(progress);
        };
        
        this.modelLoader.onComplete = (model) => {
            this.scene.add(model);
            this.uiController.hideLoading();
        };
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Mouse events for interaction
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        
        // UI events are handled by UIController
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (this.forceGraph) {
            this.forceGraph.width(window.innerWidth);
            this.forceGraph.height(window.innerHeight);
        }
    }
    
    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update tooltip
        this.updateTooltip(event);
    }
    
    onMouseClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData && object.userData.nodeData) {
                this.handleNodeClick(object.userData.nodeData);
            }
        }
    }
    
    updateTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0 && intersects[0].object.userData.nodeData) {
            const data = intersects[0].object.userData.nodeData;
            tooltip.style.display = 'block';
            tooltip.style.left = event.clientX + 10 + 'px';
            tooltip.style.top = event.clientY + 10 + 'px';
            tooltip.textContent = data.name || data.id;
        } else {
            tooltip.style.display = 'none';
        }
    }
    
    async handleNodeClick(nodeData) {
        console.log('Node clicked:', nodeData);
        
        if (nodeData.modelUrl) {
            // Option 1: Load in scene
            if (this.currentMode === 'graph') {
                this.uiController.showLoading();
                try {
                    const model = await this.modelLoader.load(nodeData.modelUrl, nodeData.format);
                    this.displayModel(model);
                } catch (error) {
                    console.error('Failed to load model:', error);
                    this.uiController.hideLoading();
                }
            } 
            // Option 2: Load in Icosa viewer
            else if (this.currentMode === 'icosa') {
                const icosaFrame = document.getElementById('icosaFrame');
                if (icosaFrame && icosaFrame.contentWindow) {
                    icosaFrame.contentWindow.postMessage({
                        modelUrl: nodeData.modelUrl
                    }, '*');
                }
            }
        } else if (nodeData.url) {
            window.open(nodeData.url, '_blank');
        }
    }
    
    displayModel(model) {
        // Clear previous models
        this.clearModels();
        
        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 50 / maxDim;
        
        model.scale.multiplyScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        
        this.scene.add(model);
        
        // Animate camera to focus on model
        gsap.to(this.camera.position, {
            x: 0,
            y: 25,
            z: 75,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => this.camera.lookAt(0, 0, 0)
        });
    }
    
    clearModels() {
        const modelsToRemove = [];
        this.scene.traverse((child) => {
            if (child.userData.isLoadedModel) {
                modelsToRemove.push(child);
            }
        });
        
        modelsToRemove.forEach(model => {
            this.scene.remove(model);
            if (model.geometry) model.geometry.dispose();
            if (model.material) {
                if (Array.isArray(model.material)) {
                    model.material.forEach(mat => mat.dispose());
                } else {
                    model.material.dispose();
                }
            }
        });
    }
    
    async performSearch(query, sources) {
        this.uiController.showLoading();
        
        try {
            const results = await this.dataManager.search(query, sources);
            const graphData = this.dataManager.convertToGraphData(results);
            
            await this.updateVisualization(graphData);
            
            // Update stats
            this.uiController.updateStats({
                nodes: graphData.nodes.length,
                links: graphData.links.length
            });
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            this.uiController.hideLoading();
        }
    }
    
    async updateVisualization(graphData) {
        const layout = this.uiController.getSelectedLayout();
        
        // Clear existing visualization
        this.clearVisualization();
        
        switch (layout) {
            case 'force':
                this.createForceGraph(graphData);
                break;
            case 'city':
                await this.visualizationManager.createCityBlocks(graphData);
                break;
            case 'cosmos':
                await this.visualizationManager.createCosmos(graphData);
                break;
            case 'tree':
                await this.visualizationManager.createTree(graphData);
                break;
        }
    }
    
    createForceGraph(graphData) {
        // For now, use cosmos layout as force graph alternative
        this.visualizationManager.createCosmos(graphData);
    }
    
    createNodeTexture(node) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        const colors = {
            icosa: '#FF6B6B',
            objaverse: '#4ECDC4',
            github: '#95E1D3',
            local: '#F38181',
            web: '#AA96DA'
        };
        
        const color = colors[node.type] || '#FFFFFF';
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(64, 64, 50, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const text = node.name ? node.name.substring(0, 3).toUpperCase() : '?';
        ctx.fillText(text, 64, 64);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    clearVisualization() {
        // Remove force graph if exists
        if (this.forceGraph) {
            const graphElement = document.querySelector('.force-graph-3d');
            if (graphElement) {
                graphElement.remove();
            }
            this.forceGraph = null;
        }
        
        // Clear visualization manager
        this.visualizationManager.clear();
    }
    
    switchMode(mode) {
        this.currentMode = mode;
        
        switch (mode) {
            case 'graph':
                this.clearVisualization();
                if (this.lastGraphData) {
                    this.updateVisualization(this.lastGraphData);
                }
                break;
            case 'metavido':
                this.clearVisualization();
                this.visualizationManager.showMetavidoVFX();
                break;
            case 'icosa':
                this.uiController.showIcosaViewer();
                break;
        }
    }
    
    async loadFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'json') {
            // Handle JSON data
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (Array.isArray(data) || (data.nodes && data.links)) {
                // Graph data
                const graphData = data.nodes ? data : this.dataManager.convertToGraphData(data);
                this.lastGraphData = graphData;
                await this.updateVisualization(graphData);
            }
        } else if (['gltf', 'glb', 'obj', 'fbx', 'usdz'].includes(extension)) {
            // 3D model
            this.uiController.showLoading();
            const url = URL.createObjectURL(file);
            try {
                const model = await this.modelLoader.load(url, extension);
                this.displayModel(model);
            } catch (error) {
                console.error('Failed to load model:', error);
            } finally {
                this.uiController.hideLoading();
                URL.revokeObjectURL(url);
            }
        }
    }
    
    async loadInitialData() {
        // Check if there's sample data to load
        try {
            console.log('Loading sample data...');
            const response = await fetch('/data/sample.json');
            if (response.ok) {
                const data = await response.json();
                console.log('Sample data loaded:', data);
                this.lastGraphData = this.dataManager.convertToGraphData(data);
                await this.updateVisualization(this.lastGraphData);
            } else {
                console.log('Sample data not found, showing welcome message');
                // Show some default content
                this.showWelcome();
            }
        } catch (error) {
            console.log('Error loading initial data:', error);
            this.showWelcome();
        }
    }
    
    showWelcome() {
        // Add a simple welcome mesh
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x0066ff,
            emissive: 0x0066ff,
            emissiveIntensity: 0.2
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0, 0);
        this.scene.add(cube);
        
        // Animate it
        const animate = () => {
            cube.rotation.x += 0.01;
            cube.rotation.y += 0.01;
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        this.controls.update();
        
        // Update visualization animations
        this.visualizationManager.update();
        
        // Update FPS counter
        this.uiController.updateFPS();
        
        // Render scene only if not in force graph mode
        if (this.currentMode !== 'graph' || !this.forceGraph) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Initialize application
window.addEventListener('DOMContentLoaded', () => {
    window.cosmosVisualizer = new CosmosVisualizer();
});