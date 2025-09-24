export class UIController {
    constructor(app) {
        this.app = app;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        
        this.init();
    }
    
    init() {
        this.setupSearchControls();
        this.setupLayoutControls();
        this.setupFileHandling();
        this.setupViewerControls();
        this.setupStats();
    }
    
    setupSearchControls() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        const performSearch = () => {
            const query = searchInput.value.trim();
            if (query) {
                const sources = this.getSelectedSources();
                this.app.performSearch(query, sources);
            }
        };
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        searchBtn.addEventListener('click', performSearch);
    }
    
    setupLayoutControls() {
        const layoutRadios = document.querySelectorAll('input[name="layout"]');
        
        layoutRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked && this.app.lastGraphData) {
                    this.app.updateVisualization(this.app.lastGraphData);
                }
            });
        });
    }
    
    setupFileHandling() {
        const fileInput = document.getElementById('fileInput');
        const dropZone = document.getElementById('dropZone');
        
        // File input
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                this.handleFiles(files);
            }
        });
        
        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
        
        // Global drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            if (e.target !== dropZone && !dropZone.contains(e.target)) {
                e.preventDefault();
                const files = e.dataTransfer.files;
                this.handleFiles(files);
            }
        });
    }
    
    setupViewerControls() {
        const viewerBtns = document.querySelectorAll('.viewer-btn');
        
        viewerBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                viewerBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Switch mode
                const mode = btn.dataset.viewer;
                this.app.switchMode(mode);
            });
        });
        
        // Close button for Icosa viewer
        window.closeIcosaViewer = () => {
            document.getElementById('icosaViewer').classList.remove('active');
            document.querySelector('[data-viewer="graph"]').click();
        };
    }
    
    setupStats() {
        // Update FPS every second
        setInterval(() => {
            this.fps = this.frameCount;
            this.frameCount = 0;
            document.getElementById('fps').textContent = `FPS: ${this.fps}`;
        }, 1000);
    }
    
    getSelectedSources() {
        const checkboxes = document.querySelectorAll('.source:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    getSelectedLayout() {
        const selected = document.querySelector('input[name="layout"]:checked');
        return selected ? selected.value : 'force';
    }
    
    handleFiles(files) {
        for (const file of files) {
            this.app.loadFile(file);
        }
    }
    
    showLoading() {
        const loading = document.getElementById('loadingIndicator');
        loading.classList.add('active');
    }
    
    hideLoading() {
        const loading = document.getElementById('loadingIndicator');
        loading.classList.remove('active');
    }
    
    updateLoadingProgress(percent) {
        // Could add progress bar here
        console.log(`Loading: ${percent.toFixed(1)}%`);
    }
    
    updateStats(stats) {
        document.getElementById('nodeCount').textContent = `Nodes: ${stats.nodes || 0}`;
        document.getElementById('linkCount').textContent = `Links: ${stats.links || 0}`;
    }
    
    updateFPS() {
        this.frameCount++;
    }
    
    async showIcosaViewer() {
        const viewer = document.getElementById('icosaViewer');
        const frame = document.getElementById('icosaFrame');
        
        try {
            // Fetch random artwork
            const response = await fetch('https://api.icosa.foundation/artworks/random');
            const artwork = await response.json();
            
            // Load in iframe
            frame.src = `https://icosa.foundation/artworks/${artwork.id}/embed`;
            viewer.classList.add('active');
        } catch (error) {
            console.error('Failed to load Icosa viewer:', error);
            // Fallback to main gallery
            frame.src = 'https://icosa.foundation/gallery/embed';
            viewer.classList.add('active');
        }
    }
}