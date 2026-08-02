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
  let lastT = 0; // previous frame time (for frame-rate-independent sway speed)
  let defaultPos = { x: 0, y: 0.45, z: 8.0 }; // cinematic elevated framing (pulled back so the 3D product fits the hero box with a small margin)
  let started = false;
  let disposed = true;
  let reducedMotion = false;
  let currentScale = 1; // per-viewport product scale
  let firstFrameDone = false;
  // UX: pause auto-rotate while the user drags, then resume after N ms idle.
  let interacting = false;         // true while an OrbitControls interaction is active
  let idleTimer = null;            // timer that re-enables auto-rotate after idle
  const AUTO_IDLE_MS = 3000;       // seconds of no interaction before auto-rotate returns
  // base hover amplitude (scaled down when reduced-motion)
  let bobAmp = 0.12;
  let particles = null;          // ambient dust Points cloud
  let particlesGeo = null;
  let particlesMat = null;
  let particlesVel = null;       // per-particle velocity (Float32Array)
  const PARTICLE_COUNT = 70;     // tuned low -> minimal GPU cost
  let mouseNX = 0, mouseNY = 0;  // normalized -1..1 pointer position (for parallax)
  // Intro product sweep: spin the product itself DEPAN -> BELAKANG -> DEPAN
  // (full 360°) once after first render, then hand back to normal controls.
  // ---- Idle behaviour (PNG-aware: never fake a full 360° spin) ----
  // The asset is a real front + back photo on a thin pouch. A full 360° spin or
  // a camera that circles the card just shows a flat edge-on sliver, so we keep
  // the product alive with a gentle LEFT/RIGHT sway (±12°) plus a floating bob,
  // and reveal the real BACK face once via a smooth eased flip at intro.
  let introSweep = false;   // true while the one-time front<->back intro flip runs
  let introSweepT = 0;      // 0..1 eased progress of the intro flip
  const SWAY_AMP   = 0.21;  // ±0.21 rad ≈ ±12° amp of the idle sway
  const SWAY_SPEED = 0.5;   // radians of phase per second (gentle, ~0.5 rad/s)
  let swayPhase = 0;        // running phase accumulator for the sway (frame-independent)

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
    // NOTE: RoomEnvironment only exists in three r132+. In r128 (this build) it's
    // undefined, so we fall back to a lightweight gradient dome. We must test the
    // constructor REFERENCE, never `new RoomEnvironment` here (that would throw).
    const geo = window.THREE.RoomEnvironment ? null : new window.THREE.BoxGeometry(1, 1, 1);
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
    scene.add(product); // FIXED: product was built but never added to the scene!

    // Ground shadow disc (soft contact shadow)
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.8, 48),
      // MeshShadowMaterial is r132+ only; test the constructor REFERENCE (never
      // `new MeshShadowMaterial` in the condition) so we cleanly fall back for r128.
      THREE.MeshShadowMaterial
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
      controls.dampingFactor = 0.12; // snappier, less "heavy" response while staying smooth
      controls.enableZoom = true;
      controls.minDistance = 4.2;
      controls.maxDistance = 12;
      controls.enablePan = false;
      controls.enableRotate = true;
      controls.autoRotate = false;      // camera stays still by default: the product's own eased sway (/±12°) brings it to life
      controls.autoRotateSpeed = 0.9;
      controls.target.set(0, 0, 0);

      // Pause auto-rotate the moment the user grabs the product.
      controls.addEventListener('start', function () {
        interacting = true;
        // if the user grabs during the intro flip, hand control over cleanly by
        // keeping the rotation at its current eased position (no snapping).
        if (introSweep) {
          var eCur = easeInOutSine(introSweepT);
          introSweep = false;
          product.rotation.y = Math.sin(eCur * Math.PI) * Math.PI;
        }
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        if (controls) controls.autoRotate = false;
      });
      controls.addEventListener('end', function () {
        interacting = false;
        if (idleTimer) clearTimeout(idleTimer);
        // Resume the gentle idle sway automatically (animate() sees interacting=false
        // and eases the card back into its slow ±12° sway). No full camera 360-spin
        // here — that reminds the flattened look of a PNG, so we leave the camera still.
        if (reducedMotion) return;
        idleTimer = setTimeout(function () {
          idleTimer = null;
          swayPhase = 0; // restart sway phase on a soft note after a pause
        }, AUTO_IDLE_MS);
      });
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
    // The product has real thickness + a branded BACK panel so a full 360°
    // spin (DEPAN -> BELAKANG) looks solid from every angle.
    let mat, bodyMat, backMat, faceMat;
    mat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      metalness: 0.4,
      roughness: 0.35,
      transparent: true
    });
    // side / rim of the product (thickness)
    bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a331f, metalness: 0.55, roughness: 0.42
    });
    // branded back panel (premium dark gold) — visible when spun to the back.
    backMat = new THREE.MeshBasicMaterial({
      map: null,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    backMat.toneMapped = false;
    // front face = product PNG (MeshBasicMaterial: shows the photo as-is, never
    // darkened by scene lighting/environment). transparent so the remove-bg PNG
    // floats cleanly instead of showing as a solid black rectangle.
    faceMat = new THREE.MeshBasicMaterial({
      map: null,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    faceMat.toneMapped = false;
    // Produk = foto PNG transparan (portrait 407x613), ditampilkan DIAM / statis.
    // Tidak ada animasi & tidak ada buku/kotak — hanya foto mengambang.
    // DoubleSide agar terlihat dari depan; transparent untuk PNG tanpa latar.
    faceMat.transparent = true;     // PNG dengan latar transparan (remove-bg)
    var card = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 4.52),
      faceMat
    );
    card.castShadow = false;

    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');

    // --- Inline-base64 photo source (works over file:// too) ---
    // Browser blocks cross-origin texture loads on the file:// protocol, which is
    // why plain path loads appear blank when the page is opened by double-click.
    // When js/hero-data.js is loaded it provides HERO_FRONT_DATA / HERO_BACK_DATA
    // (data:image/jpeg;base64,...) so we can feed the photo straight in with no
    // network request at all.
    function photoSrc(kind) {
      if (kind === 'front' && window.HERO_FRONT_DATA) return window.HERO_FRONT_DATA;
      if (kind === 'back' && window.HERO_BACK_DATA) return window.HERO_BACK_DATA;
      return kind === 'front'
        ? 'assets/products/web/hero-front.png'
        : 'assets/products/web/hero-back.png';
    }
    // data: URIs must go through a plain loader (no crossOrigin) to avoid tainting.
    function loadPhoto(kind, apply) {
      var src = photoSrc(kind);
      var loader = (src.indexOf('data:') === 0) ? new THREE.TextureLoader() : texLoader;
      loader.load(src, apply);
    }

    // ---- Foto produk dari folder /animasi (foto yang sama, disebar DoubleSide) ----
    loadPhoto('front', function (tex) {
      faceMat.map = tex;
      faceMat.needsUpdate = true;
      card.material.needsUpdate = true;
    });

    // (Removed: gold border/frame removed so the product shows as a clean
    // floating product photo instead of a framed "book" block.)

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
      showCanvas();
      animate();
    } catch (e) {
      // WebGL init failed -> keep PNG fallback
      console.warn('[Three] WebGL init failed, using PNG fallback:', e && e.message, e);
      fallbackToPng();
    }
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
  // NOTE: we observe the hero stage (which always has a real layout box) instead
  // of the canvas itself. The canvas is display:none until WebGL boots, and an
  // IntersectionObserver treats display:none elements as never-intersecting, so
  // observing the canvas would create a deadlock (canvas never wakes, Three.js
  // never starts). Observing the visible stage fixes that without giving up lazy-load.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          startIfNeeded();
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });
    io.observe(stage || canvas);
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
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (controls) controls.autoRotate = autoRotate && !interacting;
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
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    // Reset to the still camera + gentle product sway (never force a fake camera
    // 360-spin over a PNG). Keep the manual Autorotate toggle available if the
    // user explicitly asks for a camera spin.
    controls.autoRotate = false;
    document.body.setAttribute('data-autorotate', '0');
    autoRotate = reducedMotion ? false : false;
    swayPhase = 0;
    animateCameraTo(defaultPos.x, defaultPos.y, defaultPos.z);
    if (product) product.rotation.set(0, 0, 0);
  };

  var camTarget = null;
  function animateCameraTo(x, y, z) {
    camTarget = new window.THREE.Vector3(x, y, z);
  }

  bobAmp = reducedMotion ? 0.03 : 0.12;

  // Smooth eased interpolation 0..1 -> ease-in-out sine (soft start/end, no snapping).
  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

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
    var dt = (lastT ? (t - lastT) : 0.016); // frame-rate independent delta (fallback ~60fps)
    dt = Math.min(dt, 0.1);                  // clamp big jumps (tab in/out) to avoid yank
    lastT = t;

    // smooth camera move for zoom/reset
    if (camTarget && controls) {
      camera.position.lerp(camTarget, 0.08);
      if (camera.position.distanceTo(camTarget) < 0.05) camTarget = null;
    }

    // Produk statis: TIDAK ada animasi three.js (no bob / no breath / no rotation,
    // no pointer lean). Produk selalu menghadap depan dengan rotasi nol.
    if (product) {
      product.position.y = 0;
      product.rotation.set(0, 0, 0);
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

    // pointer parallax: nudge the camera target slightly for a cinematic feel.
    // Disabled while the user is dragging so it never fights the OrbitControls rotate.
    if (!reducedMotion && controls && !zoomed && !camTarget && !interacting) {
      controls.target.x = mouseNX * 0.12;
      controls.target.y = -mouseNY * 0.08;
    }

    if (controls) controls.update();
    renderer.render(scene, camera);

    // First successful render -> drop the loading veil (smooth, no hard swap).
    if (!firstFrameDone) {
      firstFrameDone = true;
      hideLoader();
      // Start a one-time, eased front (0°) -> back (180°) -> front (0°) intro
      // flip so the real BACK photo is revealed naturally. We purposely do NOT
      // spin the camera -360° (that flattened a PNG and looked fake); after the
      // flip the product settles into a gentle ±12° sway. Camera stays still.
      if (!reducedMotion && product && !product.userData.isModel) {
        introSweep = true;
        introSweepT = 0;
        swayPhase = 0;
        product.rotation.y = 0;
        if (controls) controls.autoRotate = false;
      }
    }
  }

  // ---- Cleanup (memory leaks) ----
  function dispose() {
    if (!started) return;
    disposed = true;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
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
