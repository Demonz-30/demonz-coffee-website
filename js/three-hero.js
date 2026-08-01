/* ============================================================
   DEMONZ COFFEE — Three.js Hero (Milestone B2)
   - PNG product as auto-fallback surface (no GLB required -> never blank)
   - OrbitControls: drag rotate, wheel/drag zoom (custom), reset camera
   - Auto Rotate toggle
   - Ambient + Directional lights, soft shadow, procedural env reflection
   - ACES tone mapping
   - Lazy-load via IntersectionObserver; full cleanup (no memory leaks)
   - If WebGL / Three fails to load => fallback PNG stays visible
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  const stage = document.getElementById('heroStage');
  const fallbackProduct = document.getElementById('fallbackProduct');
  const controlsEl = document.getElementById('heroControls');

  // Graceful bail: keep the premium PNG showcase if canvas/Three is missing.
  if (!canvas || !window.THREE || typeof window.THREE.WebGLRenderer !== 'function') {
    if (canvas) canvas.setAttribute('data-state', 'off');
    return;
  }

  let renderer = null, scene = null, camera = null, controls = null;
  let product = null, envPMREM = null, clock = null, under = null;
  let autoRotate = true;
  let zoomed = false;
  let defaultPos = { x: 0, y: 0.45, z: 6.2 }; // cinematic elevated framing
  let started = false;
  let disposed = true;
  let reducedMotion = false;
  let currentScale = 1; // per-viewport product scale
  let firstFrameDone = false;
  // base hover amplitude (scaled down when reduced-motion)
  let bobAmp = 0.12;
  let particles = null;          // ambient dust Points cloud
  let particlesGeo = null;
  let particlesMat = null;
  let particlesVel = null;       // per-particle velocity (Float32Array)
  const PARTICLE_COUNT = 70;     // tuned low -> minimal GPU cost
  let mouseNX = 0, mouseNY = 0;  // normalized -1..1 pointer position (for parallax)

  // Feature-detect reduced motion once.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mq.matches;
    // react live if the OS preference changes
    function onMotionChange(e) {
      reducedMotion = e.matches;
      bobAmp = reducedMotion ? 0.03 : 0.12;
      // turn auto-rotate off when the user asks for reduced motion
      if (reducedMotion && controls) controls.autoRotate = false;
      else if (!autoRotate) return;
    }
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onMotionChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onMotionChange);
    }
  }
  if (reducedMotion) autoRotate = false;

  function buildPmremEnvironment() {
    // Procedural "Room" environment for reflections (no external HDR needed).
    const geo = new window.THREE.RoomEnvironment ? null : new window.THREE.BoxGeometry(1, 1, 1);
    // Re-implement a tiny gradient environment so MeshStandardMaterial has envMap.
    const sceneEnv = new window.THREE.Scene();
    const pmrem = new window.THREE.PMREMGenerator(renderer);
    if (window.THREE.RoomEnvironment) {
      const envScene = new window.THREE.RoomEnvironment();
      envPMREM = pmrem.fromScene(envScene, 0.04);
    } else {
      // simple gradient dome fallback
      const domeMat = new window.THREE.MeshBasicMaterial({ color: 0x141414, side: window.THREE.BackSide });
      const dome = new window.THREE.Mesh(geo, domeMat);
      sceneEnv.add(dome);
      const glow = new window.THREE.SpotLight(0xF5B041, 2, 20, 0.6);
      glow.position.set(3, 4, 3);
      sceneEnv.add(glow);
      const rim = new window.THREE.SpotLight(0xFF8C00, 1.5, 20, 0.6);
      rim.position.set(-3, 1, -3);
      sceneEnv.add(rim);
      envPMREM = pmrem.fromScene(sceneEnv, 0.04);
    }
    pmrem.dispose();
    return envPMREM;
  }

  function init() {
    const THREE = window.THREE;
    clock = new THREE.Clock();

    // Scene
    scene = new THREE.Scene();
    scene.background = null; // transparent overlay over CSS bg
    scene.fog = new THREE.Fog(0x050505, 10, 22);

    // Camera
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    camera.position.set(defaultPos.x, defaultPos.y, defaultPos.z);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Environment (reflection)
    envPMREM = buildPmremEnvironment();
    scene.environment = envPMREM ? envPMREM.texture : null;

    // ---- Lighting ----
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xF5B041, 1.65);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x4455aa, 0.5);
    fill.position.set(-4, 1, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xFF8C00, 1.05);
    rim.position.set(-3, 0, -4);
    scene.add(rim);

    under = new THREE.PointLight(0xFF8C00, 1.15, 6, 1.8);
    under.position.set(0, -1.9, 0.6);
    under.castShadow = false;
    scene.add(under);

    // ---- Product (PNG surface, double-sided so it never looks blank) ----
    product = buildProduct();

    // Ground shadow disc (soft contact shadow)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 48),
      new THREE.MeshShadowMaterial
        ? new THREE.MeshShadowMaterial({ opacity: 0.55 })
        : new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -1.5;
    disc.receiveShadow = true;
    scene.add(disc);

    // soft warm ground glow ring under product
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.6, 48),
      new THREE.MeshBasicMaterial({ color: 0xF5B041, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -1.49;
    scene.add(glowRing);
    window.__glowRing = glowRing;

    // Large soft radial gradient glow behind the product (cinematic depth halo)
    const backdropGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 6.5),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(0xF5B041) },
          uBright: { value: 0.10 }
        },
        vertexShader: [
          'varying vec2 vUv;',
          'void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uColor;',
          'uniform float uBright;',
          'varying vec2 vUv;',
          'void main(){',
          '  float d = distance(vUv, vec2(0.5,0.5)) * 2.0;',
          '  float glow = exp(-d*d*1.8) * uBright;',
          '  gl_FragColor = vec4(uColor * glow, glow);',
          '}'
        ].join('\n')
      })
    );
    backdropGlow.position.set(0, 0.2, -2.2);
    backdropGlow.renderOrder = -2;
    scene.add(backdropGlow);
    window.__backdropGlow = backdropGlow;

    // ---- OrbitControls ----
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enableZoom = true;
      controls.minDistance = 4.2;
      controls.maxDistance = 12;
      controls.enablePan = false;
      controls.enableRotate = true;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.9;
      controls.target.set(0, 0, 0);
    }

    // Ambient dust particles (cheap, single Points draw call, additive glow)
    if (!reducedMotion) {
      buildParticles();
    }

    // Gentle pointer parallax on the hero stage (desktop only)
    setupParallax();

    applyResponsive();
    window.addEventListener('resize', applyResponsive);
  }

  // Lightweight ambient particles: one shared geometry + velocity buffer, animated
  // in the render loop by mutating positions in place (no per-frame allocation).
  function buildParticles() {
    const THREE = window.THREE;
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    particlesVel = vel;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 11;      // x spread across stage
      pos[i3 + 1] = (Math.random() - 0.5) * 7;   // y spread
      pos[i3 + 2] = (Math.random() - 0.5) * 8 - 1; // z (behind & around product)
      vel[i3] = (Math.random() - 0.5) * 0.012;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.012 + 0.006; // gentle upward drift
      vel[i3 + 2] = (Math.random() - 0.5) * 0.012;
    }

    particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    particlesMat = new THREE.PointsMaterial({
      color: 0xF5B041,
      size: 0.05,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    particles = new THREE.Points(particlesGeo, particlesMat);
    particles.frustumCulled = false;
    scene.add(particles);
  }

  // Normalized pointer position (+ subtle camera parallax). Desktop non-reduced only.
  function setupParallax() {
    if (reducedMotion) return;
    const target = canvas || stage;
    if (!target) return;
    const onMove = function (e) {
      const w = stage ? stage.clientWidth : window.innerWidth;
      const h = stage ? stage.clientHeight : window.innerHeight;
      if (w === 0 || h === 0) return;
      const nx = ((e.clientX || 0) / w) * 2 - 1;
      const ny = ((e.clientY || 0) / h) * 2 - 1;
      mouseNX = nx;
      mouseNY = ny;
      // subtle copy parallax on touch-friendly? only desktop
      const heroCopy = document.querySelector('.hero-copy');
      if (heroCopy && !isTouchLike()) {
        heroCopy.style.transform = 'translate3d(' + (nx * -8) + 'px,' + (ny * -5) + 'px,0)';
      }
    };
    const onLeave = function () {
      mouseNX = 0; mouseNY = 0;
      const heroCopy = document.querySelector('.hero-copy');
      if (heroCopy) heroCopy.style.transform = '';
    };
    target.addEventListener('mousemove', onMove, { passive: true });
    target.addEventListener('mouseleave', onLeave, { passive: true });
  }

  function isTouchLike() {
    return window.matchMedia && window.matchMedia('(hover: none)').matches;
  }

  function buildProduct() {
    const THREE = window.THREE;
    const group = new THREE.Group();

    // Load product PNG via TextureLoader. If it fails (offline/blocked), we
    // still build a styled gold surface so the viewer is never blank.
    let geo, mat;
    mat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      metalness: 0.4,
      roughness: 0.35,
      transparent: true
    });
    geo = new THREE.BoxGeometry(1.5, 2.0, 0.16);

    const card = new THREE.Mesh(geo, mat);
    card.castShadow = true;
    card.receiveShadow = true;

    // Front & back face with PNG product texture (double-sided preview)
    const faceMat = new THREE.MeshStandardMaterial({
      map: null,
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.45,
      transparent: true
    });
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    texLoader.load(
      'assets/products/web/products2.webp',
      function (tex) {
        tex.encoding = THREE.sRGBEncoding;
        faceMat.map = tex;
        faceMat.needsUpdate = true;
        card.material = faceMat;
      },
      undefined,
      function () {
        // texture failed -> keep gold plate (never blank)
        card.material = mat;
      }
    );
    card.material = faceMat; // initial

    // Gold frame trim (layered bevel: outer rim -> inner face -> soft glow edge)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xF5B041, metalness: 0.72, roughness: 0.28, emissive: 0x3a2a00, emissiveIntensity: 0.14
    });
    const rimBright = new THREE.MeshStandardMaterial({
      color: 0xFFE39B, metalness: 0.85, roughness: 0.2, emissive: 0x5a3f00, emissiveIntensity: 0.22
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.58, 2.08, 0.05), frameMat);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.02, 0.045), rimBright);
    inner.position.z = 0.016;
    // subtle gold glow edge trapped between frame and face (premium halo)
    const glowEdge = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.0, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xF5B041, transparent: true, opacity: 0.16 })
    );
    glowEdge.position.z = 0.01;
    glowEdge.renderOrder = -1;
    group.add(frame);
    group.add(inner);
    group.add(glowEdge);

    // floating coffee beans around the product (dynamic decoration)
    const beanMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.6 });
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), beanMat);
      b.scale.set(1, 1.5, 0.7);
      const ang = (i / 10) * Math.PI * 2;
      const r = 1.35 + (i % 3) * 0.22;
      const yp = 0.9 + Math.sin(ang * 2 + i) * 0.35;
      b.position.set(Math.cos(ang) * r, yp, Math.sin(ang) * (0.35 + (i % 2) * 0.2));
      b.userData = {
        phase: i * 1.35, amp: 0.14, baseY: yp, baseR: r, baseAng: ang, speed: 0.008 + (i % 4) * 0.002
      };
      group.add(b);
    }

    group.add(card);
    group.position.y = 0;
    return group;
  }

  function startIfNeeded() {
    if (started && !disposed) { showCanvas(); return; }
    try {
      init();
      started = true;
      disposed = false;
      // Try to upgrade to an actual 3D model ONLY if a .glb file is available.
      // If not (current state), the PNG product card remains — fully non-blocking.
      tryLoadGLB();
      showCanvas();
      animate();
    } catch (e) {
      // WebGL init failed -> keep PNG fallback
      fallbackToPng();
    }
  }

  // Optional GLB upgrade. Guesses a matching .glb for the product image. If none
  // exists or the loader is unavailable, it silently keeps the PNG product card.
  function tryLoadGLB() {
    const THREE = window.THREE;
    if (!product || !THREE || typeof THREE.GLTFLoader !== 'function') return;
    const loader = new THREE.GLTFLoader();
    const candidates = [
      'assets/products/web/products2.glb',
      'assets/products/products.glb',
      'assets/products/web/product.glb'
    ];
    // probe each candidate; first that loads wins
    let tried = 0;
    function probe(url) {
      loader.load(
        url,
        function (gltf) {
          // swap decorated PNG card for the real model, keep existing lighting
          const model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!model) return;
          model.position.y = -0.7; // seat model onto the same platform
          model.traverse(function (o) {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          product.add(model);
          // hide the placeholder card + beans + frame (model replaces them visually)
          product.children.forEach(function (c) {
            if (c !== model) c.visible = false;
          });
          product.userData.isModel = true;
        },
        undefined,
        function () {
          attempted(url); // 404 / load error -> move on
        }
      );
    }
    function attempted() {
      tried++;
      if (tried < candidates.length) {
        // try next candidate synchronously (loader is async; short delay is fine)
        setTimeout(function () { probe(candidates[tried]); }, 20);
      }
    }
    probe(candidates[0]);
  }

  function showCanvas() {
    if (canvas) {
      canvas.style.display = 'block';
      canvas.setAttribute('data-state', 'on');
      // fade canvas in on the next frame (smooth, no hard pop)
      requestAnimationFrame(function () {
        if (canvas) canvas.classList.add('is-ready');
      });
    }
    // fade premium PNG showcase out + reveal 3D controls now that WebGL is live
    if (fallbackProduct) fallbackProduct.classList.add('is-hidden');
    if (controlsEl) controlsEl.hidden = false;
  }

  function fallbackToPng() {
    if (canvas) { canvas.style.display = 'none'; canvas.setAttribute('data-state', 'off'); }
    if (fallbackProduct) fallbackProduct.classList.remove('is-hidden');
    if (controlsEl) controlsEl.hidden = true;
    hideLoader();
    dispose();
  }

  // ---- Lazy load: only start when hero is near viewport ----
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          startIfNeeded();
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });
    io.observe(canvas);
  } else {
    if (window.requestIdleCallback) window.requestIdleCallback(startIfNeeded, { timeout: 800 });
    else setTimeout(startIfNeeded, 200);
  }

  // Cinematic framing: pick camera distance + product scale to fit any viewport
  // (desktop two-col, tablet single-col, narrow/high mobile, short landscape).
  function applyResponsive() {
    if (!renderer || !camera) return;
    const w = stage ? stage.clientWidth : window.innerWidth;
    const h = stage ? stage.clientHeight : window.innerHeight;
    if (w === 0 || h === 0) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const aspect = w / h;
    // Short / landscape stage -> pull the camera back so the card is never clipped.
    let z = w < 600 ? 5.6 : (w < 900 ? 6.0 : 6.2);
    if (aspect > 1.5 && h < 420) z = 6.6;

    let targetScale = 1;
    if (w >= 900 && h >= 480) {
      // Desktop: keep scale stable at 1 (premium framing).
      targetScale = 1;
    } else if (w < 600) {
      // Narrow / mobile single-col: tighter so it doesn't tower over the headline.
      targetScale = h < 360 ? 0.78 : 0.86;
    } else {
      // Tablet single-col band.
      targetScale = h < 380 ? 0.82 : 0.9;
    }

    if (!zoomed && !camTarget && (camera.position.z !== z || camera.position.y !== defaultPos.y)) {
      camera.position.z = z;
      camera.position.y = defaultPos.y;
      if (controls) controls.target.y = 0;
      camera.lookAt(0, 0, 0);
    }

    if (product && product.scale.x !== targetScale) {
      product.scale.set(targetScale, targetScale, targetScale);
      currentScale = targetScale;
    }
  }

  // ---- Custom controls (Autorotate / Zoom / Reset) ----
  window.setAutoRotate = function (v) {
    autoRotate = typeof v === 'boolean' ? v : !autoRotate;
    if (controls) controls.autoRotate = autoRotate;
  };
  window.setZoom = function () {
    if (!controls || !camera) return;
    zoomed = !zoomed;
    if (zoomed) {
      controls.minDistance = 2.8;
      animateCameraTo(0, 0, 3.6);
    } else {
      controls.minDistance = 4.2;
      animateCameraTo(defaultPos.x, defaultPos.y, defaultPos.z);
    }
  };
  window.resetView = function () {
    if (!controls || !camera) return;
    zoomed = false;
    controls.minDistance = 4.2;
    // don't force auto-rotate back on for users who prefer reduced motion
    autoRotate = reducedMotion ? false : true;
    controls.autoRotate = autoRotate;
    document.body.setAttribute('data-autorotate', autoRotate ? '1' : '0');
    animateCameraTo(defaultPos.x, defaultPos.y, defaultPos.z);
    if (product) product.rotation.set(0, 0, 0);
  };

  var camTarget = null;
  function animateCameraTo(x, y, z) {
    camTarget = new window.THREE.Vector3(x, y, z);
  }

  bobAmp = reducedMotion ? 0.03 : 0.12;

  function hideLoader() {
    const loaderEl = document.getElementById('heroLoader');
    if (!loaderEl) return;
    loaderEl.classList.add('is-done');
    setTimeout(function () { if (loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl); }, 600);
  }

  function animate(/* keep going each frame */) {
    if (disposed) return;
    requestAnimationFrame(animate);
    if (!clock || !renderer || !scene || !camera) return;
    var t = clock.getElapsedTime();

    // smooth camera move for zoom/reset
    if (camTarget && controls) {
      camera.position.lerp(camTarget, 0.08);
      if (camera.position.distanceTo(camTarget) < 0.05) camTarget = null;
    }

    // gentle hover (calmer when reduced-motion is requested)
    // Natural idle animation: layered gentle bob + slow rotation sway (feels organic,
    // not a rigid sine). Reduced-motion collapses to a near-static calm float.
    if (product) {
      const idle = reducedMotion ? 0.35 : 1;
      const hover = Math.sin(t * 0.8) * bobAmp * idle;
      const breathe = Math.sin(t * 0.5 + 1.2) * 0.018 * idle;
      product.position.y = hover;
      product.rotation.x = breathe;
      // slow sway toward the pointer (gentle pointer-aware lean)
      const targetLean = reducedMotion ? 0 : mouseNX * 0.08;
      product.rotation.z += (targetLean - product.rotation.z) * 0.02;
    }

    // floating beans: gentle bob + drift orbit for a lively premium feel.
    // NOTE: baseAng/baseR are stored once at build time, so orbit stays symmetric
    // and deterministic (does not read shifted local x for z depth).
    if (product) {
      var zDepth = reducedMotion ? 0.9 : 1;
      product.children.forEach(function (c) {
        if (c.userData && c.userData.phase !== undefined) {
          var u = c.userData;
          var a = u.baseAng + t * u.speed;
          var drift = 0.35 + (Math.cos(a) > 0 ? 0.2 : 0);
          c.position.x = Math.cos(a) * u.baseR;
          c.position.z = Math.sin(a) * drift * zDepth;
          c.position.y = u.baseY + Math.sin(t * 0.9 + u.phase) * u.amp * (reducedMotion ? 0.3 : 1);
          c.rotation.y += reducedMotion ? 0.004 : 0.012;
          c.rotation.z = Math.sin(t * 0.7 + u.phase) * 0.4 * (reducedMotion ? 0.3 : 1);
        }
      });
    }

    // ambient dust: mutate positions in place (no allocation), slight pointer parallax bias
    if (particles && particlesGeo && particlesVel) {
      const posAttr = particlesGeo.getAttribute('position');
      const arr = posAttr.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        arr[i3] += particlesVel[i3];
        arr[i3 + 1] += particlesVel[i3 + 1];
        arr[i3 + 2] += particlesVel[i3 + 2];
        // soft horizontal parallax while the mouse moves
        arr[i3] += mouseNX * 0.0015;
        // wrap around bounds
        if (arr[i3] > 5.5) arr[i3] = -5.5; else if (arr[i3] < -5.5) arr[i3] = 5.5;
        if (arr[i3 + 1] > 3.5) arr[i3 + 1] = -3.5; else if (arr[i3 + 1] < -3.5) arr[i3 + 1] = 3.5;
        if (arr[i3 + 2] > 3.5) arr[i3 + 2] = -3.5; else if (arr[i3 + 2] < -5.5) arr[i3 + 2] = 5.5;
      }
      posAttr.needsUpdate = true;
    }

    // subtle pulsing ground glow
    if (window.__glowRing) {
      window.__glowRing.material.opacity = 0.10 + Math.abs(Math.sin(t * 0.8)) * 0.05;
    }

    // slow breathing halo behind product (cinematic depth)
    if (window.__backdropGlow && window.__backdropGlow.material && window.__backdropGlow.material.uniforms) {
      window.__backdropGlow.material.uniforms.uBright.value = 0.085 + Math.sin(t * 0.45 + 1.0) * 0.02;
    }

    // under-glow flicker subtle
    if (under) under.intensity = 1.0 + Math.sin(t * 1.4) * 0.15;

    // pointer parallax: nudge the camera target slightly for a cinematic feel
    if (!reducedMotion && controls && !zoomed && !camTarget) {
      controls.target.x = mouseNX * 0.12;
      controls.target.y = -mouseNY * 0.08;
    }

    if (controls) controls.update();
    renderer.render(scene, camera);

    // First successful render -> drop the loading veil (smooth, no hard swap).
    if (!firstFrameDone) {
      firstFrameDone = true;
      hideLoader();
    }
  }

  // ---- Cleanup (memory leaks) ----
  function dispose() {
    if (!started) return;
    disposed = true;
    if (renderer) {
      renderer.dispose();
      renderer.renderLists.dispose && renderer.renderLists.dispose();
    }
    if (scene) {
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
    if (envPMREM && envPMREM.texture) envPMREM.texture.dispose();
    if (particlesGeo) { particlesGeo.dispose(); particlesGeo = null; }
    if (particlesMat) { particlesMat.dispose(); particlesMat = null; }
    particles = null;
    particlesVel = null;
    if (controls) { controls.dispose(); controls = null; }
    window.removeEventListener('resize', applyResponsive);
  }
  window.addEventListener('beforeunload', dispose);
})();
