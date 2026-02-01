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
      alpha: true,
      powerPreference: "high-performance",
    });
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Scene + Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      32,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      50
    );
    camera.position.set(0, 1.05, 4.2);

    // Lighting (soft Pixar-ish)
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xfff0dd, 1.25);
    key.position.set(3.5, 5.5, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd8f0ff, 0.55);
    fill.position.set(-5.0, 2.5, 5.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(-2.0, 3.5, -6.0);
    scene.add(rim);

    // Ground (subtle shadow catcher)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Buddy build ---
    const buddy = new THREE.Group();
    buddy.name = "BuddyRoot";
    scene.add(buddy);

    // Palette from reference vibe
    const furTex = makeNoiseTexture(256, [180, 116, 60], 22);
    const bellyTex = makeNoiseTexture(256, [208, 170, 125], 16);
    const bandanaTex = makeNoiseTexture(256, [150, 48, 44], 16);

    const furMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c07a3a"),
      roughness: 0.85,
      metalness: 0.0,
      map: furTex,
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#d7b088"),
      roughness: 0.9,
      metalness: 0.0,
      map: bellyTex,
    });
    const bandanaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#9a3a35"),
      roughness: 0.75,
      metalness: 0.0,
      map: bandanaTex,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2d1c12"),
      roughness: 0.65,
      metalness: 0.02,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a0f0a"),
      roughness: 0.45,
      metalness: 0.05,
    });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ffffff"),
      roughness: 0.15,
      metalness: 0.0,
    });
    const irisMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6b3c16"),
      roughness: 0.25,
      metalness: 0.0,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0b0706"),
      roughness: 0.3,
      metalness: 0.0,
    });

    // Proportions: big head, short limbs (cute)
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 40), furMat);
    body.scale.set(0.92, 1.0, 0.82);
    body.position.set(0, -0.25, 0);
    body.castShadow = true;
    buddy.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.78, 34, 34), bellyMat);
    belly.scale.set(0.86, 1.0, 0.72);
    belly.position.set(0, -0.35, 0.62);
    belly.castShadow = false;
    buddy.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.92, 44, 44), furMat);
    head.scale.set(1.1, 1.05, 1.08);
    head.position.set(0, 0.88, 0.28);
    head.castShadow = true;
    buddy.add(head);

    // Ears
    function ear(x) {
      const g = new THREE.SphereGeometry(0.30, 28, 28);
      const m = furMat;
      const e = new THREE.Mesh(g, m);
      e.scale.set(1.05, 1.0, 0.72);
      e.position.set(x, 1.32, 0.15);
      e.rotation.z = x > 0 ? -0.18 : 0.18;
      e.castShadow = true;
      return e;
    }
    buddy.add(ear(-0.83));
    buddy.add(ear(0.83));

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.48, 34, 34), bellyMat);
    muzzle.scale.set(1.35, 0.92, 0.95);
    muzzle.position.set(0, 0.72, 1.02);
    muzzle.castShadow = true;
    buddy.add(muzzle);

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), noseMat);
    nose.scale.set(1.15, 0.9, 1.0);
    nose.position.set(0, 0.80, 1.36);
    nose.castShadow = true;
    buddy.add(nose);

    // Jaw (hinged) + mouth interior
    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 0.60, 1.05); // hinge point
    buddy.add(jawPivot);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), bellyMat);
    jaw.scale.set(1.35, 0.70, 0.85);
    jaw.position.set(0, 0.02, 0.28);
    jaw.castShadow = true;
    jawPivot.add(jaw);

    const mouthInner = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), darkMat);
    mouthInner.scale.set(1.45, 0.65, 0.85);
    mouthInner.position.set(0, -0.02, 0.30);
    jawPivot.add(mouthInner);

    // Smile corners (small mesh that scales with smile)
    const smileL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), darkMat);
    const smileR = smileL.clone();
    smileL.position.set(-0.28, 0.66, 1.30);
    smileR.position.set(0.28, 0.66, 1.30);
    buddy.add(smileL, smileR);

    // Eyes
    function eye(x) {
      const group = new THREE.Group();
      group.position.set(x, 0.98, 1.02);
      group.rotation.y = x > 0 ? -0.06 : 0.06;

      const white = new THREE.Mesh(new THREE.SphereGeometry(0.22, 26, 26), eyeWhiteMat);
      white.scale.set(1.18, 1.0, 0.92);
      white.castShadow = true;
      group.add(white);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 22), irisMat);
      iris.position.set(0, -0.02, 0.16);
      group.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 18), pupilMat);
      pupil.position.set(0, -0.03, 0.22);
      group.add(pupil);

      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), eyeWhiteMat);
      sparkle.position.set(-0.05, 0.05, 0.24);
      group.add(sparkle);

      // Eyelid (blink)
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 18), furMat);
      lid.scale.set(1.18, 0.12, 0.92);
      lid.position.set(0, 0.10, 0.03);
      group.add(lid);

      group.userData = { iris, pupil, lid };
      return group;
    }
    const eyeL = eye(-0.36);
    const eyeR = eye(0.36);
    buddy.add(eyeL, eyeR);

    // Brows (thicker)
    function brow(x) {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, 6, 16), darkMat);
      b.position.set(x, 1.22, 1.03);
      b.rotation.z = x > 0 ? -0.22 : 0.22;
      b.rotation.y = x > 0 ? -0.08 : 0.08;
      b.castShadow = true;
      return b;
    }
    const browL = brow(-0.44);
    const browR = brow(0.44);
    buddy.add(browL, browR);

    // Arms + paws
    function arm(x) {
      const g = new THREE.Group();
      g.position.set(x, 0.10, 0.22);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.45, 6, 16), furMat);
      upper.rotation.z = x > 0 ? -0.55 : 0.55;
      upper.position.set(0, 0.15, 0);
      upper.castShadow = true;
      g.add(upper);

      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), furMat);
      paw.scale.set(1.05, 0.85, 0.75);
      paw.position.set(x > 0 ? 0.32 : -0.32, -0.22, 0.22);
      paw.castShadow = true;
      g.add(paw);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 18), darkMat);
      pad.scale.set(1.0, 0.45, 0.9);
      pad.position.set(paw.position.x * 0.95, paw.position.y - 0.03, paw.position.z + 0.10);
      g.add(pad);

      g.userData = { upper, paw };
      return g;
    }
    const armL = arm(-0.92);
    const armR = arm(0.92);
    buddy.add(armL, armR);

    // Legs + feet
    function leg(x) {
      const g = new THREE.Group();
      g.position.set(x, -0.95, 0.1);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 16), furMat);
      upper.position.set(0, 0.2, 0);
      upper.castShadow = true;
      g.add(upper);

      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.30, 26, 26), furMat);
      foot.scale.set(1.15, 0.62, 1.0);
      foot.position.set(0, -0.20, 0.22);
      foot.castShadow = true;
      g.add(foot);

      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 18), darkMat);
      pad.scale.set(1.1, 0.4, 1.0);
      pad.position.set(0, -0.23, 0.35);
      g.add(pad);

      return g;
    }
    buddy.add(leg(-0.42), leg(0.42));

    // Bandana (triangle + knot)
    const bandana = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.85, 3, 1), bandanaMat);
    bandana.rotation.set(Math.PI, 0, 0); // point down
    bandana.position.set(0, 0.18, 1.06);
    bandana.castShadow = true;
    buddy.add(bandana);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 18), bandanaMat);
    knot.position.set(0, 0.32, 0.98);
    knot.castShadow = true;
    buddy.add(knot);

    // Pose
    buddy.position.set(0, -0.05, 0);
    buddy.rotation.y = 0;

    // Soft background tint via scene fog
    scene.fog = new THREE.Fog(new THREE.Color("#0b1020"), 9.5, 18);

    // Resize handling
    function resize() {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener("orientationchange", () => setTimeout(resize, 250), { passive: true });

    pickNextBlink(performance.now());
    state.ready = true;

    // Expose internals we need for animation
    return {
      renderer, scene, camera, buddy,
      parts: { head, body, jawPivot, smileL, smileR, eyeL, eyeR, browL, browR, armR, armL },
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
    const jawOpen = clamp(state.mouth, 0, 1) * 0.55;
    runtime.parts.jawPivot.rotation.x = -jawOpen;
    runtime.parts.smileL.scale.setScalar(0.9 + state.smile * 0.8);
    runtime.parts.smileR.scale.setScalar(0.9 + state.smile * 0.8);

    // Brows (emotion)
    state.brow = lerp(state.brow, state.targetBrow, 1.0 - Math.pow(0.001, dt));
    runtime.parts.browL.rotation.z = 0.22 + state.brow * 0.25;
    runtime.parts.browR.rotation.z = -0.22 - state.brow * 0.25;

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
        break;
      default:
        state.targetSmile = 0.45;
        state.targetBrow = 0;
    }
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
    setEmotion
  };
})();
