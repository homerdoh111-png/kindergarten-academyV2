/**
 * GLTFLoader - Three.js loader for glTF 2.0 files
 * Simplified version for loading GLB models
 */

THREE.GLTFLoader = (function() {
  
  function GLTFLoader() {
    this.manager = THREE.DefaultLoadingManager;
  }

  GLTFLoader.prototype = {
    constructor: GLTFLoader,
    
    load: function(url, onLoad, onProgress, onError) {
      const scope = this;
      const loader = new THREE.FileLoader(scope.manager);
      loader.setResponseType('arraybuffer');
      
      loader.load(url, function(data) {
        try {
          scope.parse(data, '', onLoad, onError);
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      }, onProgress, onError);
    },
    
    parse: function(data, path, onLoad, onError) {
      const content = {};
      const extensions = {};
      const plugins = {};
      
      if (data instanceof ArrayBuffer) {
        const magic = new TextDecoder().decode(new Uint8Array(data, 0, 4));
        
        if (magic === 'glTF') {
          // GLB format
          try {
            const header = new Uint32Array(data, 0, 3);
            const version = header[1];
            
            if (version !== 2) {
              throw new Error('Unsupported glTF version: ' + version);
            }
            
            // Get JSON chunk
            const chunkView = new DataView(data, 12);
            const chunkLength = chunkView.getUint32(0, true);
            const chunkType = chunkView.getUint32(4, true);
            
            if (chunkType !== 0x4E4F534A) { // JSON
              throw new Error('First chunk must be JSON');
            }
            
            const jsonData = new Uint8Array(data, 20, chunkLength);
            const json = JSON.parse(new TextDecoder().decode(jsonData));
            
            // Get binary chunk if exists
            let buffers = null;
            const binaryChunkOffset = 20 + chunkLength;
            if (binaryChunkOffset < data.byteLength) {
              const binaryChunkView = new DataView(data, binaryChunkOffset);
              const binaryChunkLength = binaryChunkView.getUint32(0, true);
              buffers = data.slice(binaryChunkOffset + 8, binaryChunkOffset + 8 + binaryChunkLength);
            }
            
            // Parse GLTF
            this.parseGLTF(json, buffers, onLoad, onError);
            
          } catch (e) {
            if (onError) onError(e);
            else console.error('GLTFLoader: Error parsing GLB:', e);
          }
        }
      }
    },
    
    parseGLTF: function(json, bufferData, onLoad, onError) {
      const scope = this;
      
      try {
        // Create scene
        const scene = new THREE.Group();
        scene.name = 'Scene';
        
        // Parse buffers
        const buffers = [];
        if (json.buffers && bufferData) {
          buffers.push(bufferData);
        }
        
        // Parse buffer views
        const bufferViews = [];
        if (json.bufferViews) {
          json.bufferViews.forEach(function(bufferView) {
            const buffer = buffers[bufferView.buffer];
            const byteOffset = bufferView.byteOffset || 0;
            const byteLength = bufferView.byteLength;
            bufferViews.push(buffer.slice(byteOffset, byteOffset + byteLength));
          });
        }
        
        // Parse accessors
        const accessors = [];
        if (json.accessors) {
          json.accessors.forEach(function(accessor) {
            const bufferView = bufferViews[accessor.bufferView];
            const itemSize = {
              'SCALAR': 1,
              'VEC2': 2,
              'VEC3': 3,
              'VEC4': 4,
              'MAT2': 4,
              'MAT3': 9,
              'MAT4': 16
            }[accessor.type];
            
            const TypedArray = {
              5120: Int8Array,
              5121: Uint8Array,
              5122: Int16Array,
              5123: Uint16Array,
              5125: Uint32Array,
              5126: Float32Array
            }[accessor.componentType];
            
            const byteOffset = accessor.byteOffset || 0;
            const array = new TypedArray(bufferView, byteOffset, accessor.count * itemSize);
            accessors.push(array);
          });
        }
        
        // Parse meshes
        const meshes = [];
        if (json.meshes) {
          json.meshes.forEach(function(meshDef) {
            const group = new THREE.Group();
            group.name = meshDef.name || '';
            
            meshDef.primitives.forEach(function(primitive) {
              const geometry = new THREE.BufferGeometry();
              
              // Add attributes
              if (primitive.attributes.POSITION !== undefined) {
                const positions = accessors[primitive.attributes.POSITION];
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
              }
              
              if (primitive.attributes.NORMAL !== undefined) {
                const normals = accessors[primitive.attributes.NORMAL];
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
              }
              
              if (primitive.attributes.TEXCOORD_0 !== undefined) {
                const uvs = accessors[primitive.attributes.TEXCOORD_0];
                geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
              }
              
              // Add indices if present
              if (primitive.indices !== undefined) {
                const indices = accessors[primitive.indices];
                geometry.setIndex(new THREE.BufferAttribute(indices, 1));
              }
              
              // Create material
              const material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.7,
                metalness: 0.1
              });
              
              const mesh = new THREE.Mesh(geometry, material);
              group.add(mesh);
            });
            
            meshes.push(group);
          });
        }
        
        // Parse nodes and build scene
        if (json.nodes) {
          json.nodes.forEach(function(nodeDef, nodeIndex) {
            if (nodeDef.mesh !== undefined) {
              const mesh = meshes[nodeDef.mesh].clone();
              
              if (nodeDef.translation) {
                mesh.position.fromArray(nodeDef.translation);
              }
              if (nodeDef.rotation) {
                mesh.quaternion.fromArray(nodeDef.rotation);
              }
              if (nodeDef.scale) {
                mesh.scale.fromArray(nodeDef.scale);
              }
              
              scene.add(mesh);
            }
          });
        }
        
        // Return result
        const result = {
          scene: scene,
          scenes: [scene],
          cameras: [],
          animations: [],
          asset: json.asset || {}
        };
        
        if (onLoad) onLoad(result);
        
      } catch (e) {
        if (onError) onError(e);
        else console.error('GLTFLoader: Error parsing GLTF:', e);
      }
    }
  };

  return GLTFLoader;

})();

console.log('GLTFLoader: Loaded successfully');
