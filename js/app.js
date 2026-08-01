/* ============================================================
   DEMONZ COFFEE — Supplementary Animations (Typed, Parallax)
   v1 (Milestone 1) — synchronized with HTML latest markup
   ============================================================ */
(function () {
  'use strict';

  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ================= TYPED.JS — hero subtitle typing ================= */
  if (window.Typed) {
    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) {
      // Keep static lead text, append a typed italic phrase below it
      const typedWrap = document.createElement('span');
      typedWrap.className = 'typed-line';
      heroSub.appendChild(typedWrap);
      new Typed(typedWrap, {
        strings: ['100% Robusta Lampung.', 'Natural Process.', 'Medium Roast.', 'Cita rasa khas Indonesia.'],
        typeSpeed: 45,
        backSpeed: 25,
        loop: true,
        showCursor: true
      });
    }
  }

  /* ================= MOUSE PARALLAX on Hero ================= */
  if (!isTouch) {
    const hero = document.getElementById('home');
    if (hero) {
      hero.addEventListener('mousemove', function (e) {
        const cx = (e.clientX / window.innerWidth - 0.5);
        const cy = (e.clientY / window.innerHeight - 0.5);
        const bg = document.querySelector('.hero-bg');
        if (bg) bg.style.transform = 'translate(' + (cx * 12) + 'px,' + (cy * 8) + 'px) scale(1.08)';
        // gentle parallax on floating beans container (transform-safe, no per-bean conflict)
        const beans = document.querySelector('.float-beans');
        if (beans) {
          beans.style.transform = 'translate(' + (cx * 22) + 'px,' + (cy * 16) + 'px)';
        }
      });
    }
  }
})();
