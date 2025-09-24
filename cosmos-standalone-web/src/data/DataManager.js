import axios from 'axios';
import pako from 'pako';

export class DataManager {
    constructor() {
        this.cache = new Map();
        this.searchProviders = {
            icosa: new IcosaProvider(),
            objaverse: new ObjaverseProvider(),
            github: new GitHubProvider(),
            web: new WebProvider(),
            local: new LocalProvider()
        };
    }
    
    async search(query, sources = ['all']) {
        const results = [];
        const activeSources = sources.includes('all') 
            ? Object.keys(this.searchProviders)
            : sources;
        
        // Search all sources in parallel
        const promises = activeSources.map(source => {
            return this.searchProviders[source]
                ?.search(query)
                .catch(err => {
                    console.error(`Search error in ${source}:`, err);
                    return [];
                });
        });
        
        const sourceResults = await Promise.all(promises);
        sourceResults.forEach(items => {
            if (Array.isArray(items)) {
                results.push(...items);
            }
        });
        
        return this.rankResults(results, query);
    }
    
    rankResults(results, query) {
        // Simple relevance ranking
        return results
            .map(result => ({
                ...result,
                relevance: this.calculateRelevance(query, result)
            }))
            .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
            .slice(0, 100); // Limit to 100 results
    }
    
    calculateRelevance(query, result) {
        const queryLower = query.toLowerCase();
        const text = `${result.name || ''} ${result.description || ''}`.toLowerCase();
        
        let score = 0;
        if (text.includes(queryLower)) score += 0.5;
        
        const words = queryLower.split(/\s+/);
        words.forEach(word => {
            if (text.includes(word)) {
                score += 0.3 / words.length;
            }
        });
        
        return Math.min(score, 1);
    }
    
    convertToGraphData(items) {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        
        // Create nodes
        items.forEach((item, index) => {
            const node = {
                id: item.id || `node-${index}`,
                name: item.name || item.title || 'Untitled',
                type: item.source || 'unknown',
                val: item.relevance || 1,
                ...item
            };
            
            nodes.push(node);
            nodeMap.set(node.id, node);
        });
        
        // Create links based on relationships or similarity
        items.forEach(item => {
            if (item.relationships) {
                item.relationships.forEach(rel => {
                    if (nodeMap.has(rel.target)) {
                        links.push({
                            source: item.id,
                            target: rel.target,
                            value: rel.strength || 1
                        });
                    }
                });
            }
        });
        
        // Add similarity links if no explicit relationships
        if (links.length === 0 && nodes.length > 1) {
            // Create some connections based on type
            const typeGroups = new Map();
            nodes.forEach(node => {
                if (!typeGroups.has(node.type)) {
                    typeGroups.set(node.type, []);
                }
                typeGroups.get(node.type).push(node);
            });
            
            // Connect nodes within same type
            typeGroups.forEach(group => {
                for (let i = 0; i < group.length - 1; i++) {
                    links.push({
                        source: group[i].id,
                        target: group[i + 1].id,
                        value: 0.5
                    });
                }
            });
        }
        
        return { nodes, links };
    }
}

// Search Providers
class IcosaProvider {
    async search(query) {
        try {
            // Note: Icosa Gallery is now Poly (poly.cam)
            // For demo purposes, return sample 3D models
            // In production, you would integrate with Poly's API
            
            // Sample GLTF models from various sources
            const sampleModels = [
                {
                    name: 'Astronaut',
                    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb'
                },
                {
                    name: 'Damaged Helmet',
                    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb'
                },
                {
                    name: 'Flight Helmet',
                    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/FlightHelmet/glTF/FlightHelmet.gltf'
                },
                {
                    name: 'Lantern',
                    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb'
                },
                {
                    name: 'Water Bottle',
                    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb'
                }
            ];
            
            // Filter by query
            const filtered = sampleModels.filter(model => 
                model.name.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase() === 'all'
            );
            
            return filtered.slice(0, 5).map((model, i) => ({
                id: `icosa-${i}`,
                source: 'icosa',
                name: model.name,
                description: `3D model from Poly Gallery`,
                modelUrl: model.modelUrl,
                format: 'glb',
                thumbnail: `https://picsum.photos/200?random=${i}`,
                url: 'https://poly.cam/'
            }));
        } catch (error) {
            console.error('Icosa search error:', error);
            return [];
        }
    }
}

class ObjaverseProvider {
    async search(query) {
        try {
            // Mock Objaverse results
            return Array.from({ length: 3 }, (_, i) => ({
                id: `objaverse-${i}`,
                source: 'objaverse',
                name: `${query} Object ${i + 1}`,
                description: `3D object from Objaverse`,
                modelUrl: `https://example.com/objaverse${i}.glb`,
                format: 'glb'
            }));
        } catch (error) {
            console.error('Objaverse search error:', error);
            return [];
        }
    }
}

class GitHubProvider {
    async search(query) {
        try {
            // For demo, return mock GitHub data
            const repos = [
                { name: 'awesome-3d', owner: 'user1' },
                { name: '3d-models', owner: 'user2' },
                { name: 'webgl-demos', owner: 'user3' }
            ];
            
            const nodes = [];
            const relationships = [];
            
            repos.forEach((repo, i) => {
                // Add repo node
                const repoNode = {
                    id: `github-repo-${i}`,
                    source: 'github',
                    name: repo.name,
                    type: 'repository',
                    url: `https://github.com/${repo.owner}/${repo.name}`
                };
                nodes.push(repoNode);
                
                // Add owner node
                const ownerNode = {
                    id: `github-user-${i}`,
                    source: 'github',
                    name: repo.owner,
                    type: 'user',
                    url: `https://github.com/${repo.owner}`
                };
                nodes.push(ownerNode);
                
                // Add relationship
                relationships.push({
                    source: ownerNode.id,
                    target: repoNode.id,
                    strength: 1
                });
            });
            
            // Add relationships to nodes
            nodes.forEach(node => {
                node.relationships = relationships
                    .filter(rel => rel.source === node.id || rel.target === node.id)
                    .map(rel => ({
                        target: rel.source === node.id ? rel.target : rel.source,
                        strength: rel.strength
                    }));
            });
            
            return nodes;
        } catch (error) {
            console.error('GitHub search error:', error);
            return [];
        }
    }
}

class WebProvider {
    async search(query) {
        // Mock web search results
        return [{
            id: 'web-1',
            source: 'web',
            name: `Web results for "${query}"`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            description: 'Search the web for more results'
        }];
    }
}

class LocalProvider {
    async search(query) {
        // Would search local indexed files
        return [];
    }
}