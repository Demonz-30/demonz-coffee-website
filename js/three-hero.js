/* ============================================================
   DEMONZ COFFEE — Three.js Hero
   - 360° rotatable 3D coffee product (drag or touch)
   - Steaming smoke, floating beans, floating particles
   - Cinematic lighting, gold/orange rim light
   ============================================================ */
(function () {
  const canvas = document.getElementById('hero-canvas');
  const fallbackProduct = document.getElementById('fallbackProduct');

  // If the Three.js library or the canvas is missing, keep the CSS 3D fallback
  // product visible and hide the empty canvas so the page never shows a blank gap.
  if (!canvas || !window.THREE) {
    if (canvas) canvas.style.display = 'none';
    return;
  }

  let renderer, scene, camera, productGroup, coffee, steamParticles = [];
  let autoRotate = true;
  let zoomed = false;
  let isDragging = false;
  let rotationTarget = null;
  // Product sits left-of-center, large, on the golden ground disc
  let initialPos = new THREE.Vector3(-1.6, -0.4, 0);

  var clock = new THREE.Clock();

  // Hide the CSS 3D fallback product once the real WebGL scene is running so
  // the two products never overlap. (Keeps the layout identical.)
  function hideFallback() {
    if (fallbackProduct) fallbackProduct.classList.add('is-hidden');
  }

  // Only initialise WebGL if we can actually create a renderer. If WebGL is
  // unavailable, the CSS fallback product stays visible instead of blank.
  try {
    init();
    hideFallback();
    animate();
  } catch (e) {
    if (canvas) canvas.style.display = 'none';
    // fallback product remains visible
  }

  function init() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050505, 6, 14);

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // ============ Cinematic Lighting ============
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    // Gold key light (cinematic warm)
    const keyLight = new THREE.DirectionalLight(0xF5B041, 1.4);
    keyLight.position.set(4, 3, 5);
    scene.add(keyLight);

    // Orange fill / rim light
    const rimLight = new THREE.DirectionalLight(0xFF8C00, 1.0);
    rimLight.position.set(-4, 0.5, -3);
    scene.add(rimLight);

    // Soft cool fill
    const fill = new THREE.DirectionalLight(0x4455aa, 0.4);
    fill.position.set(0, -2, 4);
    scene.add(fill);

    // Point glow beneath (table glow)
    const underGlow = new THREE.PointLight(0xFF8C00, 1.2, 6, 1.8);
    underGlow.position.set(0.5, -1.6, 0.5);
    scene.add(underGlow);

    // ============ Product Group (coffee + steam) ============
    productGroup = new THREE.Group();
    productGroup.position.copy(initialPos);
    scene.add(productGroup);

    buildCoffeeProduct();
    buildSteam();
    buildFloatingBeans();
    buildParticles();

    // Responsive: on small/narrow screens center the product rather than place off-left
    applyResponsivePosition();
    window.addEventListener('resize', applyResponsivePosition);

    // ============ Interaction ============
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    canvas.addEventListener('touchend', onPointerUp);
    window.addEventListener('resize', onResize);

    // Expose global controls
    window.setAutoRotate = function (v) { autoRotate = typeof v === 'boolean' ? v : !autoRotate; };
    window.setZoom = function () {
      zoomed = !zoomed;
      // zoom target pulled camera close to product (use current x)
      rotationTarget = zoomed
        ? new THREE.Vector3(initialPos.x, initialPos.y + 0.2, 3.6)
        : new THREE.Vector3(0, 0, 7.5);
    };
    window.resetView = function () {
      zoomed = false;
      rotationTarget = new THREE.Vector3(0, 0, 7.5);
      productGroup.rotation.set(0, 0, 0);
      if (coffee) coffee.rotation.y = 0;
    };
  }

  /* ---- Build the 3D coffee bag / cup product stack ---- */
  function buildCoffeeProduct() {
    productGroup = productGroup || new THREE.Group();

    // ---- Pack of coffee (bag shape) - uses a box with rounded feel, floating above ground ----
    const bagMat = new THREE.MeshPhysicalMaterial({
      color: 0x181818,
      metalness: 0.25,
      roughness: 0.35,
      clearcoat: 0.8,
      clearcoatRoughness: 0.3
    });

    const bag = new THREE.Group();

    // Main body (cylinder-ish box)
    const bodyGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.5, 32);
    const body = new THREE.Mesh(bodyGeo, bagMat);
    body.position.y = 0;
    bag.add(body);

    // Gold band (label)
    const bandMat = new THREE.MeshPhysicalMaterial({
      color: 0xF5B041, metalness: 0.6, roughness: 0.3, emissive: 0x3a2a00, emissiveIntensity: 0.15
    });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.5, 32), bandMat);
    band.position.y = 0.1;
    bag.add(band);

    // Lid / top ring (gold)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.6 });
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.25, 32), lidMat);
    lid.position.y = 0.9;
    bag.add(lid);

    // Steam spout (cylinder)
    const spoutMat = new THREE.MeshPhysicalMaterial({ color: 0xF5B041, metalness: 0.7, roughness: 0.25 });
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12), spoutMat);
    spout.position.y = 1.15;
    bag.add(spout);

    // put bag on a ground disc
    const discMat = new THREE.MeshPhysicalMaterial({
      color: 0x181818, metalness: 0.8, roughness: 0.2, clearcoat: 1
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.9;
    bag.add(disc);

    // a few whole beans scattered on the disc
    for (let i = 0; i < 6; i++) {
      const beanMat = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.7 });
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), beanMat);
      const ang = (i / 6) * Math.PI * 2;
      bean.position.x = Math.cos(ang) * 0.6;
      bean.position.z = Math.sin(ang) * 0.6;
      bean.scale.y = 1.4;
      bean.position.y = -0.85;
      bag.add(bean);
    }

    // Scale up whole product
    bag.scale.set(1.35, 1.35, 1.35);
    bag.position.set(0, 0, 0);

    productGroup.add(bag);
    coffee = bag; // store reference for independent rotation
  }

  /* ---- Steam / smoke rising from spout ---- */
  function buildSteam() {
    const steamGeo = new THREE.SphereGeometry(1, 10, 10);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.0,
        transparent: true,
        depthWrite: false
      });
      const puff = new THREE.Mesh(steamGeo, mat);
      puff.material = mat;
      const seed = Math.random();
      puff.userData = {
        baseY: 1.6, // just above spout top
        speed: 0.4 + Math.random() * 0.5,
        phase: seed * Math.PI * 2,
        amp: 0.22
      };
      puff.position.set(initialPos.x, puff.userData.baseY, initialPos.z);
      puff.scale.setScalar(0.4 + Math.random() * 0.6);
      scene.add(puff);
      steamParticles.push(puff);
    }
  }

  /* ---- Floating coffee beans (3D) ---- */
  function buildFloatingBeans() {
    const beanMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.65, metalness: 0.05 });
    for (let i = 0; i < 12; i++) {
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), beanMat);
      bean.scale.set(1, 1.5, 0.7);
      bean.userData = {
        x: (Math.random() - 0.5) * 14,
        y: Math.random() * 8 - 1,
        z: -Math.random() * 7,
        ry: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.5
      };
      bean.position.set(bean.userData.x, bean.userData.y, bean.userData.z);
      scene.add(bean);
    }
    // store globally for animation
    window.__floatBeans = [];
    scene.traverse(o => { if (o.userData && o.userData.speed && o.geometry && o.geometry.type === 'SphereGeometry' && o.scale.y === 1.5) window.__floatBeans.push(o); });
  }

  /* ---- Dust / glowing particles (gold) ---- */
  function buildParticles() {
    const count = 350;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xF5B041, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    window.__dust = points;
  }

  /* ---- Responsive positioning of the product & steam ---- */
  function applyResponsivePosition() {
    var w = window.innerWidth;
    var centerProduct = w < 900;
    var targetX = centerProduct ? 0 : -1.6;
    // only move if product is being added; else just set base for steam
    initialPos.x = targetX;
    initialPos.y = centerProduct ? -0.2 : -0.4;
    if (productGroup) {
      productGroup.position.x = initialPos.x;
      productGroup.position.y = initialPos.y;
    }
    steamParticles.forEach(function (p) { if (p.userData) { /* positions recomputed each frame */ } });
  }

  /* ---- Interactions ---- */
  function onPointerDown(e) {
    isDragging = true;
    autoRotate = false;
  }
  function onPointerMove(e) {
    if (!isDragging || !coffee) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    coffee.rotation.y += dx * 0.008;
    coffee.rotation.x += dy * 0.004;
  }
  function onPointerUp() { isDragging = false; }

  /* ---- resize ---- */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!clock || !renderer) return;
    var t = clock.getElapsedTime();

    if (autoRotate && coffee) {
      coffee.rotation.y += 0.005;
    }
    // smooth camera zoom target
    if (rotationTarget) {
      camera.position.lerp(rotationTarget, 0.06);
      if (camera.position.distanceTo(rotationTarget) < 0.05) rotationTarget = null;
    }

    // gentle product hover (cinematic float)
    if (coffee) {
      coffee.position.y = Math.sin(t * 0.8) * 0.08;
    }
    // steam follows product hover offset; always rise from spout local position
    var hoverY = coffee ? Math.sin(t * 0.8) * 0.08 : 0;

    // steam animation
    steamParticles.forEach(function (p) {
      if (!p.userData) return;
      var life = (t * p.userData.speed + p.userData.phase) % 3;
      var y = p.userData.baseY + life * 0.9 + hoverY;
      var alpha = Math.sin(life / 3 * Math.PI);
      p.position.y = y;
      p.position.x = initialPos.x + Math.sin(t * 1.5 + p.userData.phase) * p.userData.amp;
      p.position.z = initialPos.z + Math.cos(t * 1.2 + p.userData.phase) * 0.1;
      p.material.opacity = Math.max(0, alpha) * 0.28;
      p.scale.setScalar(0.5 + life * 0.4);
    });

    // floating beans
    if (window.__floatBeans) {
      window.__floatBeans.forEach(function (b) {
        b.rotation.y += 0.008 * (b.userData.speed * 5);
        b.position.y = b.userData.y + Math.sin(t * b.userData.speed + b.userData.ry) * 0.3;
      });
    }

    // dust drift
    if (window.__dust) {
      window.__dust.rotation.y = t * 0.02;
      window.__dust.position.y = Math.sin(t * 0.3) * 0.3;
    }

    renderer.render(scene, camera);
  }
})();
