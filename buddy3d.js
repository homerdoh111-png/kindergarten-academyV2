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

    // Scene - Bright sky blue with soft pastel fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // bright sky blue
    scene.fog = new THREE.FogExp2(0xB8E6F5, 0.018); // soft pastel blue fog

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, initRect.width) / Math.max(1, initRect.height),
      0.1,
      50
    );
    camera.position.set(0, 1.2, 5.2);
    camera.lookAt(0, 0.8, 0);

    // ── BRIGHT PASTEL LIGHTING ──
    // Ambient: soft blue-white
    scene.add(new THREE.AmbientLight(0xE6F3FF, 0.7));

    // Key light: bright sunny yellow from top-right
    const key = new THREE.DirectionalLight(0xFFF8DC, 1.4);
    key.position.set(4.0, 6.0, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Fill: soft lavender from left
    const fill = new THREE.DirectionalLight(0xE6E6FA, 0.55);
    fill.position.set(-5.0, 3.0, 4.0);
    scene.add(fill);

    // Rim: mint green edge light
    const rim = new THREE.DirectionalLight(0xB0FFD9, 0.6);
    rim.position.set(-2.0, 3.0, -5.0);
    scene.add(rim);

    // Sky light from above: soft blue
    const sky = new THREE.DirectionalLight(0xADD8E6, 0.4);
    sky.position.set(0, 8.0, 0);
    scene.add(sky);

    // ── FOREST ENVIRONMENT ──
    const environment = new THREE.Group();
    scene.add(environment);

    // Ground - Lush green grass
    const groundGeo = new THREE.PlaneGeometry(30, 30);
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

    // Shadow catcher (extra soft shadows on ground)
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.15 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -1.48;
    shadowCatcher.receiveShadow = true;
    environment.add(shadowCatcher);

    // ── TREEHOUSE STRUCTURE ──
    const treehouse = new THREE.Group();
    environment.add(treehouse);

    // Main platform - wooden deck
    const platformGeo = new THREE.BoxGeometry(3.5, 0.15, 2.8);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xCD853F,
      roughness: 0.85,
      metalness: 0.0,
      map: makeNoiseTexture(128, [205, 133, 63], 20),
    });
    const platform = new THREE.Mesh(platformGeo, woodMat);
    platform.position.set(0, 0.3, -2.5);
    platform.castShadow = true;
    platform.receiveShadow = true;
    treehouse.add(platform);

    // Treehouse walls - cute little house
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xF5DEB3,
      roughness: 0.7,
      map: makeNoiseTexture(128, [245, 222, 179], 14),
    });
    
    // Back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.12), wallMat);
    backWall.position.set(0, 1.2, -3.8);
    backWall.castShadow = true;
    treehouse.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 2.6), wallMat);
    leftWall.position.set(-1.6, 1.2, -2.6);
    leftWall.castShadow = true;
    treehouse.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 2.6), wallMat);
    rightWall.position.set(1.6, 1.2, -2.6);
    rightWall.castShadow = true;
    treehouse.add(rightWall);

    // Roof - triangular (two planes forming peak)
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xB22222,
      roughness: 0.6,
    });
    const roofLeft = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), roofMat);
    roofLeft.position.set(-0.85, 2.5, -2.8);
    roofLeft.rotation.set(0, 0, -0.6);
    roofLeft.castShadow = true;
    treehouse.add(roofLeft);

    const roofRight = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), roofMat);
    roofRight.position.set(0.85, 2.5, -2.8);
    roofRight.rotation.set(0, 0, 0.6);
    roofRight.castShadow = true;
    treehouse.add(roofRight);

    // Window - cute round window
    const windowGeo = new THREE.CircleGeometry(0.3, 24);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x87CEEB,
      roughness: 0.1,
      metalness: 0.3,
      emissive: 0x4A90C0,
      emissiveIntensity: 0.2,
    });
    const window1 = new THREE.Mesh(windowGeo, windowMat);
    window1.position.set(-0.6, 1.4, -3.75);
    treehouse.add(window1);

    const window2 = window1.clone();
    window2.position.set(0.6, 1.4, -3.75);
    treehouse.add(window2);

    // Support beams - tree trunk supports
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.9,
      map: makeNoiseTexture(128, [139, 69, 19], 18),
    });
    
    function createSupport(x, z) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.2, 12), trunkMat);
      support.position.set(x, -0.4, z);
      support.castShadow = true;
      return support;
    }

    treehouse.add(createSupport(-1.5, -3.5));
    treehouse.add(createSupport(1.5, -3.5));
    treehouse.add(createSupport(-1.5, -1.5));
    treehouse.add(createSupport(1.5, -1.5));

    // ── TREES IN BACKGROUND ──
    function createTree(x, z, height) {
      const tree = new THREE.Group();
      
      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, height, 10),
        trunkMat
      );
      trunk.position.y = height / 2 - 1.5;
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage - sphere cluster
      const foliageMat = new THREE.MeshStandardMaterial({
        color: 0x52B788,
        roughness: 0.9,
      });
      
      for (let i = 0; i < 5; i++) {
        const foliage = new THREE.Mesh(
          new THREE.SphereGeometry(0.6 + Math.random() * 0.3, 12, 12),
          foliageMat
        );
        foliage.position.set(
          (Math.random() - 0.5) * 0.6,
          height - 1.5 + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.6
        );
        foliage.castShadow = true;
        tree.add(foliage);
      }

      tree.position.set(x, 0, z);
      return tree;
    }

    // Add multiple trees in background
    environment.add(createTree(-4, -5, 3.5));
    environment.add(createTree(-6, -4, 4.0));
    environment.add(createTree(4, -5, 3.2));
    environment.add(createTree(6, -4, 3.8));
    environment.add(createTree(0, -6, 4.5));
    environment.add(createTree(-3, -7, 3.0));
    environment.add(createTree(3, -7, 3.3));

    // ── FLOWERS & BUSHES ──
    const flowerColors = [0xFF69B4, 0xFFB6C1, 0xDDA0DD, 0x98FB98, 0xFFDAB9];
    
    function createFlower(x, z, color) {
      const flower = new THREE.Group();
      
      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
        new THREE.MeshStandardMaterial({ color: 0x228B22 })
      );
      stem.position.y = -1.35;
      flower.add(stem);

      // Petals
      const petalMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.6,
        emissive: color,
        emissiveIntensity: 0.15,
      });

      for (let i = 0; i < 6; i++) {
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 12, 12),
          petalMat
        );
        const angle = (i / 6) * Math.PI * 2;
        petal.position.set(
          Math.cos(angle) * 0.1,
          -1.05,
          Math.sin(angle) * 0.1
        );
        petal.scale.set(0.8, 0.5, 1.2);
        flower.add(petal);
      }

      // Center
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xFFD700 })
      );
      center.position.y = -1.05;
      flower.add(center);

      flower.position.set(x, 0, z);
      return flower;
    }

    // Scatter flowers around
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 4;
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      environment.add(createFlower(x, z, color));
    }

    // ── FLOATING BUTTERFLIES ──
    const butterflies = [];
    const butterflyColors = [0xFFB6C1, 0x98FB98, 0xDDA0DD, 0xFFDAB9];
    
    for (let i = 0; i < 8; i++) {
      const butterfly = new THREE.Group();
      
      const wingMat = new THREE.MeshStandardMaterial({
        color: butterflyColors[Math.floor(Math.random() * butterflyColors.length)],
        roughness: 0.4,
        emissive: 0xFFFFFF,
        emissiveIntensity: 0.1,
        side: THREE.DoubleSide,
      });

      const leftWing = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 16),
        wingMat
      );
      leftWing.position.set(-0.08, 0, 0);
      leftWing.rotation.y = -0.3;
      butterfly.add(leftWing);

      const rightWing = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 16),
        wingMat
      );
      rightWing.position.set(0.08, 0, 0);
      rightWing.rotation.y = 0.3;
      butterfly.add(rightWing);

      butterfly.position.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 2 + 0.5,
        (Math.random() - 0.5) * 5 - 1
      );
      
      butterfly.userData = {
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5,
        leftWing: leftWing,
        rightWing: rightWing,
      };
      
      butterflies.push(butterfly);
      environment.add(butterfly);
    }

    // ── SOFT CLOUDS (billboards) ──
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.6,
    });

    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(2 + Math.random(), 0.8 + Math.random() * 0.4),
        cloudMat
      );
      cloud.position.set(
        (Math.random() - 0.5) * 15,
        3 + Math.random() * 2,
        -8 - Math.random() * 3
      );
      environment.add(cloud);
    }

    // ══════════════════════════════════════════════════════════════
    // ── NEW BUDDY CHARACTER - MODERN CUTE DESIGN ──
    // ══════════════════════════════════════════════════════════════

    const buddy = new THREE.Group();
    buddy.position.set(0, -0.2, 0);
    scene.add(buddy);

    // ── MATERIALS - Bright Blue/Pastel Theme ──
    // Primary fur: Bright sky blue
    const furMat = new THREE.MeshStandardMaterial({
      color: 0x6BB6FF,
      roughness: 0.75,
      metalness: 0.0,
      map: makeNoiseTexture(128, [107, 182, 255], 16),
    });

    // Belly/muzzle: Soft white-cream
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xFFF8F0,
      roughness: 0.8,
      map: makeNoiseTexture(128, [255, 248, 240], 12),
    });

    // Nose: Soft pink
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xFFB6D9,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Eyes
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.2,
    });

    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x4A90E2,
      roughness: 0.1,
      metalness: 0.2,
    });

    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A2E,
      roughness: 0.1,
    });

    // Brows & mouth dark
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2C2C3E,
      roughness: 0.6,
    });

    const browMat = darkMat;

    // Ear inner: soft pink
    const earInnerMat = new THREE.MeshStandardMaterial({
      color: 0xFFCCE5,
      roughness: 0.75,
    });

    // Bandana: Bright mint green
    const bandanaMat = new THREE.MeshStandardMaterial({
      color: 0x7FFFD4,
      roughness: 0.5,
      metalness: 0.1,
    });

    // ── BODY - Rounded, slightly chubby ──
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 32), furMat);
    body.scale.set(1.1, 1.0, 0.95);
    body.position.set(0, 0, 0);
    body.castShadow = true;
    buddy.add(body);

    // Belly patch
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 28), bellyMat);
    belly.scale.set(1.0, 1.1, 0.7);
    belly.position.set(0, -0.1, 0.55);
    belly.castShadow = false;
    buddy.add(belly);

    // ── HEAD - Proportioned nicely ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 36, 36), furMat);
    head.scale.set(1.05, 1.0, 1.0);
    head.position.set(0, 1.1, 0.15);
    head.castShadow = true;
    buddy.add(head);

    // ── EARS - Round, perky ──
    function ear(x) {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), furMat);
      outer.scale.set(0.9, 1.0, 0.85);
      outer.castShadow = true;
      g.add(outer);
      
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20), earInnerMat);
      inner.scale.set(0.85, 0.9, 0.7);
      inner.position.set(0, -0.02, 0.05);
      g.add(inner);
      
      g.position.set(x, 1.55, 0.05);
      g.rotation.z = x > 0 ? -0.15 : 0.15;
      return g;
    }
    const earL = ear(-0.58);
    const earR = ear(0.58);
    buddy.add(earL, earR);

    // ── MUZZLE ──
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.35, 28, 28), bellyMat);
    muzzle.scale.set(1.2, 0.8, 0.85);
    muzzle.position.set(0, 0.95, 0.72);
    muzzle.castShadow = false;
    buddy.add(muzzle);

    // ── NOSE - Cute button nose ──
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), noseMat);
    nose.scale.set(1.2, 0.8, 0.9);
    nose.position.set(0, 1.0, 1.0);
    nose.castShadow = true;
    buddy.add(nose);

    // ── MOUTH - Jaw pivot for speech ──
    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 0.88, 0.78);
    buddy.add(jawPivot);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), bellyMat);
    jaw.scale.set(1.15, 0.5, 0.75);
    jaw.position.set(0, 0.0, 0.2);
    jaw.castShadow = true;
    jawPivot.add(jaw);

    const mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), darkMat);
    mouthInner.scale.set(1.2, 0.55, 0.8);
    mouthInner.position.set(0, -0.01, 0.22);
    jawPivot.add(mouthInner);

    // Smile corners
    const smileL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), darkMat);
    const smileR = smileL.clone();
    smileL.position.set(-0.18, 0.91, 0.95);
    smileR.position.set(0.18, 0.91, 0.95);
    buddy.add(smileL, smileR);

    // ── EYES - Big, friendly, modern style ──
    function eye(x) {
      const group = new THREE.Group();
      group.position.set(x, 1.18, 0.68);
      group.rotation.y = x > 0 ? -0.08 : 0.08;

      // White
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), eyeWhiteMat);
      white.scale.set(1.0, 1.08, 0.9);
      white.castShadow = true;
      group.add(white);

      // Iris - bright blue
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 20), irisMat);
      iris.position.set(0, -0.015, 0.18);
      group.add(iris);

      // Pupil
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pupilMat);
      pupil.position.set(0, -0.02, 0.22);
      group.add(pupil);

      // Sparkle highlight
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 14), eyeWhiteMat);
      sparkle.position.set(-0.06, 0.06, 0.23);
      group.add(sparkle);

      // Small sparkle
      const sparkle2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), eyeWhiteMat);
      sparkle2.position.set(0.05, -0.04, 0.23);
      group.add(sparkle2);

      // Eyelid
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 18), furMat);
      lid.scale.set(1.0, 0.06, 0.9);
      lid.position.set(0, 0.11, 0.02);
      group.add(lid);

      group.userData = { iris, pupil, lid };
      return group;
    }
    const eyeL = eye(-0.32);
    const eyeR = eye(0.32);
    buddy.add(eyeL, eyeR);

    // ── BROWS - Expressive ──
    function brow(x) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 4, 12), browMat);
      b.position.set(x, 1.38, 0.7);
      b.rotation.z = x > 0 ? -0.25 : 0.25;
      b.rotation.y = x > 0 ? -0.12 : 0.12;
      b.castShadow = true;
      return b;
    }
    const browL = brow(-0.35);
    const browR = brow(0.35);
    buddy.add(browL, browR);

    // ── ARMS - Cute rounded arms ──
    function arm(x, isRight) {
      const g = new THREE.Group();
      g.position.set(x, 0.25, 0.22);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.25, 4, 14), furMat);
      upper.rotation.z = isRight ? -0.4 : 0.4;
      upper.position.set(0, 0.08, 0);
      upper.castShadow = true;
      g.add(upper);

      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), furMat);
      paw.scale.set(1.0, 0.85, 0.8);
      paw.position.set(isRight ? 0.2 : -0.2, -0.15, 0.15);
      paw.castShadow = true;
      g.add(paw);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), darkMat);
      pad.scale.set(1.0, 0.4, 0.85);
      pad.position.set(paw.position.x * 0.9, paw.position.y - 0.02, paw.position.z + 0.1);
      g.add(pad);

      // Toe beans
      const toeOffsets = [[-0.05, 0.0, 0.08], [0.0, 0.0, 0.1], [0.05, 0.0, 0.08]];
      toeOffsets.forEach(function(tp) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), darkMat);
        toe.position.set(paw.position.x + tp[0], paw.position.y + tp[1] - 0.12, paw.position.z + tp[2]);
        g.add(toe);
      });

      g.userData = { upper, paw };
      return g;
    }
    const armL = arm(-0.75, false);
    const armR = arm(0.75, true);
    buddy.add(armL, armR);

    // ── LEGS - Stubby cute legs ──
    function leg(x) {
      const g = new THREE.Group();
      g.position.set(x, -0.65, 0.1);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.25, 4, 14), furMat);
      upper.position.set(0, 0.1, 0);
      upper.castShadow = true;
      g.add(upper);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 22), furMat);
      foot.scale.set(1.05, 0.5, 1.0);
      foot.position.set(0, -0.13, 0.18);
      foot.castShadow = true;
      g.add(foot);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), darkMat);
      pad.scale.set(1.0, 0.35, 0.9);
      pad.position.set(0, -0.16, 0.28);
      g.add(pad);

      // Toe beans
      const toeOffsets = [[-0.08, -0.14, 0.35], [0.0, -0.14, 0.38], [0.08, -0.14, 0.35]];
      toeOffsets.forEach(function(tp) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), darkMat);
        toe.position.set(tp[0], tp[1], tp[2]);
        g.add(toe);
      });

      g.userData = { upper, foot };
      return g;
    }
    const legL = leg(-0.4);
    const legR = leg(0.4);
    buddy.add(legL, legR);

    // ── BANDANA - Optional cute accessory ──
    const bandana = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.62, 0.18, 24, 1, true),
      bandanaMat
    );
    bandana.position.set(0, 0.88, 0.15);
    bandana.rotation.x = 0.1;
    buddy.add(bandana);

    // Bandana knot
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), bandanaMat);
    knot.position.set(0.45, 0.88, -0.15);
    buddy.add(knot);

    // ══════════════════════════════════════════════════════════════
    // Animation & State Management
    // ══════════════════════════════════════════════════════════════

    const refs = {
      body, head, earL, earR, eyeL, eyeR, browL, browR,
      armL, armR, legL, legR, jawPivot, nose, smileL, smileR,
    };

    state.ready = true;
    pickNextBlink(performance.now());

    function animate() {
      const now = performance.now();
      const dt = Math.min((now - state.last) / 1000, 0.1);
      state.last = now;
      const t = (now - state.t0) / 1000;

      // Butterfly wing flapping
      butterflies.forEach(b => {
        const phase = b.userData.phase + t * b.userData.speed;
        const flap = Math.sin(phase * 8) * 0.4;
        b.userData.leftWing.rotation.y = -0.3 + flap;
        b.userData.rightWing.rotation.y = 0.3 - flap;
        
        // Gentle floating
        b.position.y += Math.sin(phase) * 0.0005;
        b.position.x += Math.cos(phase * 0.5) * 0.001;
      });

      // Idle breathing
      const breathe = Math.sin(t * 1.8) * 0.02;
      body.scale.y = 1.0 + breathe;
      body.position.y = breathe * 0.5;

      // Blink
      if (now >= state.nextBlinkAt) {
        state.blink = 1.0;
        pickNextBlink(now);
      }
      if (state.blink > 0) {
        state.blink = Math.max(0, state.blink - dt * 6);
        const blinkS = 1.0 - state.blink * 0.94;
        eyeL.userData.lid.scale.y = blinkS * 0.06;
        eyeR.userData.lid.scale.y = blinkS * 0.06;
        eyeL.userData.lid.position.y = 0.11 - state.blink * 0.22;
        eyeR.userData.lid.position.y = 0.11 - state.blink * 0.22;
      }

      // Mouth (from voice or text)
      if (state.mouthDirect >= 0) {
        state.targetMouth = state.mouthDirect;
      }
      state.mouth = lerp(state.mouth, state.targetMouth, 0.25);
      const mouthRot = state.mouth * 0.32;
      jawPivot.rotation.x = mouthRot;

      // Smile
      state.smile = lerp(state.smile, state.targetSmile, 0.08);
      const smileY = 0.91 - state.smile * 0.03;
      const smileX = 0.18 + state.smile * 0.02;
      smileL.position.set(-smileX, smileY, 0.95);
      smileR.position.set(smileX, smileY, 0.95);

      // Brow
      state.brow = lerp(state.brow, state.targetBrow, 0.12);
      browL.position.y = 1.38 + state.brow * 0.08;
      browR.position.y = 1.38 + state.brow * 0.08;

      // Wave
      if (state.wave > 0) {
        state.wave = Math.max(0, state.wave - dt * 1.2);
        state.waveVel += (Math.sin(t * 10) * 0.5 - armR.rotation.z) * 0.4;
        state.waveVel *= 0.85;
        armR.rotation.z += state.waveVel;
      } else {
        armR.rotation.z = lerp(armR.rotation.z, -0.4, 0.1);
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
      butterflies,
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
