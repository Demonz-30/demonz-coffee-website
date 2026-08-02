/* ============================================================
   DEMONZ COFFEE — Main Interactions & Premium Animations
   v1 (Milestone 1) — synchronized with HTML/CSS latest markup
   ============================================================ */
(function () {
  'use strict';

  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ================= LOADING SCREEN (premium progress + fade) ================= */
  window.addEventListener('load', function () {
    const loader = document.getElementById('loader');
    const loaderCount = document.getElementById('loaderCount');
    const mainEl = document.querySelector('main');
    if (!loader) return;
    document.body.style.overflow = 'hidden';
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // quick lightweight progress read-out synced to the CSS bar (~1.8s)
    const dur = 1800;
    const t0 = performance.now();
    (function tick() {
      const p = Math.min(100, Math.round(((performance.now() - t0) / dur) * 100));
      if (loaderCount) loaderCount.textContent = p + '%';
      if (p < 100) requestAnimationFrame(tick);
    })();
    // reveal main content the moment the loader fades (no dead/blank gap)
    if (mainEl) mainEl.classList.add('is-visible');
    setTimeout(function () {
      loader.classList.add('hidden');
      document.body.style.overflow = '';
    }, reduced ? 400 : 1800);
  });

  /* ================= NAVBAR SCROLL + HIDE/SHOW + PROGRESS BAR ================= */
  const navbar = document.getElementById('siteNav');
  const backTop = document.getElementById('backTop');
  const progressBar = document.getElementById('scrollProgress');
  const progressSpan = progressBar ? progressBar.querySelector('span') : null;
  let lastScrollY = window.scrollY;
  const onScrollNav = function () {
    const sc = window.scrollY;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;

    if (navbar) {
      if (sc > 60) navbar.classList.add('scrolled'); else navbar.classList.remove('scrolled');
      // hide navbar when scrolling down past the hero, show again when scrolling up
      if (sc > 200 && sc > lastScrollY) navbar.classList.add('nav-hidden');
      else navbar.classList.remove('nav-hidden');
    }
    if (backTop) {
      if (sc > 400) backTop.classList.add('show'); else backTop.classList.remove('show');
    }
    // scroll progress bar (debounced width write is cheap; passive rAF would be ideal)
    if (progressSpan && max > 0) {
      progressSpan.style.width = ((sc / max) * 100) + '%';
    }
    lastScrollY = sc;
    highlightNav();
  };
  // lightweight scroll handler (passive) + a rAF throttle to avoid excessive layout writes
  let scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(function () {
        onScrollNav();
        scrollTicking = false;
      });
    }
  }, { passive: true });
  onScrollNav();

  /* ================= ACTIVE NAV LINK ================= */
  function highlightNav() {
    const sections = ['home', 'about', 'produk', 'galeri', 'testimoni', 'kontak'];
    let current = 'home';
    sections.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.4) current = id;
      }
    });
    document.querySelectorAll('.nav-link').forEach(function (l) {
      const href = l.getAttribute('href');
      if (href === '#' + current) l.classList.add('active'); else l.classList.remove('active');
    });
  }

  /* ================= MOBILE MENU ================= */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  function toggleMenu(forceClose) {
    if (!hamburger || !mobileMenu) return;
    const willOpen = forceClose ? false : !mobileMenu.classList.contains('open-menu');
    mobileMenu.classList.toggle('open-menu', willOpen);
    mobileMenu.style.transform = willOpen ? 'translateY(0)' : 'translateY(-100%)';
    hamburger.classList.toggle('open', willOpen);
    hamburger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    mobileMenu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
  }
  window.toggleMenu = toggleMenu;
  if (hamburger) hamburger.addEventListener('click', function () { toggleMenu(); });
  // close mobile menu when a link inside is tapped
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { toggleMenu(true); });
    });
  }

  /* ================= CURSOR ================= */
  if (!isTouch) {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    let mx = 0, my = 0, rx = 0, ry = 0;
    if (dot && ring) {
      document.addEventListener('mousemove', function (e) {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx + 'px'; dot.style.top = my + 'px';
      });
      (function loopCursor() {
        rx += (mx - rx) * 0.18;
        ry += (my - ry) * 0.18;
        ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
        requestAnimationFrame(loopCursor);
      })();
      document.querySelectorAll('a, button, .product-card, .g-item, .ctrl-chip').forEach(function (el) {
        el.addEventListener('mouseenter', function () { ring.classList.add('hovering'); });
        el.addEventListener('mouseleave', function () { ring.classList.remove('hovering'); });
      });
    }
  }

  /* ================= GSAP: SMOOTH SCROLL + REVEAL ================= */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero title text reveal (POWER IN / EVERY SIP)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      const lines = heroTitle.querySelectorAll(':scope > .hero-line');
      gsap.from(lines, {
        opacity: 0, y: 70, rotateX: 25, duration: 1.1,
        stagger: 0.18, delay: 1.9, ease: 'power4.out'
      });
    }

    // Hero kicker + subtitle + actions
    gsap.from('.hero-kicker', { opacity: 0, y: -30, duration: 0.9, delay: 2.0 });
    gsap.from('.hero-sub', { opacity: 0, y: 30, duration: 0.9, delay: 2.1 });
    gsap.from('#home .hero-actions [data-magnetic]', {
      opacity: 0, y: 30, duration: 0.8, delay: 2.3, stagger: 0.15
    });
    gsap.from('.hero-3d-controls', { opacity: 0, y: 30, duration: 0.9, delay: 2.5 });

    // Premium product showcase entrance (PNG stage)
    gsap.from('.premium-product', {
      opacity: 0, y: 60, scale: 0.9, duration: 1.3, delay: 2.3, ease: 'power3.out'
    });
    // Glass stat strip reveal
    gsap.from('#home .hero-stats', {
      opacity: 0, y: 26, duration: 0.9, delay: 2.6, ease: 'power2.out'
    });
    // float-beans fade in
    gsap.from('#home .float-beans', { opacity: 0, duration: 1.2, delay: 2.8 });

    // Generic reveal for [data-reveal] via ScrollTrigger (staggered per group)
    const revealables = gsap.utils.toArray('[data-reveal]');
    revealables.forEach(function (el) {
      gsap.from(el, {
        opacity: 0, y: 40, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // Owner visual: subtle 3D tilt reveal on scroll (data-tilt-reveal)
    gsap.utils.toArray('[data-tilt-reveal]').forEach(function (el) {
      gsap.from(el, {
        opacity: 0, y: 50, rotateY: 8, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // Staggered product-card entrance (premium, within each product grid)
    document.querySelectorAll('.product-grid').forEach(function (grid) {
      const cards = grid.querySelectorAll('.product-card');
      if (cards.length) {
        gsap.from(cards, {
          opacity: 0, y: 40, duration: 0.8, stagger: 0.09, ease: 'power3.out',
          scrollTrigger: { trigger: grid, start: 'top 82%' }
        });
      }
    });

    // Animated number counters (scroll-triggered). Runs regardless of GSAP too.
    runCounters();
  }

  function runCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const render = function (el, val) {
      const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      const prefix = el.getAttribute('data-prefix') || '';
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = prefix + val.toFixed(decimals) + suffix;
    };
    els.forEach(function (el) {
      const target = parseFloat(el.getAttribute('data-count'));
      if (reduced || isNaN(target)) { render(el, target); return; }
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const start = performance.now();
          const dur = 1500;
          (function step() {
            const t = Math.min(1, (performance.now() - start) / dur);
            const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
            render(el, target * ease);
            if (t < 1) requestAnimationFrame(step);
          })();
        });
      }, { threshold: 0.5 });
      io.observe(el);
    });
  }

  /* ================= LENIS SMOOTH SCROLL ================= */
  function scrollToId(id) {
    const target = document.querySelector(id);
    if (!target) return;
    if (window.Lenis && !isTouch) {
      window.__lenis.scrollTo(target, { offset: -70 });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
  if (window.Lenis && !isTouch) {
    const lenis = new Lenis({
      lerp: 0.12,
      wheelMultiplier: 1.2,
      touchMultiplier: 1.2,
      smoothWheel: true
    });
    window.__lenis = lenis;
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }
  window.scrollTopTop = function () {
    if (window.Lenis && window.__lenis && !isTouch) window.__lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // delegate all in-page anchor clicks
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    e.preventDefault();
    scrollToId(id);
  });

  /* ================= RIPPLE EFFECT ================= */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-primary, .btn-outline, .ctrl-chip, .btn-detail, .btn-order, .order-card');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 600);
  });

  /* ================= MAGNETIC BUTTONS ================= */
  if (!isTouch) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + (x * 0.22) + 'px,' + (y * 0.28) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ================= VANILLA TILT (cards) ================= */
  if (window.VanillaTilt && !isTouch) {
    VanillaTilt.init(document.querySelectorAll('[data-tilt]'), {
      max: 8, speed: 400, glare: false, 'max-glare': 0.2, reverse: true
    });
  }

  /* ================= PRODUCT FILTER + SEARCH ================= */
  const productFilter = document.getElementById('productFilter');
  function applyProductFilter() {
    const activeBtn = productFilter ? productFilter.querySelector('.fi.is-active') : null;
    const cat = activeBtn ? activeBtn.getAttribute('data-cat') : 'all';
    const q = (document.getElementById('productSearch').value || '').toLowerCase().trim();
    document.querySelectorAll('.product-card').forEach(function (card) {
      const cardCat = card.getAttribute('data-cat');
      const name = (card.getAttribute('data-name') || '').toLowerCase();
      const catOk = cat === 'all' || cardCat === cat;
      const qOk = q === '' || name.indexOf(q) !== -1;
      const show = catOk && qOk;
      card.style.display = show ? '' : 'none';
      if (show) card.classList.add('fade-card');
    });
  }
  if (productFilter) {
    productFilter.querySelectorAll('.fi').forEach(function (btn) {
      btn.addEventListener('click', function () {
        productFilter.querySelectorAll('.fi').forEach(function (b) { b.classList.remove('is-active'); });
        this.classList.add('is-active');
        applyProductFilter();
      });
    });
  }
  const productSearch = document.getElementById('productSearch');
  if (productSearch) {
    productSearch.addEventListener('input', applyProductFilter);
  }

  /* ================= GALLERY DATA + MASONRY ================= */
  const galleryItems = [
    { img: 'assets/products/web/products1.webp', cat: 'proses', label: 'Sangrai & Kerja Pabrik' },
    { img: 'assets/products/web/products2.webp', cat: 'produk', label: 'Robusta Lampung Premium' },
    { img: 'assets/products/web/products3.webp', cat: 'branding', label: 'Suasana & Branding' },
    { img: 'assets/products/web/products4.webp', cat: 'produk', label: 'Cangkir & Aroma' },
    { img: 'assets/products/web/products8.webp', cat: 'packaging', label: 'Packing Premium' },
    { img: 'assets/products/web/products5.webp', cat: 'proses', label: 'Biji Robusta Natural' },
    { img: 'assets/products/web/products6.webp', cat: 'packaging', label: 'Kemasan Fresh Seal' },
    { img: 'assets/products/web/products7.webp', cat: 'branding', label: 'Identity & Kualitas' },
    { img: 'assets/logo/web/logo2.webp', cat: 'branding', label: 'Logo Demonz Coffee' },
    { img: 'assets/products/web/products9.webp', cat: 'produk', label: 'Biji Petik Pilihan' }
  ];

  const masonry = document.getElementById('galleryMasonry');
  function buildGallery() {
    if (!masonry) return;
    masonry.innerHTML = '';
    const heights = [1.2, 0.8, 1.0, 1.4, 0.9, 1.1, 1.3, 0.85];
    galleryItems.forEach(function (item, i) {
      const el = document.createElement('div');
      el.className = 'g-item';
      el.setAttribute('data-filt', item.cat);
      const h = heights[i % heights.length];
      el.style.height = (220 * h) + 'px';
      el.innerHTML =
        '<img src="' + item.img + '" alt="' + item.label + '" loading="lazy" style="height:100%;object-fit:cover" />' +
        '<span class="g-tag">' + item.cat.toUpperCase() + '</span>' +
        '<div class="g-light"></div>' +
        '<div class="g-overlay"><p>' + item.label + '</p></div>';
      el.addEventListener('click', function () { openLightbox(item.img, item.label); });
      masonry.appendChild(el);
    });
  }
  buildGallery();

  /* ================= GALLERY FILTER ================= */
  const galleryFilter = document.getElementById('galleryFilter');
  if (galleryFilter) {
    galleryFilter.querySelectorAll('.gi').forEach(function (btn) {
      btn.addEventListener('click', function () {
        galleryFilter.querySelectorAll('.gi').forEach(function (b) { b.classList.remove('is-active'); });
        this.classList.add('is-active');
        const f = this.getAttribute('data-filt');
        document.querySelectorAll('.g-item').forEach(function (it) {
          const show = f === 'all' || it.getAttribute('data-filt') === f;
          it.classList.toggle('hide', !show);
        });
      });
    });
  }

  /* ================= LIGHTBOX ================= */
  function openLightbox(src, label) {
    const m = document.getElementById('lightboxModal');
    if (!m) return;
    const img = document.getElementById('lightboxImg');
    if (img) { img.src = src; img.alt = label || 'Pratinjau gambar'; }
    m.classList.add('open');
  }
  function closeLightbox() {
    const m = document.getElementById('lightboxModal');
    if (m) m.classList.remove('open');
  }
  window.closeLightbox = closeLightbox;
  // product zoom buttons
  document.querySelectorAll('.pc-zoom').forEach(function (z) {
    z.addEventListener('click', function (e) {
      e.stopPropagation();
      openLightbox(this.getAttribute('data-lightbox'), 'Produk Demonz Coffee');
    });
  });

  /* ================= MODALS (order + detail) ================= */
  const orderModal = document.getElementById('orderModal');
  const detailModal = document.getElementById('detailModal');

  function openModal(m) { if (m) m.classList.add('open'); }
  function closeModal(m) { if (m) m.classList.remove('open'); }
  function closeAllModals() { closeModal(orderModal); closeModal(detailModal); closeLightbox(); }

  window.openOrderModal = function () { closeModal(detailModal); openModal(orderModal); };
  window.closeOrderModal = function () { closeModal(orderModal); };
  window.openDetail = function () { openModal(detailModal); };
  window.closeDetail = function () { closeModal(detailModal); };

  // data-order buttons -> open order modal
  document.querySelectorAll('[data-order]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.preventDefault(); window.openOrderModal(); });
  });
  // data-order-inner (inside detail modal) -> switch to order modal
  document.querySelectorAll('[data-order-inner]').forEach(function (btn) {
    btn.addEventListener('click', function () { window.openOrderModal(); });
  });
  // data-detail buttons -> fill detail title + open detail modal
  document.querySelectorAll('[data-detail]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const name = this.getAttribute('data-detail') || 'Produk';
      const t = document.getElementById('detailTitle');
      if (t) t.textContent = name;
      window.openDetail();
    });
  });
  // generic data-close for order/detail modal overlays + close buttons
  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', function () { closeModal(orderModal); closeModal(detailModal); });
  });
  // lightbox close
  document.querySelectorAll('[data-close-lightbox]').forEach(function (el) {
    el.addEventListener('click', closeLightbox);
  });

  // Esc closes everything + closes mobile menu
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAllModals(); toggleMenu(true); }
  });

  /* ================= SWIPER TESTIMONI ================= */
  if (window.Swiper) {
    const testimonialEl = document.querySelector('.testi-swiper');
    if (testimonialEl) {
      new Swiper(testimonialEl, {
        slidesPerView: 1,
        spaceBetween: 30,
        loop: true,
        autoplay: { delay: 4500, disableOnInteraction: false },
        pagination: { el: '.testi-swiper .swiper-pagination', clickable: true },
        breakpoints: {
          768: { slidesPerView: 2 }
        }
      });
    }
  }

  /* ================= STAR RATING RENDER (data-score) =================
   * Renders Lucide-style SVG stars (no emoji / unicode glyphs).
   * Filled = gold fill, empty = outline, half = left-half gradient fill.
   */
  function buildStarSvg(fill) { // fill: 'full' | 'half' | 'empty'
    const uid = Math.random().toString(36).slice(2, 8);
    const starPath = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
    let defs = '';
    if (fill === 'half') {
      defs = '<defs><linearGradient id="hs' + uid + '" x1="0" x2="1" y1="0" y2="0">' +
             '<stop offset="50%" stop-color="var(--gold)"/><stop offset="50%" stop-color="transparent"/>' +
             '</linearGradient></defs>';
    }
    const fillAttr = fill === 'full' ? 'fill="var(--gold)"' :
                     (fill === 'half' ? 'fill="url(#hs' + uid + ')"' : 'fill="none"');
    const stroke = ' stroke="var(--gold)" stroke-width="1.4" stroke-linejoin="round"';
    return '<svg class="star" viewBox="0 0 24 24" aria-hidden="true">' + defs +
           '<path d="' + starPath + '"' + fillAttr + stroke + '/></svg>';
  }
  document.querySelectorAll('.stars[data-score]').forEach(function (el) {
    const score = parseFloat(el.getAttribute('data-score')) || 0;
    const full = Math.floor(score);
    const half = (score - full) >= 0.3 && (score - full) < 0.8;
    const rounded = half ? full + 0.5 : Math.round(score);
    let html = '';
    for (let i = 0; i < 5; i++) {
      if (i < Math.floor(rounded)) html += buildStarSvg('full');
      else if (i === Math.floor(rounded) && rounded % 1 !== 0) html += buildStarSvg('half');
      else html += buildStarSvg('empty');
    }
    html += ' <b>' + score + '</b>';
    el.innerHTML = html;
  });

  /* ================= CONTACT FORM (demo) ================= */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      if (msg) {
        msg.textContent = 'Terima kasih! Pesan Anda telah terkirim. Kami akan segera menghubungi Anda.';
        msg.style.color = '#25D366';
      }
      contactForm.reset();
    });
  }

  /* ================= PRIVACY / TERMS (placeholder links) ================= */
  document.querySelectorAll('[data-privacy], [data-terms]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); window.openOrderModal(); });
  });

  /* ================= BACK TO TOP ================= */
  if (backTop) backTop.addEventListener('click', window.scrollTopTop);

  /* ================= 3D HERO CONTROLS WIRING ================= */
  const rotateBtn = document.querySelector('[data-rotate]');
  const zoomBtn = document.querySelector('[data-zoom]');
  const resetBtn = document.querySelector('[data-reset]');
  const hasThree = function () { return typeof window.setAutoRotate === 'function'; };
  // mark rotate state visually
  function reflectRotateState() {
    if (rotateBtn && hasThree()) {
      rotateBtn.classList.toggle('is-on', !!document.body.getAttribute('data-autorotate'));
    }
  }
  if (rotateBtn) {
    rotateBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (hasThree()) {
        const wasOn = document.body.getAttribute('data-autorotate') === '1';
        window.setAutoRotate(!wasOn);
        document.body.setAttribute('data-autorotate', wasOn ? '0' : '1');
        reflectRotateState();
      }
    });
  }
  if (zoomBtn) {
    zoomBtn.addEventListener('click', function (e) { e.preventDefault(); if (hasThree()) window.setZoom(); });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (hasThree()) window.resetView();
      document.body.setAttribute('data-autorotate', '1');
      reflectRotateState();
    });
  }
})();
