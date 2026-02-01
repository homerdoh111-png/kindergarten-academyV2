/* Buddy3D - Option B (Three.js) mascot runtime
   Goal: "3D Pixar-realistic" vibe (soft lighting, warm materials) + talking-pet expressiveness
   No external model required (procedural), but structure supports future glTF swap-in.
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
    // New animation states
    listening: 0,       // 0→1 ear-perk + wide-eye
    thinking: 0,        // 0→1 head-tilt + sideeye
    giggle: 0,          // 0→1 body bounce envelope
    gigglePhase: 0,     // time phase for bounce oscillation
    mouthDirect: -1,    // ≥0 means voice.js is driving jaw directly
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
    // Simple text->mouth shape mapping (not phoneme-accurate, but feels alive)
    const c = (char || "").toLowerCase();
    if ("aei".includes(c)) return 0.55;      // wider
    if ("ou".includes(c)) return 0.70;       // rounder / more open
    if ("bmp".includes(c)) return 0.10;      // closed-ish
    if ("fv".includes(c)) return 0.30;
    if ("tcdgknsxzj".includes(c)) return 0.35;
    if (c === " ") return 0.05;
    return 0.40;
  }

  function pickNextBlink(now) {
    // 2.5–6.5s
    state.nextBlinkAt = now + (2500 + Math.random() * 4000);
  }

  function init(container) {
    if (!ensureThree()) {
      console.warn("Buddy3D: THREE not found. Make sure three.min.js is loaded before buddy3d.js");
      return null;
    }
    if (!container) return null;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    renderer.setPixelRatio(dpr);
    // Size using the rendered box (handles CSS transforms / animations better
    // than clientWidth/clientHeight in some layouts).
    const initRect = container.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.round(initRect.width)), Math.max(1, Math.round(initRect.height)), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Slightly brighter/softer for a friendly mascot look.
    renderer.toneMappingExposure = 1.24;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Scene + Camera
    const scene = new THREE.Scene();
    // Warm cinematic atmosphere — deep saturated gradient feel
    scene.background = new THREE.Color(0x1a0a00); // deep warm black (fog base)
    scene.fog = new THREE.FogExp2(0x3d1f08, 0.028); // warm volumetric fog

    const camera = new THREE.PerspectiveCamera(
      38,
      Math.max(1, initRect.width) / Math.max(1, initRect.height),
      0.1,
      50
    );
    camera.position.set(0, 0.95, 4.6);
    camera.lookAt(0, 0.72, 0.25);

    // ── CINEMATIC LIGHTING RIG ──
    // Ambient: warm, rich — not flat white
    scene.add(new THREE.AmbientLight(0xffe8cc, 0.55));

    // Key light: warm golden from upper-right (hero light)
    const key = new THREE.DirectionalLight(0xffddaa, 1.15);
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

    // Fill: cool-warm from left (creates depth + color contrast)
    const fill = new THREE.DirectionalLight(0xddccff, 0.42);
    fill.position.set(-5.0, 2.5, 5.5);
    scene.add(fill);

    // Rim: vibrant orange-gold edge glow
    const rim = new THREE.DirectionalLight(0xff9933, 0.68);
    rim.position.set(-2.0, 3.5, -6.0);
    scene.add(rim);

    // Under-fill: simulates warm ground bounce (critical for Pixar look)
    const underFill = new THREE.DirectionalLight(0xff6633, 0.28);
    underFill.position.set(0, -3, 2);
    scene.add(underFill);

    // ── ENVIRONMENT GROUND ──
    // Rich textured ground plane
    const groundTex = makeNoiseTexture(256, [62, 38, 18], 14);
    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x5c3a1e),
      map: groundTex,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.12;
    ground.receiveShadow = true;
    scene.add(ground);

    // Shadow catcher (extra soft shadow layer)
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -1.11;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // ── BACKGROUND ENVIRONMENT OBJECTS ──
    // Far-back warm glowing orbs (bokeh-like depth)
    const bokePositions = [
      { x: -3.5, y: 1.2, z: -4.0, color: 0xff6633, size: 0.35, intensity: 0.30 },
      { x:  3.8, y: 0.8, z: -3.5, color: 0xff9944, size: 0.28, intensity: 0.25 },
      { x: -1.8, y: 2.2, z: -5.0, color: 0xffaa55, size: 0.22, intensity: 0.20 },
      { x:  2.2, y: 1.8, z: -4.8, color: 0xff7744, size: 0.18, intensity: 0.18 },
      { x:  0.0, y: 0.5, z: -5.5, color: 0xffcc66, size: 0.25, intensity: 0.22 },
    ];
    bokePositions.forEach(function(b) {
      const bokeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(b.color),
        transparent: true,
        opacity: 0.55,
      });
      const boke = new THREE.Mesh(new THREE.SphereGeometry(b.size, 16, 16), bokeMat);
      boke.position.set(b.x, b.y, b.z);
      scene.add(boke);
      // Each boke also adds a point light for color bleed
      const bokeLight = new THREE.PointLight(b.color, b.intensity, 4.5);
      bokeLight.position.copy(boke.position);
      scene.add(bokeLight);
    });

    // Small ground flowers (simple 3-petal discs)
    const flowerPositions = [
      { x: -1.8, z: -0.6, color: 0xff5577, size: 0.12 },
      { x:  1.6, z: -0.4, color: 0xff9933, size: 0.10 },
      { x: -0.9, z: -1.0, color: 0xffdd44, size: 0.09 },
      { x:  2.2, z: -0.9, color: 0xff6644, size: 0.11 },
      { x: -2.4, z: -0.2, color: 0xcc44ff, size: 0.08 },
      { x:  0.6, z: -1.2, color: 0xff4488, size: 0.10 },
    ];
    flowerPositions.forEach(function(f) {
      const fMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(f.color),
        roughness: 0.6,
        metalness: 0.0,
        emissive: new THREE.Color(f.color).multiplyScalar(0.25),
      });
      // Stem
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.85 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.28, 6), stemMat);
      stem.position.set(f.x, -1.12 + 0.14, f.z);
      scene.add(stem);
      // Petals (3 flat discs rotated around)
      for (var p = 0; p < 3; p++) {
        const petal = new THREE.Mesh(new THREE.CircleGeometry(f.size, 8), fMat);
        petal.rotation.x = -Math.PI * 0.35;
        petal.rotation.z = (p / 3) * Math.PI * 2;
        petal.position.set(
          f.x + Math.cos((p / 3) * Math.PI * 2) * f.size * 0.7,
          -1.12 + 0.29,
          f.z + Math.sin((p / 3) * Math.PI * 2) * f.size * 0.7
        );
        scene.add(petal);
      }
      // Center dot
      const center = new THREE.Mesh(
        new THREE.SphereGeometry(f.size * 0.35, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffee44, emissive: 0x886622 })
      );
      center.position.set(f.x, -1.12 + 0.30, f.z);
      scene.add(center);
    });

    // ── FLOATING PARTICLES (firefly motes) ──
    const particleCount = 40;
    const particles = [];
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffddaa,
      transparent: true,
      opacity: 0.85,
    });
    for (var pi = 0; pi < particleCount; pi++) {
      const size = 0.015 + Math.random() * 0.025;
      const p = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), particleMat.clone());
      // Spread across the scene volume
      p.position.set(
        (Math.random() - 0.5) * 7.0,
        -0.5 + Math.random() * 3.2,
        -4.5 + Math.random() * 4.0
      );
      // Store animation params
      p.userData = {
        baseY: p.position.y,
        baseX: p.position.x,
        baseZ: p.position.z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        drift: 0.15 + Math.random() * 0.25,
        color: [0xffddaa, 0xff9933, 0xffcc66, 0xff7744, 0xffaa55][Math.floor(Math.random() * 5)],
      };
      p.material.color.setHex(p.userData.color);
      scene.add(p);
      particles.push(p);
    }

    // --- Buddy build ---
    // --- Buddy build ---
    const buddy = new THREE.Group();
    buddy.name = "BuddyRoot";
    scene.add(buddy);

    // ── Textures ──
    const furTex     = makeNoiseTexture(256, [200, 138, 72], 28);
    const bellyTex   = makeNoiseTexture(256, [228, 204, 165], 16);
    const bandanaTex = makeNoiseTexture(256, [230, 78, 78], 14);

    // ── Materials — Pixar CGI with subsurface glow ──
    const furMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d48a42"),       // richer, more saturated golden amber
      roughness: 0.75,
      metalness: 0.0,
      map: furTex,
      emissive: new THREE.Color("#3d1a08"),    // subsurface warmth glow
      emissiveIntensity: 0.18,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e8d4a8"),       // warm creamy gold
      roughness: 0.82,
      metalness: 0.0,
      map: bellyTex,
      emissive: new THREE.Color("#2a1505"),
      emissiveIntensity: 0.12,
    });
    const bandanaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e83c3c"),       // vivid coral-red
      roughness: 0.62,
      metalness: 0.02,
      map: bandanaTex,
      emissive: new THREE.Color("#5a0808"),    // rich red subsurface
      emissiveIntensity: 0.22,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2e1e12"),
      roughness: 0.78,
      metalness: 0.02,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e1008"),
      roughness: 0.42,
      metalness: 0.06,
      emissive: new THREE.Color("#0a0402"),
      emissiveIntensity: 0.15,
    });
    const browMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3d2518"),
      roughness: 0.82,
      metalness: 0.0,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#fffaee"),       // pure warm white
      roughness: 0.02,                         // very glossy (wet eye look)
      metalness: 0.0,
      emissive: new THREE.Color("#fff5dd"),
      emissiveIntensity: 0.08,                 // subtle inner glow
    });
    const irisMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d49430"),       // richer amber-gold iris
      roughness: 0.04,                         // very glossy
      metalness: 0.08,
      emissive: new THREE.Color("#8a5a10"),    // deep iris glow
      emissiveIntensity: 0.28,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a0604"),
      roughness: 0.15,
      metalness: 0.0,
    });
    const earInnerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f0b898"),       // vibrant warm peach
      roughness: 0.78,
      metalness: 0.0,
      emissive: new THREE.Color("#4a1808"),    // subsurface pinkish glow
      emissiveIntensity: 0.20,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 40, 40), furMat);
    body.scale.set(1.05, 0.88, 0.90);
    body.position.set(0, -0.30, 0);
    body.castShadow = true;
    buddy.add(body);

    // Belly patch — large, distinctly lighter, sits on front of body
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 34, 34), bellyMat);
    belly.scale.set(0.88, 0.95, 0.68);
    belly.position.set(0, -0.28, 0.58);
    belly.castShadow = false;
    buddy.add(belly);

    // ── HEAD — big round sphere, dominates the body ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 48), furMat);
    head.scale.set(1.05, 1.02, 1.05);
    head.position.set(0, 0.82, 0.22);
    head.castShadow = true;
    buddy.add(head);

    // ── EARS — round spheres sitting on top of head ──
    function ear(x) {
      const g = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.SphereGeometry(0.34, 30, 30), furMat);
      outer.scale.set(0.92, 1.0, 0.80);
      outer.castShadow = true;
      g.add(outer);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.215, 24, 24), earInnerMat);
      inner.scale.set(0.82, 0.88, 0.62);
      inner.position.set(0, -0.02, 0.06);
      g.add(inner);
      g.position.set(x, 1.28, 0.08);
      g.rotation.z = x > 0 ? -0.12 : 0.12;
      return g;
    }
    const earL = ear(-0.78);
    const earR = ear(0.78);
    buddy.add(earL);
    buddy.add(earR);

    // ── MUZZLE — distinct lighter oval patch ──
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 34, 34), bellyMat);
    muzzle.scale.set(1.30, 0.82, 0.88);
    muzzle.position.set(0, 0.66, 0.98);
    muzzle.castShadow = false;
    buddy.add(muzzle);

    // ── NOSE — wide soft oval, flattened ──
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), noseMat);
    nose.scale.set(1.40, 0.72, 0.90);
    nose.position.set(0, 0.73, 1.28);
    nose.castShadow = true;
    buddy.add(nose);

    // ── MOUTH — jawPivot for speech, resting smile at corners ──
    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 0.58, 1.02);
    buddy.add(jawPivot);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.36, 30, 30), bellyMat);
    jaw.scale.set(1.20, 0.55, 0.78);
    jaw.position.set(0, 0.0, 0.24);
    jaw.castShadow = true;
    jawPivot.add(jaw);

    const mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 22), darkMat);
    mouthInner.scale.set(1.30, 0.58, 0.80);
    mouthInner.position.set(0, -0.01, 0.26);
    jawPivot.add(mouthInner);

    // Smile corners — small dark dots for the resting curved smile
    const smileL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), darkMat);
    const smileR = smileL.clone();
    smileL.position.set(-0.22, 0.62, 1.22);
    smileR.position.set( 0.22, 0.62, 1.22);
    buddy.add(smileL, smileR);

    // ── EYES — enormous Pixar eyes with big sparkle highlights ──
    function eye(x) {
      const group = new THREE.Group();
      group.position.set(x, 0.90, 0.96);
      group.rotation.y = x > 0 ? -0.05 : 0.05;

      // White — large oval, taller than wide (classic Pixar)
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.30, 28, 28), eyeWhiteMat);
      white.scale.set(1.0, 1.12, 0.88);
      white.castShadow = true;
      group.add(white);

      // Iris — amber-gold, glossy
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 24), irisMat);
      iris.position.set(0, -0.02, 0.20);
      group.add(iris);

      // Pupil — large dark
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 20), pupilMat);
      pupil.position.set(0, -0.025, 0.27);
      group.add(pupil);

      // BIG sparkle highlight — upper-left, Pixar signature
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 16), eyeWhiteMat);
      sparkle.position.set(-0.07, 0.08, 0.28);
      group.add(sparkle);

      // Small secondary sparkle lower-right for depth
      const sparkle2 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), eyeWhiteMat);
      sparkle2.position.set(0.06, -0.05, 0.28);
      group.add(sparkle2);

      // Eyelid (blink)
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.305, 20, 20), furMat);
      lid.scale.set(1.0, 0.07, 0.88);
      lid.position.set(0, 0.12, 0.02);
      group.add(lid);

      group.userData = { iris, pupil, lid };
      return group;
    }
    const eyeL = eye(-0.38);
    const eyeR = eye( 0.38);
    buddy.add(eyeL, eyeR);

    // ── BROWS — thin, gently arched ──
    function brow(x) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.22, 5, 14), browMat);
      b.position.set(x, 1.14, 0.94);
      b.rotation.z = x > 0 ? -0.28 : 0.28;
      b.rotation.y = x > 0 ? -0.10 : 0.10;
      b.castShadow = true;
      return b;
    }
    const browL = brow(-0.42);
    const browR = brow( 0.42);
    buddy.add(browL, browR);

    // ── ARMS — short stubby with big round paws + toe beans ──
    function arm(x, isRight) {
      const g = new THREE.Group();
      g.position.set(x, -0.02, 0.28);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.28, 5, 16), furMat);
      upper.rotation.z = isRight ? -0.45 : 0.45;
      upper.position.set(0, 0.08, 0);
      upper.castShadow = true;
      g.add(upper);

      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), furMat);
      paw.scale.set(1.05, 0.82, 0.78);
      paw.position.set(isRight ? 0.22 : -0.22, -0.18, 0.18);
      paw.castShadow = true;
      g.add(paw);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 18), darkMat);
      pad.scale.set(1.0, 0.42, 0.88);
      pad.position.set(paw.position.x * 0.92, paw.position.y - 0.02, paw.position.z + 0.12);
      g.add(pad);

      // Three toe beans
      const toeOffsets = [[-0.06, 0.0, 0.10], [0.0, 0.0, 0.12], [0.06, 0.0, 0.10]];
      toeOffsets.forEach(function(tp) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), darkMat);
        toe.position.set(paw.position.x + tp[0], paw.position.y + tp[1] - 0.14, paw.position.z + tp[2]);
        g.add(toe);
      });

      g.userData = { upper, paw };
      return g;
    }
    const armL = arm(-0.88, false);
    const armR = arm( 0.88, true);
    buddy.add(armL, armR);

    // ── LEGS — short stubby with big round feet + toe beans ──
    function leg(x) {
      const g = new THREE.Group();
      g.position.set(x, -0.88, 0.12);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.30, 5, 16), furMat);
      upper.position.set(0, 0.12, 0);
      upper.castShadow = true;
      g.add(upper);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 26, 26), furMat);
      foot.scale.set(1.10, 0.55, 1.05);
      foot.position.set(0, -0.16, 0.20);
      foot.castShadow = true;
      g.add(foot);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 18), darkMat);
      pad.scale.set(1.0, 0.38, 0.95);
      pad.position.set(0, -0.19, 0.33);
      g.add(pad);

      // Toe beans on foot
      var toeX = [-0.08, 0.0, 0.08];
      toeX.forEach(function(tx) {
        var toe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), darkMat);
        toe.position.set(tx, -0.21, 0.40);
        g.add(toe);
      });

      return g;
    }
    buddy.add(leg(-0.38), leg(0.38));

    // ── BANDANA — triangular bib on chest ──
    const bandana = new THREE.Mesh(new THREE.ConeGeometry(0.88, 0.78, 3, 1), bandanaMat);
    bandana.rotation.set(Math.PI, 0, 0);
    bandana.position.set(0, 0.08, 0.82);
    bandana.castShadow = true;
    buddy.add(bandana);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 18), bandanaMat);
    knot.position.set(0, 0.24, 0.76);
    knot.castShadow = true;
    buddy.add(knot);

    // Pose
    buddy.position.set(0, -0.05, 0);
    buddy.rotation.y = 0;


    // Resize handling
    function resize() {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0.72, 0.25);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener("orientationchange", () => setTimeout(resize, 250), { passive: true });

    pickNextBlink(performance.now());
    state.ready = true;

    // Expose internals we need for animation
    return {
      renderer, scene, camera, buddy,
      parts: { head, body, jawPivot, smileL, smileR, eyeL, eyeR, browL, browR, armR, armL, earL, earR },
      particles: particles,
      dispose() {
        ro.disconnect();
        renderer.dispose();
        container.innerHTML = "";
      }
    };
  }

  let runtime = null;

  function animate(now) {
    if (!runtime) return;
    const dt = clamp((now - state.last) / 1000, 0, 0.05);
    state.last = now;

    // Idle breathing + subtle sway
    const t = (now - state.t0) / 1000;
    const idle = 0.5 + 0.5 * Math.sin(t * 1.1);
    runtime.parts.body.scale.y = 1.0 + idle * 0.02;
    runtime.buddy.rotation.y = Math.sin(t * 0.55) * 0.12;
    runtime.parts.head.rotation.y = Math.sin(t * 0.65) * 0.08;
    runtime.parts.head.rotation.x = Math.sin(t * 0.9) * 0.03;

    // Blink
    if (now > state.nextBlinkAt) {
      state.blink = 1.0;
      pickNextBlink(now);
    }
    state.blink = lerp(state.blink, 0.0, 1.0 - Math.pow(0.001, dt)); // quick decay
    const lidScale = 0.12 + (1.0 - state.blink) * 0.88;
    runtime.parts.eyeL.userData.lid.scale.y = lidScale * 0.12;
    runtime.parts.eyeR.userData.lid.scale.y = lidScale * 0.12;

    // Mouth + smile smoothing
    state.mouth = lerp(state.mouth, state.targetMouth, 1.0 - Math.pow(0.0008, dt));
    state.smile = lerp(state.smile, state.targetSmile, 1.0 - Math.pow(0.001, dt));

    // mouthDirect override: when voice.js is driving jaw from live amplitude
    let jawOpen;
    if (state.mouthDirect >= 0) {
      jawOpen = clamp(state.mouthDirect, 0, 1) * 0.62;
    } else {
      jawOpen = clamp(state.mouth, 0, 1) * 0.55;
    }
    runtime.parts.jawPivot.rotation.x = -jawOpen;
    runtime.parts.smileL.scale.setScalar(0.9 + state.smile * 0.8);
    runtime.parts.smileR.scale.setScalar(0.9 + state.smile * 0.8);

    // Brows (emotion)
    state.brow = lerp(state.brow, state.targetBrow, 1.0 - Math.pow(0.001, dt));
    runtime.parts.browL.rotation.z = 0.22 + state.brow * 0.25;
    runtime.parts.browR.rotation.z = -0.22 - state.brow * 0.25;

    // ── Listening animation: ears perk forward, eyes widen ──
    state.listening = lerp(state.listening, 0, 1.0 - Math.pow(0.004, dt));
    if (state.listening > 0.01) {
      // Ears rotate forward (toward camera)
      runtime.parts.earL.rotation.x = -0.45 * state.listening;
      runtime.parts.earR.rotation.x = -0.45 * state.listening;
      // Eyes widen: scale lids smaller (more open)
      const lidOpen = 0.12 - 0.06 * state.listening;
      runtime.parts.eyeL.userData.lid.scale.y = lidOpen;
      runtime.parts.eyeR.userData.lid.scale.y = lidOpen;
    } else {
      runtime.parts.earL.rotation.x = 0;
      runtime.parts.earR.rotation.x = 0;
    }

    // ── Thinking animation: head tilts, one brow up, eyes look sideways ──
    state.thinking = lerp(state.thinking, 0, 1.0 - Math.pow(0.003, dt));
    if (state.thinking > 0.01) {
      runtime.parts.head.rotation.z = 0.20 * state.thinking;   // tilt right
      runtime.parts.head.rotation.y = 0.15 * state.thinking;   // turn slightly
      // One brow raises (left brow goes up)
      runtime.parts.browL.rotation.z = 0.22 + 0.30 * state.thinking;
      // Eyes look sideways
      runtime.parts.eyeL.userData.iris.position.x = 0.025 * state.thinking;
      runtime.parts.eyeR.userData.iris.position.x = 0.025 * state.thinking;
      runtime.parts.eyeL.userData.pupil.position.x = 0.03 * state.thinking;
      runtime.parts.eyeR.userData.pupil.position.x = 0.03 * state.thinking;
    } else {
      runtime.parts.head.rotation.z = 0;
    }

    // ── Giggle animation: rapid body bounce ──
    state.giggle = lerp(state.giggle, 0, 1.0 - Math.pow(0.0015, dt));
    if (state.giggle > 0.01) {
      state.gigglePhase += dt * 18; // ~3 bounces per second
      const bounce = Math.abs(Math.sin(state.gigglePhase)) * state.giggle;
      runtime.parts.body.position.y = -0.30 + bounce * 0.12;
      runtime.parts.head.position.y = 0.82 + bounce * 0.10;
      // Arms flap slightly
      runtime.parts.armL.rotation.z = 0.55 + Math.sin(state.gigglePhase * 1.3) * 0.18 * state.giggle;
      runtime.parts.armR.rotation.z = -0.55 - Math.sin(state.gigglePhase * 1.3) * 0.18 * state.giggle;
      // Big smile during giggle
      runtime.parts.smileL.scale.setScalar(0.9 + (state.smile + state.giggle * 0.4) * 0.8);
      runtime.parts.smileR.scale.setScalar(0.9 + (state.smile + state.giggle * 0.4) * 0.8);
    } else {
      runtime.parts.body.position.y = -0.30;
      runtime.parts.head.position.y = 0.82;
    }

    // Wave reaction (right arm)
    if (state.wave > 0) {
      state.waveVel += (-state.wave * 10 - state.waveVel * 3.5) * dt;
      state.wave += state.waveVel * dt;
      state.wave = clamp(state.wave, 0, 1);
      const a = Math.sin(t * 10) * 0.35 * state.wave;
      runtime.parts.armR.rotation.z = -0.2 - a;
      runtime.parts.armR.rotation.x = -0.15 + Math.cos(t * 8) * 0.08 * state.wave;
    } else {
      runtime.parts.armR.rotation.z = 0;
      runtime.parts.armR.rotation.x = 0;
    }

    // Eye tracking (subtle, based on mouse position if available)
    if (runtime._pointer) {
      const px = runtime._pointer.x;
      const py = runtime._pointer.y;
      runtime.parts.eyeL.userData.iris.position.x = px * 0.03;
      runtime.parts.eyeR.userData.iris.position.x = px * 0.03;
      runtime.parts.eyeL.userData.iris.position.y = -py * 0.02 - 0.02;
      runtime.parts.eyeR.userData.iris.position.y = -py * 0.02 - 0.02;

      runtime.parts.eyeL.userData.pupil.position.x = px * 0.04;
      runtime.parts.eyeR.userData.pupil.position.x = px * 0.04;
      runtime.parts.eyeL.userData.pupil.position.y = -py * 0.025 - 0.03;
      runtime.parts.eyeR.userData.pupil.position.y = -py * 0.025 - 0.03;
    }


    // ── Animate floating particles ──
    if (runtime.particles) {
      for (var pi = 0; pi < runtime.particles.length; pi++) {
        var p = runtime.particles[pi];
        var ud = p.userData;
        var phase = ud.phase + t * ud.speed;
        p.position.x = ud.baseX + Math.sin(phase * 0.7) * ud.drift;
        p.position.y = ud.baseY + Math.sin(phase) * 0.22 + Math.cos(phase * 1.3) * 0.10;
        p.position.z = ud.baseZ + Math.cos(phase * 0.5) * ud.drift * 0.6;
        // Pulse opacity
        var pulse = 0.4 + 0.55 * (0.5 + 0.5 * Math.sin(phase * 1.8));
        p.material.opacity = pulse;
      }
    }

    runtime.renderer.render(runtime.scene, runtime.camera);
    requestAnimationFrame(animate);
  }

  function attach(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return false;

    runtime = init(el);
    if (!runtime) return false;

    // Pointer tracking for eye look
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      runtime._pointer = { x: clamp((x - 0.5) * 2, -1, 1), y: clamp((y - 0.5) * 2, -1, 1) };
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", () => (runtime._pointer = null), { passive: true });

    requestAnimationFrame((t) => {
      state.t0 = t;
      state.last = t;
      requestAnimationFrame(animate);
    });

    return true;
  }

  function poke() {
    // quick wave + cheerful brows + smile pop
    state.wave = 1;
    state.waveVel = 0;
    state.targetSmile = 0.7;
    state.targetBrow = -0.25;
    setTimeout(() => { state.wave = 0; state.targetSmile = 0.45; state.targetBrow = 0; }, 700);
  }

  function setEmotion(name) {
    switch ((name || "").toLowerCase()) {
      case "happy":
        state.targetSmile = 0.75;
        state.targetBrow = -0.18;
        break;
      case "excited":
        state.targetSmile = 0.85;
        state.targetBrow = -0.28;
        poke();
        break;
      case "thinking":
        state.targetSmile = 0.25;
        state.targetBrow = 0.20;
        state.thinking = 1.0;   // trigger head-tilt + sideeye
        break;
      case "listening":
        state.targetSmile = 0.40;
        state.targetBrow = 0.05;
        state.listening = 1.0;  // trigger ear-perk + wide eyes
        break;
      default:
        state.targetSmile = 0.45;
        state.targetBrow = 0;
    }
  }

  // Winnie-the-Pooh style body bounce
  function giggle() {
    state.giggle = 1.0;
    state.gigglePhase = 0;
    state.targetSmile = 0.90;
    state.targetBrow = -0.30;
    setTimeout(() => { state.targetSmile = 0.45; state.targetBrow = 0; }, 1200);
  }

  // Realtime mouth drive from audio amplitude (voice.js calls this every frame)
  // Pass -1 to release back to normal TTS/viseme control
  function setMouthDirect(value) {
    state.mouthDirect = value;
  }

  function onBoundary(evt) {
    // SpeechSynthesis boundary event: update mouth based on current character
    try {
      const idx = evt && typeof evt.charIndex === "number" ? evt.charIndex : state.lastBoundaryIdx;
      state.lastBoundaryIdx = idx;
      const ch = (state.text || "").charAt(idx) || " ";
      state.targetMouth = estimateViseme(ch);
    } catch (e) {}
  }

  function say(text) {
    // Fallback talking animation (if speech synthesis is off)
    state.text = String(text || "");
    state.talking = true;
    let i = 0;
    const max = Math.max(1, state.text.length);
    const tick = () => {
      if (!state.talking) return;
      const ch = state.text.charAt(i) || " ";
      state.targetMouth = estimateViseme(ch);
      i = (i + 1) % max;
      setTimeout(tick, 55 + Math.random() * 40);
    };
    tick();
    setTimeout(() => { state.talking = false; state.targetMouth = 0.05; }, 900 + state.text.length * 25);
  }

  function talk(isTalking, text) {
    state.talking = !!isTalking;
    if (typeof text === "string") state.text = text;
    if (!state.talking) {
      state.targetMouth = 0.05;
      state.targetSmile = 0.45;
      state.targetBrow = 0;
    } else {
      state.targetSmile = 0.6;
      state.targetBrow = -0.12;
    }
  }

  window.Buddy3D = {
    attach,
    poke,
    say,
    talk,
    onBoundary,
    setEmotion,
    giggle,
    setMouthDirect,
  };
})();
