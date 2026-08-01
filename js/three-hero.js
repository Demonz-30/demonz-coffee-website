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

    applyResponsive();
    window.addEventListener('resize', applyResponsive);
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

    // Gold frame trim (slightly thicker, layered bevel)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xF5B041, metalness: 0.72, roughness: 0.28, emissive: 0x3a2a00, emissiveIntensity: 0.14
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.58, 2.08, 0.05), frameMat);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.02, 0.03), frameMat);
    inner.position.z = 0.012;
    group.add(frame);
    group.add(inner);

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

  function applyResponsive() {
    if (!renderer || !camera) return;
    const w = stage ? stage.clientWidth : window.innerWidth;
    const h = stage ? stage.clientHeight : window.innerHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Cinematic framing: pull camera a touch closer on narrow single-col layouts
    const z = w < 600 ? 5.6 : (w < 900 ? 6.0 : 6.2);
    if (camera.position.z !== z && !zoomed && !camTarget) {
      camera.position.z = z;
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
    autoRotate = true;
    controls.autoRotate = true;
    document.body.setAttribute('data-autorotate', '1');
    animateCameraTo(defaultPos.x, defaultPos.y, defaultPos.z);
    if (product) product.rotation.set(0, 0, 0);
  };

  var camTarget = null;
  function animateCameraTo(x, y, z) {
    camTarget = new window.THREE.Vector3(x, y, z);
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

    // gentle hover
    if (product) {
      product.position.y = Math.sin(t * 0.8) * 0.12;
    }
    // floating beans: gentle bob + drift orbit for a lively premium feel
    if (product) {
      product.children.forEach(function (c) {
        if (c.userData && c.userData.phase !== undefined) {
          var u = c.userData;
          c.position.x = Math.cos(u.baseAng + t * u.speed) * u.baseR;
          c.position.z = Math.sin(u.baseAng + t * u.speed) * (0.35 + (c.position.x > 0 ? 0.2 : 0));
          c.position.y = u.baseY + Math.sin(t * 0.9 + u.phase) * u.amp;
          c.rotation.y += 0.012;
          c.rotation.z = Math.sin(t * 0.7 + u.phase) * 0.4;
        }
      });
    }

    // subtle pulsing ground glow
    if (window.__glowRing) {
      window.__glowRing.material.opacity = 0.10 + Math.abs(Math.sin(t * 0.8)) * 0.05;
    }

    // under-glow flicker subtle
    if (under) under.intensity = 1.0 + Math.sin(t * 1.4) * 0.15;

    if (controls) controls.update();
    renderer.render(scene, camera);
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
    if (controls) { controls.dispose(); controls = null; }
    window.removeEventListener('resize', applyResponsive);
  }
  window.addEventListener('beforeunload', dispose);
})();
