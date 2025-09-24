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
            // Load from local Objaverse index if available
            const indexPath = '/objaverse_gltf_index_lite.json';
            
            try {
                const response = await fetch(indexPath);
                if (response.ok) {
                    const index = await response.json();
                    
                    // Search through the index - structure is different
                    // i: URL, n: name, s: source, g: array of filenames
                    const results = index.filter(item => {
                        const searchText = `${item.n || ''} ${item.g?.join(' ') || ''}`.toLowerCase();
                        return searchText.includes(query.toLowerCase());
                    }).slice(0, 20);
                    
                    return results.map((item, i) => ({
                        id: `objaverse-${i}`,
                        source: 'objaverse',
                        name: item.n || `Model ${i + 1}`,
                        description: `3D model from ${item.s || 'GitHub'}`,
                        modelUrl: item.i, // The URL
                        format: item.n?.endsWith('.glb') ? 'glb' : 'gltf',
                        provider: item.s
                    }));
                }
            } catch (err) {
                console.log('Local index not found, using sample data');
            }
            
            // Fallback to Objaverse sample objects with real URLs
            const objaverseModels = [
                {
                    name: 'Chair',
                    uid: 'chair-001',
                    glb_url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb'
                },
                {
                    name: 'Sci-Fi Helmet',
                    uid: 'helmet-001', 
                    glb_url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SciFiHelmet/glTF-Binary/SciFiHelmet.glb'
                },
                {
                    name: 'Boom Box',
                    uid: 'boombox-001',
                    glb_url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb'
                }
            ];
            
            const filtered = objaverseModels.filter(model =>
                model.name.toLowerCase().includes(query.toLowerCase()) || query === ''
            );
            
            return filtered.map((item, i) => ({
                id: `objaverse-${item.uid}`,
                source: 'objaverse',
                name: item.name,
                description: 'High-quality 3D model from Objaverse',
                modelUrl: item.glb_url,
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
            // Option 1: Use GitHub API (requires token for better rate limits)
            // const response = await fetch(`https://api.github.com/search/repositories?q=${query}+3d+webgl+gltf`, {
            //     headers: {
            //         'Accept': 'application/vnd.github.v3+json',
            //         // 'Authorization': 'token YOUR_GITHUB_TOKEN'
            //     }
            // });
            
            // Option 2: Load from sample GitHub Archive data
            try {
                // Try to fetch recent GitHub events
                const date = new Date();
                date.setHours(date.getHours() - 1); // Get previous hour
                const dateStr = date.toISOString().split('T')[0];
                const hour = date.getUTCHours();
                
                // GitHub Archive URL
                const archiveUrl = `https://data.gharchive.org/${dateStr}-${hour}.json.gz`;
                
                // For demo, use cached sample data
                const response = await fetch('/data/github-sample.json');
                if (response.ok) {
                    const events = await response.json();
                    return this.processGitHubEvents(events, query);
                }
            } catch (err) {
                console.log('Using fallback GitHub data');
            }
            
            // Fallback: Real 3D/WebGL related repositories
            const real3DRepos = [
                {
                    name: 'three.js',
                    owner: 'mrdoob',
                    description: 'JavaScript 3D library',
                    stars: 95000,
                    topics: ['3d', 'webgl', 'javascript']
                },
                {
                    name: 'react-three-fiber',
                    owner: 'pmndrs',
                    description: 'React renderer for three.js',
                    stars: 24000,
                    topics: ['react', 'threejs', '3d']
                },
                {
                    name: 'aframe',
                    owner: 'aframevr',
                    description: 'Web framework for building VR experiences',
                    stars: 15000,
                    topics: ['vr', 'webvr', '3d']
                },
                {
                    name: 'babylonjs',
                    owner: 'BabylonJS',
                    description: 'Powerful 3D engine',
                    stars: 21000,
                    topics: ['3d', 'webgl', 'game-engine']
                },
                {
                    name: 'model-viewer',
                    owner: 'google',
                    description: 'Display 3D models on the web',
                    stars: 5000,
                    topics: ['3d', 'gltf', 'web-components']
                }
            ];
            
            const filtered = real3DRepos.filter(repo => {
                const searchText = `${repo.name} ${repo.owner} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
                return searchText.includes(query.toLowerCase()) || query === '';
            });
            
            const nodes = [];
            const relationships = [];
            
            filtered.forEach((repo, i) => {
                // Add repo node
                const repoNode = {
                    id: `github-repo-${i}`,
                    source: 'github',
                    name: repo.name,
                    description: repo.description,
                    type: 'repository',
                    url: `https://github.com/${repo.owner}/${repo.name}`,
                    val: Math.log(repo.stars) / 2, // Size based on popularity
                    stars: repo.stars,
                    topics: repo.topics
                };
                nodes.push(repoNode);
                
                // Add owner node
                const ownerNode = {
                    id: `github-user-${i}`,
                    source: 'github',
                    name: repo.owner,
                    type: 'user',
                    url: `https://github.com/${repo.owner}`,
                    val: 2
                };
                nodes.push(ownerNode);
                
                // Add relationship
                relationships.push({
                    source: ownerNode.id,
                    target: repoNode.id,
                    strength: 1
                });
                
                // Add topic relationships
                if (i > 0 && repo.topics.some(topic => filtered[i-1].topics.includes(topic))) {
                    relationships.push({
                        source: repoNode.id,
                        target: `github-repo-${i-1}`,
                        strength: 0.5
                    });
                }
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
    
    processGitHubEvents(events, query) {
        const nodes = new Map();
        const relationships = [];
        
        events
            .filter(event => {
                const searchText = `${event.repo?.name || ''} ${event.actor?.login || ''}`.toLowerCase();
                return searchText.includes(query.toLowerCase());
            })
            .slice(0, 50)
            .forEach(event => {
                // Add actor
                const actorId = `github-actor-${event.actor?.id}`;
                if (!nodes.has(actorId)) {
                    nodes.set(actorId, {
                        id: actorId,
                        source: 'github',
                        name: event.actor?.login,
                        type: 'user',
                        url: `https://github.com/${event.actor?.login}`,
                        val: 1
                    });
                }
                
                // Add repo
                const repoId = `github-repo-${event.repo?.id}`;
                if (!nodes.has(repoId)) {
                    nodes.set(repoId, {
                        id: repoId,
                        source: 'github',
                        name: event.repo?.name,
                        type: 'repository',
                        url: `https://github.com/${event.repo?.name}`,
                        val: 2
                    });
                }
                
                relationships.push({
                    source: actorId,
                    target: repoId,
                    type: event.type
                });
            });
        
        return Array.from(nodes.values());
    }
}

class WebProvider {
    async search(query) {
        try {
            // Option 1: Use a search API like SerpAPI, Bing, etc (requires API key)
            // const response = await fetch(`https://api.serpapi.com/search?q=${query}&api_key=YOUR_KEY`);
            
            // Option 2: Use Wikipedia API for educational content
            try {
                const wikiResponse = await fetch(
                    `https://en.wikipedia.org/api/rest_v1/page/search/${encodeURIComponent(query)}?limit=5`
                );
                
                if (wikiResponse.ok) {
                    const wikiData = await wikiResponse.json();
                    return wikiData.pages.map((page, i) => ({
                        id: `wiki-${page.id}`,
                        source: 'web',
                        name: page.title,
                        description: page.description || page.extract,
                        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
                        thumbnail: page.thumbnail?.source
                    }));
                }
            } catch (err) {
                console.log('Wikipedia search failed, using fallback');
            }
            
            // Fallback: Curated 3D/XR web resources
            const webResources = [
                {
                    name: 'Three.js Documentation',
                    url: 'https://threejs.org/docs/',
                    description: 'Official Three.js documentation and examples'
                },
                {
                    name: 'WebXR Samples',
                    url: 'https://immersive-web.github.io/webxr-samples/',
                    description: 'WebXR API examples and demos'
                },
                {
                    name: 'Sketchfab',
                    url: 'https://sketchfab.com/',
                    description: 'Platform for publishing 3D models'
                },
                {
                    name: 'A-Frame School',
                    url: 'https://aframe.io/aframe-school/',
                    description: 'Interactive tutorials for WebVR'
                },
                {
                    name: 'Babylon.js Playground',
                    url: 'https://playground.babylonjs.com/',
                    description: 'Interactive Babylon.js examples'
                }
            ];
            
            const filtered = webResources.filter(resource => {
                const searchText = `${resource.name} ${resource.description}`.toLowerCase();
                return searchText.includes(query.toLowerCase()) || query === '';
            });
            
            return filtered.map((resource, i) => ({
                id: `web-${i}`,
                source: 'web',
                name: resource.name,
                description: resource.description,
                url: resource.url
            }));
            
        } catch (error) {
            console.error('Web search error:', error);
            return [{
                id: 'web-fallback',
                source: 'web',
                name: `Search web for "${query}"`,
                url: `https://www.google.com/search?q=${encodeURIComponent(query + ' 3d webgl webxr')}`,
                description: 'Search Google for 3D/WebGL/WebXR content'
            }];
        }
    }
}

class LocalProvider {
    async search(query) {
        // Would search local indexed files
        return [];
    }
}