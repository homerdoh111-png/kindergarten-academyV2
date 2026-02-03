/* Buddy3D - Bright Pastel Forest Edition
   Complete rebuild: Modern cute bear design + 3D forest treehouse environment
   Color scheme: Sky blues, soft pastels, mint greens, lavender
*/
(function () {
  if (window.Buddy3D) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const state = {
    ready: false,
    talking: false,
    targetMouth: 0,
    mouth: 0,
    targetSmile: 0.35,
    smile: 0.35,
    targetBrow: 0,
    brow: 0,
    blink: 0,
    nextBlinkAt: 0,
    wave: 0,
    waveVel: 0,
    t0: performance.now(),
    last: performance.now(),
    text: "",
    lastBoundaryIdx: 0,
    listening: 0,
    thinking: 0,
    giggle: 0,
    gigglePhase: 0,
    mouthDirect: -1,
  };

  function makeNoiseTexture(size, baseRGB, variance=18) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(size, size);
    const [br,bg,bb] = baseRGB;
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() * 2 - 1) * variance;
      img.data[i] = clamp(br + n, 0, 255);
      img.data[i+1] = clamp(bg + n, 0, 255);
      img.data[i+2] = clamp(bb + n, 0, 255);
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = 4;
    return tex;
  }

  function ensureThree() {
    return typeof window.THREE !== "undefined";
  }

  function estimateViseme(char) {
    const c = (char || "").toLowerCase();
    if ("aei".includes(c)) return 0.55;
    if ("ou".includes(c)) return 0.70;
    if ("bmp".includes(c)) return 0.10;
    if ("fv".includes(c)) return 0.30;
    if ("tcdgknsxzj".includes(c)) return 0.35;
    if (c === " ") return 0.05;
    return 0.40;
  }

  function pickNextBlink(now) {
    state.nextBlinkAt = now + (2500 + Math.random() * 4000);
  }

  function init(container) {
    if (!ensureThree()) {
      console.warn("Buddy3D: THREE not found.");
      return null;
    }
    if (!container) {
      console.warn("Buddy3D: Container not found.");
      return null;
    }

    console.log("Buddy3D: Initializing...", container);
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    renderer.setPixelRatio(dpr);
    const initRect = container.getBoundingClientRect();
    console.log("Buddy3D: Container dimensions:", initRect.width, "x", initRect.height);
    
    renderer.setSize(Math.max(1, Math.round(initRect.width)), Math.max(1, Math.round(initRect.height)), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    
    console.log("Buddy3D: Renderer created and appended to container");

    // Scene - Warm natural environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xA8E6CF); // soft mint green
    scene.fog = new THREE.FogExp2(0xC5E9D5, 0.015); // light misty fog

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, initRect.width) / Math.max(1, initRect.height),
      0.1,
      50
    );
    camera.position.set(0, 0.95, 4.6);
    camera.lookAt(0, 0.72, 0.25);

    // ── WARM NATURAL LIGHTING ──
    // Ambient: warm soft light
    scene.add(new THREE.AmbientLight(0xFFE8CC, 0.6));

    // Key light: warm golden from top-right
    const key = new THREE.DirectionalLight(0xFFDDAA, 1.2);
    key.position.set(3.5, 5.5, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.001;
    scene.add(key);

    // Fill: cool-warm from left
    const fill = new THREE.DirectionalLight(0xDDCCFF, 0.42);
    fill.position.set(-5.0, 2.5, 5.5);
    scene.add(fill);

    // Rim: warm orange edge glow
    const rim = new THREE.DirectionalLight(0xFF9933, 0.68);
    rim.position.set(-2.0, 3.5, -6.0);
    scene.add(rim);

    // ── SIMPLE NATURAL ENVIRONMENT ──
    const environment = new THREE.Group();
    scene.add(environment);

    // Ground - Natural grass
    const groundGeo = new THREE.PlaneGeometry(28, 28);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x7EC850,
      roughness: 0.9,
      metalness: 0.0,
      map: makeNoiseTexture(128, [126, 200, 80], 16),
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    environment.add(ground);

    // Shadow catcher
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -1.48;
    shadowCatcher.receiveShadow = true;
    environment.add(shadowCatcher);

    // Simple background trees (just basic shapes for depth)
    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x52B788,
      roughness: 0.9,
    });
    
    function createSimpleTree(x, z) {
      const tree = new THREE.Group();
      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 })
      );
      trunk.position.y = -0.75;
      tree.add(trunk);
      
      // Foliage
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 8),
        treeMat
      );
      foliage.position.y = 0.3;
      tree.add(foliage);
      
      tree.position.set(x, 0, z);
      return tree;
    }

    // Add a few trees in background
    environment.add(createSimpleTree(-3, -4));
    environment.add(createSimpleTree(3, -4));
    environment.add(createSimpleTree(0, -5));
    environment.add(createSimpleTree(-4.5, -3.5));
    environment.add(createSimpleTree(4.5, -3.5));

    // ══════════════════════════════════════════════════════════════
    // ── BUDDY CHARACTER - GLB MODEL ──
    // ══════════════════════════════════════════════════════════════

    const buddy = new THREE.Group();
    buddy.position.set(0, -0.2, 0);
    scene.add(buddy);

    // Load GLB model
    let buddyModel = null;
    let mixer = null; // For animations if the model has them
    
    // Check if GLTFLoader is available
    if (!THREE.GLTFLoader) {
      console.error('Buddy3D: GLTFLoader not found!');
      console.log('Buddy3D: Check that GLTFLoader.js script is loading correctly');
      console.log('Buddy3D: Creating placeholder instead...');
      
      // Create placeholder
      const placeholder = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 32, 32),
        new THREE.MeshStandardMaterial({ color: 0xD4944E, roughness: 0.7 })
      );
      placeholder.castShadow = true;
      placeholder.position.y = 0.5;
      buddy.add(placeholder);
      
    } else {
      const loader = new THREE.GLTFLoader();
      
      // Load from GitHub raw URL (corrected repo name)
      const modelPath = 'https://raw.githubusercontent.com/homerdoh111-png/kindergarten-academy/main/buddy-model.glb';
      
      console.log('Buddy3D: Attempting to load GLB model from GitHub...');
    
    loader.load(
      modelPath,
      function (gltf) {
        console.log('Buddy3D: GLB model loaded successfully!');
        
        buddyModel = gltf.scene;
        
        // Scale and position the model (adjust these as needed)
        buddyModel.scale.set(1, 1, 1); // May need adjustment
        buddyModel.position.set(0, -0.5, 0); // May need adjustment
        
        // Enable shadows
        buddyModel.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Ensure materials render properly
            if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });
        
        buddy.add(buddyModel);
        
        // Set up animation mixer if model has animations
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(buddyModel);
          console.log('Buddy3D: Found', gltf.animations.length, 'animations');
          
          // List all animations
          gltf.animations.forEach((clip, i) => {
            console.log(`  Animation ${i}: ${clip.name}`);
          });
          
          // Play first animation by default (usually idle)
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
          console.log('Buddy3D: Playing animation:', gltf.animations[0].name);
        }
        
        console.log('Buddy3D: Model setup complete');
        console.log('Buddy3D: Model bounds:', buddyModel.position, buddyModel.scale);
      },
      function (progress) {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total * 100).toFixed(0);
          console.log('Buddy3D: Loading model...', percent + '%');
        } else {
          console.log('Buddy3D: Loading model...', (progress.loaded / 1024 / 1024).toFixed(1) + 'MB loaded');
        }
      },
      function (error) {
        console.error('Buddy3D: Error loading GLB model:', error);
        console.log('Buddy3D: Falling back to placeholder...');
        
        // Create a simple placeholder if model fails to load
        const placeholder = new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 32, 32),
          new THREE.MeshStandardMaterial({ 
            color: 0xD4944E,
            roughness: 0.7,
          })
        );
        placeholder.castShadow = true;
        placeholder.position.y = 0.5;
        buddy.add(placeholder);
        
        // Add a message sphere
        console.log('Buddy3D: If you see a brown sphere, the GLB failed to load.');
        console.log('Buddy3D: Check if the Google Drive link is set to "Anyone with the link can view"');
      }
    );
    } // End of if (THREE.GLTFLoader) check


    // Store references for animation
    const refs = {
      buddy,
      buddyModel: null, // Will be set after model loads
      mixer: null,
    };

    state.ready = true;
    pickNextBlink(performance.now());

    function animate() {
      const now = performance.now();
      const dt = Math.min((now - state.last) / 1000, 0.1);
      state.last = now;
      const t = (now - state.t0) / 1000;

      // Update animation mixer if model has animations
      if (mixer) {
        mixer.update(dt);
      }

      // Idle breathing animation (only if we have the model)
      if (buddyModel) {
        const breathe = Math.sin(t * 1.8) * 0.02;
        buddyModel.position.y = breathe * 0.5;
      }


      // Note: Blink animation removed for GLB model
      // If your GLB model has blink animations, they'll be handled by the mixer

      // Mouth animation (simplified for GLB model)
      if (state.mouthDirect >= 0) {
        state.targetMouth = state.mouthDirect;
      }
      state.mouth = lerp(state.mouth, state.targetMouth, 0.25);
      
      // If model is loaded, we could animate jaw here if needed
      // For now, let the model's own animations handle talking

      // Other animation states can be preserved
      state.smile = lerp(state.smile, state.targetSmile, 0.08);
      state.brow = lerp(state.brow, state.targetBrow, 0.12);

      // Wave animation (simplified for GLB model)
      if (state.wave > 0) {
        state.wave = Math.max(0, state.wave - dt * 1.2);
        // GLB model can handle its own wave animation if it has one
      }

      // Listening
      state.listening = lerp(state.listening, 0, 0.1);
      if (state.listening > 0.01) {
        const perk = state.listening * 0.15;
        earL.rotation.z = 0.15 + perk;
        earR.rotation.z = -0.15 - perk;
        eyeL.scale.setScalar(1.0 + state.listening * 0.08);
        eyeR.scale.setScalar(1.0 + state.listening * 0.08);
      }

      // Thinking
      state.thinking = lerp(state.thinking, 0, 0.08);
      if (state.thinking > 0.01) {
        head.rotation.z = state.thinking * 0.18;
        head.rotation.y = state.thinking * 0.12;
        eyeL.userData.iris.position.x = state.thinking * 0.04;
        eyeR.userData.iris.position.x = state.thinking * 0.04;
      }

      // Giggle
      if (state.giggle > 0) {
        state.gigglePhase += dt * 12;
        state.giggle = Math.max(0, state.giggle - dt * 1.5);
        const bounce = Math.sin(state.gigglePhase) * state.giggle * 0.08;
        body.position.y = breathe * 0.5 + bounce;
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();

    // Resize handler
    function onResize() {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    console.log("Buddy3D: Initialization complete! Scene has", scene.children.length, "children");

    return {
      state,
      scene,
      camera,
      renderer,
      buddy,
      environment,
      refs,
      onResize,
      setMouth: (v) => { state.targetMouth = clamp(v, 0, 1); },
      setSmile: (v) => { state.targetSmile = clamp(v, 0, 1); },
      setBrow: (v) => { state.targetBrow = clamp(v, -1, 1); },
      wave: () => { state.wave = 1.0; },
      startListening: () => { state.listening = 1.0; },
      startThinking: () => { state.thinking = 1.0; },
      giggle: () => { state.giggle = 1.0; state.gigglePhase = 0; },
      setMouthDirect: (v) => { state.mouthDirect = v; },
      speak: function (text, rate = 1.0) {
        state.talking = true;
        state.text = text;
        state.lastBoundaryIdx = 0;
        const baseDelay = 80 / rate;
        let charIdx = 0;

        function nextChar() {
          if (!state.talking || charIdx >= text.length) {
            state.talking = false;
            state.targetMouth = 0;
            return;
          }
          const c = text[charIdx++];
          state.targetMouth = estimateViseme(c);
          setTimeout(nextChar, baseDelay);
        }
        nextChar();
      },
      stopSpeaking: function () {
        state.talking = false;
        state.targetMouth = 0;
      },
    };
  }

  window.Buddy3D = { 
    init,
    attach: function(containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        return init(container);
      }
      return null;
    }
  };
})();
