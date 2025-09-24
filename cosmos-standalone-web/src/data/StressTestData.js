export class StressTestData {
    static generateMassiveDataset(count = 1000000) {
        console.log(`Generating ${count} test nodes for stress testing...`);
        
        const nodes = [];
        const links = [];
        
        // Generate nodes
        for (let i = 0; i < count; i++) {
            const sourceTypes = ['github', 'objaverse', 'icosa', 'local', 'web'];
            const source = sourceTypes[i % sourceTypes.length];
            
            nodes.push({
                id: `stress-${i}`,
                name: this.generateName(i),
                source: source,
                type: this.getTypeForSource(source),
                description: this.generateDescription(i, source),
                val: Math.random() * 5 + 0.5,
                created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
            });
            
            // Generate some links (sparse to keep performance reasonable)
            if (i > 0 && Math.random() < 0.001) { // 0.1% chance of link
                const targetIndex = Math.floor(Math.random() * i);
                links.push({
                    source: `stress-${i}`,
                    target: `stress-${targetIndex}`,
                    value: Math.random()
                });
            }
            
            // Progress logging
            if (i % 100000 === 0 && i > 0) {
                console.log(`Generated ${i} / ${count} nodes...`);
            }
        }
        
        console.log(`Stress test dataset complete: ${nodes.length} nodes, ${links.length} links`);
        return { nodes, links };
    }
    
    static generateName(index) {
        const prefixes = [
            'Model', 'Project', 'Dataset', 'Repository', 'Asset', 'Component',
            'System', 'Framework', 'Library', 'Tool', 'Sample', 'Demo',
            'Prototype', 'Algorithm', 'Structure', 'Pattern', 'Template'
        ];
        
        const suffixes = [
            'Alpha', 'Beta', 'Core', 'Pro', 'Lite', 'Advanced', 'Basic',
            'Engine', 'Toolkit', 'Suite', 'Platform', 'Service', 'API',
            'SDK', 'Framework', 'Library', 'Module', 'Plugin'
        ];
        
        const prefix = prefixes[index % prefixes.length];
        const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];
        const number = String(index).padStart(6, '0');
        
        return `${prefix} ${suffix} ${number}`;
    }
    
    static getTypeForSource(source) {
        const types = {
            github: ['repository', 'user', 'organization'],
            objaverse: ['model', 'texture', 'material'],
            icosa: ['artwork', 'artist', 'collection'],
            local: ['file', 'folder', 'project'],
            web: ['page', 'resource', 'api']
        };
        
        const sourceTypes = types[source] || ['item'];
        return sourceTypes[Math.floor(Math.random() * sourceTypes.length)];
    }
    
    static generateDescription(index, source) {
        const templates = {
            github: [
                'Open source project for 3D development',
                'JavaScript library for WebGL applications',
                'Unity package for VR/AR experiences',
                'Python toolkit for 3D processing',
                'Cross-platform framework for immersive apps'
            ],
            objaverse: [
                'High-quality 3D model with PBR materials',
                'Procedurally generated geometric structure',
                'Scanned real-world object with textures',
                'Stylized character model for games',
                'Architectural element for virtual environments'
            ],
            icosa: [
                'Interactive 3D artwork by digital artist',
                'VR sculpture with dynamic lighting',
                'Immersive installation for galleries',
                'Collaborative virtual experience',
                'Generative art piece using algorithms'
            ],
            local: [
                'Local project file with development assets',
                'Cached data from external API source',
                'User-generated content and modifications',
                'Personal workspace configuration',
                'Custom tool or utility script'
            ],
            web: [
                'Web-based 3D visualization tool',
                'Online documentation and tutorials',
                'Community forum discussion thread',
                'Blog post about 3D development',
                'API endpoint for real-time data'
            ]
        };
        
        const sourceTemplates = templates[source] || ['Generic item description'];
        return sourceTemplates[index % sourceTemplates.length];
    }
    
    static async loadObjaverseSubset(maxItems = 100000) {
        try {
            const response = await fetch('/objaverse_gltf_index_lite.json');
            if (response.ok) {
                console.log('Loading Objaverse subset for stress testing...');
                const fullIndex = await response.json();
                
                // Take a subset for stress testing
                const subset = fullIndex.slice(0, maxItems);
                
                const nodes = subset.map((item, i) => ({
                    id: `objaverse-real-${i}`,
                    name: item.n || `Model ${i}`,
                    source: 'objaverse',
                    type: 'model',
                    description: `Real 3D model from ${item.s || 'GitHub'}`,
                    modelUrl: item.i,
                    format: item.n?.endsWith('.glb') ? 'glb' : 'gltf',
                    provider: item.s,
                    val: Math.random() * 3 + 1
                }));
                
                // Generate sparse connections
                const links = [];
                for (let i = 0; i < Math.min(nodes.length * 0.001, 1000); i++) {
                    const source = Math.floor(Math.random() * nodes.length);
                    const target = Math.floor(Math.random() * nodes.length);
                    if (source !== target) {
                        links.push({
                            source: nodes[source].id,
                            target: nodes[target].id,
                            value: Math.random()
                        });
                    }
                }
                
                console.log(`Loaded ${nodes.length} real Objaverse items with ${links.length} connections`);
                return { nodes, links };
            }
        } catch (error) {
            console.error('Failed to load Objaverse subset:', error);
            return this.generateMassiveDataset(maxItems);
        }
    }
}