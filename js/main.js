/* ==========================================================================
   CFI SERVICES — Interactions
   ========================================================================== */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!window.gsap;
  const hero3d = () => window.CFIHero3D;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  document.querySelectorAll('.year').forEach(n => (n.textContent = new Date().getFullYear()));

  if (!hasGsap) {
    // Dégradé sans librairie : on affiche tout immédiatement.
    document.body.classList.remove('is-loading');
    $('#loader')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollTo = target => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else (typeof target === 'number' ? window.scrollTo({ top: target, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
  };

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    if (a.hasAttribute('data-quote')) return; // géré par la popup de devis
    const id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); scrollTo(0); closeMenu(); return; }
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    // le hero est épinglé : on vise le haut réel de la section
    scrollTo(id === '#top' ? 0 : el);
  }));

  /* ---------- Menu mobile ---------- */
  const burger = $('.nav-burger'), menu = $('.mobile-menu');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
  }
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    $('.nav').classList.toggle('on-dark', open || navDark);
    if (lenis) open ? lenis.stop() : lenis.start();
  });

  /* ---------- Découpage du manifeste en mots ---------- */
  const highlight = ['promesse.', 'tenons', 'touche,', 'garde', 'souvient.'];
  $$('.js-words').forEach(p => {
    const words = p.textContent.trim().split(/\s+/);
    p.innerHTML = words.map(w => `<span class="w${highlight.includes(w) ? ' hl' : ''}">${w}</span>`).join(' ');
  });

  /* ---------- Loader : calage CMJN ---------- */
  const hero = $('.hero');
  const title = $('.hero-title');
  const lines = $$('.hero-title .line > span');

  function intro() {
    const tl = gsap.timeline();
    tl.from(lines, { yPercent: 115, duration: 1.3, stagger: 0.09, ease: 'expo.out' }, 0)
      .fromTo(title, { '--mis': 9 }, { '--mis': 0, duration: 1.8, ease: 'expo.out' }, 0.25)
      .from('.kicker, .hero-bottom > *, .hero-foot, .nav', { y: 24, opacity: 0, duration: 1, stagger: 0.07, ease: 'expo.out' }, 0.6);
    return tl;
  }

  function finishLoading() {
    document.body.classList.remove('is-loading');
    lenis && lenis.start();
    ScrollTrigger.refresh();
  }

  const loader = $('#loader');
  if (reduced || !loader) {
    loader && loader.remove();
    finishLoading();
    window.addEventListener('load', () => hero3d()?.skipIntro());
  } else {
    const plates = $$('.plate', loader);
    const count = $('.loader-count', loader);
    const offsets = [[-70, -36, -4], [62, 30, 3], [-24, 54, 2], [0, 0, 0]];
    gsap.set(plates, { x: i => offsets[i][0], y: i => offsets[i][1], rotation: i => offsets[i][2] });
    const c = { v: 0 };
    gsap.timeline({ onComplete() { loader.remove(); } })
      .to(c, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate() { count.textContent = String(Math.round(c.v)).padStart(3, '0'); } }, 0)
      .to(plates.slice(0, 3), { x: 0, y: 0, rotation: 0, duration: 1.7, ease: 'expo.inOut', stagger: 0.06 }, 0.1)
      .to(plates[3], { opacity: 1, duration: 0.45, ease: 'power2.out' }, 1.65)
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, 2.25)
      .add(() => { finishLoading(); intro(); }, 2.45);
  }

  const darkSections = $$('main section.dark, .footer');
  const cursor = { el: $('.cursor'), x: -100, y: -100, cx: -100, cy: -100, dark: false };

  /* ---------- Hero : plan-séquence 3D piloté par le scroll ---------- */
  let navDark = false;
  const nav = $('.nav');
  const setNavDark = v => { navDark = v; nav.classList.toggle('on-dark', v || menu.classList.contains('is-open')); };

  if (!reduced) {
    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: hero, start: 'top top', end: '+=260%', pin: true, scrub: true,
        onUpdate(self) {
          hero3d()?.setProgress(Math.min(1, self.progress / 0.9));
          updateNavTheme();
        },
        onLeave() { hero3d()?.setRunning(false); },
        onEnterBack() { hero3d()?.setRunning(true); }
      }
    });
    heroTl
      .to('.hero-inner', { yPercent: -14, opacity: 0, ease: 'power1.in', duration: 0.22 }, 0)
      .to('.hero-foot', { opacity: 0, duration: 0.12 }, 0)
      .to('.hero-fade', { opacity: 1, duration: 0.1, ease: 'none' }, 0.9);
  }

  /* Nav sombre au-dessus des sections .dark (et du hero noyé d'encre) */
  function updateNavTheme() {
    const overDark = darkSections.some(sec => { const r = sec.getBoundingClientRect(); return r.top <= 40 && r.bottom >= 40; });
    setNavDark(overDark);
  }

  /* Nav : se cache en descendant, revient en remontant */
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      updateNavTheme();
      nav.classList.toggle('is-scrolled', y > 40);
      if (!menu.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    }
  });

  /* ---------- Curseur ---------- */

  if (finePointer && !reduced) {
    document.documentElement.classList.add('has-cursor');
    window.addEventListener('pointermove', e => {
      cursor.x = e.clientX; cursor.y = e.clientY;
      // parallaxe de la caméra 3D
      hero3d()?.setPointer(e.clientX / window.innerWidth * 2 - 1, e.clientY / window.innerHeight * 2 - 1);
      const dark = !!e.target.closest('.dark, .mobile-menu, .qmodal .qm-side');
      cursor.el.classList.toggle('on-dark', dark);
    }, { passive: true });
    $$('a, button, label, .service, .reviews-rail, .qty-range').forEach(el => {
      el.addEventListener('pointerenter', () => cursor.el.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cursor.el.classList.remove('is-hover'));
    });
    gsap.ticker.add(() => {
      cursor.cx += (cursor.x - cursor.cx) * 0.22;
      cursor.cy += (cursor.y - cursor.cy) * 0.22;
      cursor.el.style.transform = `translate3d(${cursor.cx}px, ${cursor.cy}px, 0)`;
    });
  }

  /* Boutons magnétiques */
  if (finePointer && !reduced) {
    $$('.magnetic').forEach(btn => {
      const qx = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
      const qy = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * 0.25);
        qy((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });
  }

  if (reduced) {
    $$('.manifesto-text .w').forEach(w => (w.style.opacity = 1));
    $$('[data-count]').forEach(n => (n.textContent = formatNum(+n.dataset.count, +(n.dataset.decimals || 0))));
  }

  /* ---------- Manifeste : les mots s'encrent ---------- */
  if (!reduced) {
    gsap.to('.manifesto-text .w', {
      opacity: 1, stagger: 0.05, ease: 'none',
      scrollTrigger: { trigger: '.manifesto-text', start: 'top 80%', end: 'bottom 50%', scrub: true }
    });
  }

  /* ---------- Compteurs ---------- */
  function formatNum(v, d) { return v.toFixed(d).replace('.', ','); }
  if (!reduced) {
    $$('[data-count]').forEach(n => {
      const target = +n.dataset.count, d = +(n.dataset.decimals || 0), o = { v: 0 };
      ScrollTrigger.create({
        trigger: n, start: 'top 88%', once: true,
        onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'expo.out', onUpdate: () => (n.textContent = formatNum(o.v, d)) })
      });
    });
  }

  /* ---------- Révélations génériques ---------- */
  if (!reduced) {
    $$('[data-reveal]').forEach(el => {
      gsap.from(el, {
        y: 50, opacity: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  /* ---------- Marquee lié à la vitesse de scroll ---------- */
  const rows = $$('.marquee-row').map(row => {
    const track = $('.marquee-track', row);
    track.innerHTML += track.innerHTML; // boucle sans couture
    return { track, dir: +row.dataset.dir, x: 0, w: 0 };
  });
  const measure = () => rows.forEach(r => (r.w = r.track.scrollWidth / 2));
  measure(); window.addEventListener('resize', measure);
  document.fonts && document.fonts.ready.then(measure);
  let marqueeVisible = false;
  ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: s => (marqueeVisible = s.isActive) });
  if (!reduced) {
    gsap.ticker.add((t, dt) => {
      if (!marqueeVisible) return;
      const v = lenis ? Math.min(Math.abs(lenis.velocity), 60) : 0;
      rows.forEach(r => {
        r.x -= (0.05 + v * 0.02) * dt * r.dir;
        if (r.x <= -r.w) r.x += r.w;
        if (r.x > 0) r.x -= r.w;
        r.track.style.transform = `translate3d(${r.x}px,0,0)`;
      });
    });
  }

  /* ---------- Formats : zoom continu de la carte de visite au 4 × 3 ---------- */
  const fsvg = $('.formats-svg');
  if (fsvg) {
    const F = [
      { w: 85, h: 55, kind: 'Carte de visite', size: '85 × 55', unit: 'mm', desc: 'Papiers de création, dorure, gaufrage, vernis sélectif.' },
      { w: 148, h: 210, kind: 'Flyer A5', size: '148 × 210', unit: 'mm', desc: 'Flyers, invitations, menus, cartes postales.' },
      { w: 297, h: 420, kind: 'Affiche A3', size: '297 × 420', unit: 'mm', desc: 'Affiches, brochures, plans, catalogues.' },
      { w: 841, h: 1189, kind: 'Poster A0', size: '841 × 1189', unit: 'mm', desc: 'Posters, plans techniques, PLV, kakémonos.' },
      { w: 4000, h: 3000, kind: 'Panneau grand format', size: '4 × 3', unit: 'm', desc: 'Bâches, panneaux d’affichage, signalétique grand format.' }
    ];
    const grids = $$('.fgrid', fsvg);
    const kind = $('.fc-kind'), size = $('.fc-size'), desc = $('.fc-desc');
    const stepB = $('.formats-step b'), ticks = $$('.formats-ticks li');
    const ease = gsap.parseEase('power2.inOut');
    let cur = -1, target = 0, pos = 0, active = false;

    function setStep(i) {
      if (i === cur) return;
      cur = i;
      const f = F[i];
      kind.textContent = f.kind;
      size.innerHTML = `${f.size} <small>${f.unit}</small>`;
      desc.textContent = f.desc;
      stepB.textContent = String(i + 1).padStart(2, '0');
      ticks.forEach((t, j) => t.classList.toggle('is-on', j === i));
      if (!reduced) gsap.fromTo([kind, size, desc], { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out', overwrite: true });
    }

    function render(p) {
      const i = Math.min(F.length - 2, Math.floor(p));
      const t = ease(Math.min(1, Math.max(0, (p - i - 0.15) / 0.7)));
      const a = F[i], b = F[i + 1];
      // interpolation géométrique : le zoom paraît constant d'un format à l'autre
      const w = a.w ** (1 - t) * b.w ** t, h = a.h ** (1 - t) * b.h ** t;
      const W = fsvg.clientWidth, H = fsvg.clientHeight;
      if (!W || !H) return;
      const R = W < 900
        ? { x: 0.1 * W, y: 0.34 * H, w: 0.8 * W, h: 0.32 * H }
        : { x: 0.45 * W, y: 0.16 * H, w: 0.48 * W, h: 0.68 * H };
      const s = Math.min(R.w / w, R.h / h);
      const vx = w / 2 - (R.x + R.w / 2) / s, vy = -h / 2 - (R.y + R.h / 2) / s;
      fsvg.setAttribute('viewBox', `${vx} ${vy} ${W / s} ${H / s}`);
      grids.forEach(g => {
        const px = +g.dataset.cell * s;
        const vis = Math.min(1, Math.max(0, (px - 10) / 40)) * Math.min(1, Math.max(0, (W * 1.2 - px) / W));
        g.style.opacity = (vis * 0.14).toFixed(3);
      });
      setStep(Math.min(F.length - 1, Math.round(p)));
    }

    ScrollTrigger.create({
      trigger: '.formats', start: 'top top', end: () => '+=' + window.innerHeight * 4.2,
      pin: '.formats-pin', anticipatePin: 1,
      onUpdate: self => (target = self.progress * (F.length - 1)),
      onToggle: self => (active = self.isActive)
    });
    ScrollTrigger.create({ trigger: '.formats', start: 'top bottom', end: 'bottom top', onToggle: s => (active = s.isActive || active) });
    gsap.ticker.add(() => {
      if (!active && Math.abs(target - pos) < 0.001) return;
      pos += (target - pos) * (reduced ? 1 : 0.12);
      render(pos);
    });
    window.addEventListener('resize', () => render(pos));
    render(0);
  }

  /* ---------- Laboratoire matières : nuancier + lumière rasante ---------- */
  const specimen = $('.specimen');
  if (specimen) {
    const flecks = (n, colors) => Array.from({ length: n }, (_, i) => {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 600, y = (Math.sin(i * 78.233) * 12543.21 % 1 + 1) % 1 * 600;
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${1 + (i % 3)}" ry="${0.6 + (i % 2)}" fill="${colors[i % colors.length]}" transform="rotate(${i * 37} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join('');
    const MATS = [
      { name: 'Papier de création', short: 'Création', sub: 'Vergé · texturé · teinté dans la masse', text: 'La matière qui se remarque avant même d’être lue. Le toucher fait la moitié du message.', uses: 'Cartes de visite · Faire-part · Papeterie',
        base: '#f0e3c6', type: 'fractalNoise', freq: '.045', oct: 4, scale: 0.9, emb: 2.2, spec: 0.25,
        art: '<rect width="600" height="600" fill="#f0e3c6"/>' },
      { name: 'Couché brillant', short: 'Couché', sub: 'Brillant · mat · satiné', text: 'Des couleurs éclatantes et un rendu photo d’une grande finesse, page après page.', uses: 'Brochures · Catalogues · Flyers',
        base: '#f6f6f3', type: 'fractalNoise', freq: '.9', oct: 2, scale: 0.35, emb: 1.2, spec: 1,
        art: '<defs><linearGradient id="gC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00a0dc"/><stop offset=".5" stop-color="#e5007d"/><stop offset="1" stop-color="#ffe100"/></linearGradient></defs><rect width="600" height="600" fill="#f6f6f3"/><rect x="0" y="0" width="600" height="250" fill="url(#gC)"/><rect x="48" y="300" width="300" height="22" fill="#0d0c0e"/><rect x="48" y="338" width="420" height="8" fill="#9a989c"/><rect x="48" y="356" width="390" height="8" fill="#9a989c"/><rect x="48" y="374" width="410" height="8" fill="#9a989c"/>' },
      { name: 'Papier recyclé', short: 'Recyclé', sub: 'Recyclé · naturel · responsable', text: 'Une impression responsable, cohérente avec notre label Imprim’Vert, sans rien céder sur le rendu.', uses: 'Rapports · Courriers · Éditions',
        base: '#e2dacb', type: 'fractalNoise', freq: '.06', oct: 4, scale: 1.1, emb: 2, spec: 0.15,
        art: `<rect width="600" height="600" fill="#e2dacb"/>${flecks(160, ['#8d8377', '#6f6a63', '#b3a58f', '#5b6b7d'])}` },
      { name: 'Kraft', short: 'Kraft', sub: 'Brut · naturel · fort grammage', text: 'Un rendu authentique et chaleureux, pour les marques qui assument le naturel.', uses: 'Étiquettes · Packaging · Cartes',
        base: '#b4875a', type: 'fractalNoise', freq: '.03 .11', oct: 4, scale: 1.5, emb: 1.8, spec: 0.2,
        art: `<rect width="600" height="600" fill="#b0845a"/>${flecks(90, ['#7d5a37', '#c69c70'])}<g transform="rotate(-12 430 470)" fill="none" stroke="#2a1d10" stroke-opacity=".7"><circle cx="460" cy="480" r="78" stroke-width="5"/><circle cx="460" cy="480" r="64" stroke-width="2"/></g><text x="460" y="488" transform="rotate(-12 460 480)" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="17" letter-spacing="2" fill="#2a1d10" fill-opacity=".7">ÉCHANTILLON</text>` },
      { name: 'Adhésif vinyle', short: 'Vinyle', sub: 'Brillant · mat · micro-perforé', text: 'Pour habiller vitrines, murs et véhicules, en intérieur comme en extérieur.', uses: 'Vitrophanie · Stickers · Lettrage',
        base: '#0094d4', type: 'fractalNoise', freq: '.015', oct: 1, scale: 0.8, emb: 0, spec: 1,
        art: '<rect width="600" height="600" fill="#0094d4"/><text x="48" y="150" font-family="Archivo, sans-serif" font-weight="900" font-stretch="125%" font-size="110" letter-spacing="-5" fill="#fff">STICK</text><text x="48" y="250" font-family="Archivo, sans-serif" font-weight="900" font-stretch="125%" font-size="110" letter-spacing="-5" fill="#ffe100">IT.</text>',
        deco: '<span class="deco-peel"></span>' },
      { name: 'Bâche PVC', short: 'Bâche', sub: 'Grand format · œillets · extérieur', text: 'Visible de loin, résistante aux intempéries, livrée prête à poser.', uses: 'Événements · Chantiers · Façades',
        base: '#f2f0ea', type: 'turbulence', freq: '.35 .35', oct: 1, scale: 1.6, emb: 0, spec: 0.35,
        art: '<rect width="600" height="600" fill="#f2f0ea"/><rect x="0" y="210" width="600" height="230" fill="#e5007d"/><text x="300" y="358" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-stretch="125%" font-size="96" letter-spacing="-4" fill="#fff">GRAND</text>',
        deco: '<span class="deco-eyelet" style="left:4%;top:4%"></span><span class="deco-eyelet" style="right:4%;top:4%"></span><span class="deco-eyelet" style="left:46.5%;top:4%"></span>' },
      { name: 'Panneau rigide', short: 'Rigide', sub: 'Aluminium composite · PVC expansé', text: 'La tenue d’un support rigide pour une signalétique durable et premium.', uses: 'Signalétique · Plaques · Panneaux',
        base: '#c3c7cc', type: 'fractalNoise', freq: '.002 .7', oct: 2, scale: 1.4, emb: 0, spec: 0.9,
        art: '<rect width="600" height="600" fill="#c3c7cc"/><rect x="90" y="190" width="420" height="220" rx="4" fill="#0d0c0e"/><text x="130" y="290" font-family="Archivo, sans-serif" font-weight="800" font-size="54" letter-spacing="-2" fill="#f3f0ea">Accueil</text><text x="130" y="352" font-family="JetBrains Mono, monospace" font-size="20" letter-spacing="3" fill="#ffe100">REZ-DE-CHAUSSÉE →</text>',
        deco: '<span class="deco-screw" style="left:6%;top:6%"></span><span class="deco-screw" style="right:6%;top:6%"></span><span class="deco-screw" style="left:6%;bottom:6%"></span><span class="deco-screw" style="right:6%;bottom:6%"></span>' },
      { name: 'Textile', short: 'Textile', sub: 'Sublimation · impression directe', text: 'Vos couleurs portées, avec un rendu durable, précis et éco-responsable.', uses: 'Tenues · Accessoires · Goodies',
        base: '#4a2a68', type: 'turbulence', freq: '.22 .22', oct: 2, scale: 4, emb: 0, spec: 0.2,
        art: '<rect width="600" height="600" fill="#4a2a68"/><text x="300" y="372" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="900" font-stretch="125%" font-size="250" letter-spacing="-12" fill="#ffe100" fill-opacity=".92">CFI</text>',
        deco: '<span class="deco-stitch" style="top:7%"></span><span class="deco-stitch" style="bottom:7%"></span>' }
    ];

    // Textures statiques des lames (même relief, lumière fixe)
    const bladeTex = m => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='400'><filter id='f' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='${m.type}' baseFrequency='${m.freq}' numOctaves='${m.oct}' seed='7'/><feDiffuseLighting surfaceScale='${m.scale}' diffuseConstant='1.25' lighting-color='#fff' result='l'><feDistantLight azimuth='225' elevation='50'/></feDiffuseLighting><feFlood flood-color='${m.base}'/><feComposite in2='l' operator='arithmetic' k1='1'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    };
    const fan = $('.fan');
    fan.innerHTML = MATS.map((m, i) => `
      <button class="blade" role="tab" aria-selected="false" style="--i:${i};--n:${MATS.length};z-index:${i}" data-i="${i}" aria-label="${m.name}">
        <span class="blade-tex"></span>
        <span class="blade-label"><span class="blade-num">${String(i + 1).padStart(2, '0')}</span><span class="mono">${m.short}</span><span class="blade-rivet"></span></span>
      </button>`).join('');
    const blades = $$('.blade', fan);
    blades.forEach((b, i) => ($('.blade-tex', b).style.backgroundImage = bladeTex(MATS[i])));

    const base = $('.m-base', specimen), deco = $('.specimen-deco', specimen);
    const noises = $$('.m-noise', specimen), heights = $$('.m-height', specimen);
    const diffuse = $('.m-diffuse', specimen), spec = $('.m-spec', specimen), specMix = $('.m-specmix', specimen);
    const lights = $$('.m-pl', specimen);
    const info = { sub: $('.mi-sub'), name: $('.mi-name'), text: $('.mi-text'), uses: $('.mi-uses span'), num: $('.sc-num') };
    let current = -1;

    function select(i, animate = true) {
      if (i === current) return;
      current = i;
      const m = MATS[i];
      base.innerHTML = m.art;
      deco.innerHTML = m.deco || '';
      noises.forEach(n => { n.setAttribute('type', m.type); n.setAttribute('baseFrequency', m.freq); n.setAttribute('numOctaves', m.oct); });
      heights.forEach(h => h.setAttribute('k3', m.emb));
      diffuse.setAttribute('surfaceScale', m.scale);
      spec.setAttribute('surfaceScale', m.scale);
      specMix.setAttribute('k2', m.spec * 0.45);
      info.sub.textContent = m.sub; info.name.textContent = m.name; info.text.textContent = m.text; info.uses.textContent = m.uses;
      info.num.textContent = `Échantillon ${String(i + 1).padStart(2, '0')} / ${String(MATS.length).padStart(2, '0')}`;
      blades.forEach((b, j) => { b.classList.toggle('is-active', j === i); b.setAttribute('aria-selected', String(j === i)); });
      if (animate && !reduced) {
        gsap.fromTo(specimen, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'expo.inOut', overwrite: true });
        gsap.fromTo([info.sub, info.name, info.text, info.uses], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out', overwrite: true });
      }
    }
    blades.forEach(b => {
      b.addEventListener('click', () => select(+b.dataset.i));
      b.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (current + d + MATS.length) % MATS.length;
        select(n); blades[n].focus();
      });
    });
    select(0, false);

    // Lumière rasante : suit le pointeur, sinon tourne lentement
    const L = { x: 300, y: 180, tx: 300, ty: 180, hover: false, visible: false };
    specimen.addEventListener('pointermove', e => {
      const r = specimen.getBoundingClientRect();
      L.tx = (e.clientX - r.left) / r.width * 600;
      L.ty = (e.clientY - r.top) / r.height * 600;
      L.hover = true;
    });
    specimen.addEventListener('pointerleave', () => (L.hover = false));
    ScrollTrigger.create({ trigger: specimen, start: 'top bottom', end: 'bottom top', onToggle: s => (L.visible = s.isActive) });
    gsap.ticker.add(() => {
      if (!L.visible) return;
      if (!L.hover && !reduced) {
        const t = performance.now() / 1000;
        L.tx = 300 + Math.cos(t * 0.5) * 230;
        L.ty = 300 + Math.sin(t * 0.5) * 200;
      }
      L.x += (L.tx - L.x) * 0.12;
      L.y += (L.ty - L.y) * 0.12;
      lights.forEach(l => { l.setAttribute('x', L.x.toFixed(1)); l.setAttribute('y', L.y.toFixed(1)); });
    });

    // L'éventail s'ouvre au scroll
    if (!reduced) {
      gsap.fromTo(fan, { '--open': 0 }, { '--open': 1, ease: 'none', scrollTrigger: { trigger: '.matlab', start: 'top 85%', end: 'top 30%', scrub: 0.6 } });
    } else fan.style.setProperty('--open', 1);
  }

  /* ---------- Sélecteur de quantité ---------- */
  const range = $('.qty-range');
  if (range) {
    const out = $('.qty-out'), tech = $('.qty-tech'), text = $('.qty-text');
    const nice = n => n < 10 ? Math.round(n) : n < 100 ? Math.round(n / 5) * 5 : n < 1000 ? Math.round(n / 50) * 50 : n < 10000 ? Math.round(n / 500) * 500 : Math.round(n / 5000) * 5000;
    const modes = [
      { max: 300, tech: 'Impression numérique', text: 'Réactivité, urgences et personnalisation : nous imprimons même à l’unité.' },
      { max: 3000, tech: 'Numérique ou offset', text: 'Selon le support et les délais, nous vous conseillons le procédé le plus juste et le plus rentable.' },
      { max: Infinity, tech: 'Impression offset', text: 'Grandes séries : qualité constante et coût unitaire optimisé, jusqu’au dernier exemplaire.' }
    ];
    let mode = null;
    const update = () => {
      const v = +range.value;
      const n = Math.max(1, nice(10 ** (v / 20)));
      out.innerHTML = `${n.toLocaleString('fr-FR')} <small>exemplaire${n > 1 ? 's' : ''}</small>`;
      range.style.setProperty('--fill', v + '%');
      const m = modes.find(m => n <= m.max);
      if (m !== mode) {
        mode = m; tech.textContent = m.tech; text.textContent = m.text;
        if (!reduced) gsap.fromTo([tech, text], { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out', overwrite: true });
      }
    };
    range.addEventListener('input', update);
    update();
  }

  /* ---------- Services : défilement horizontal ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const track = $('.services-track');
    const cards = $$('.service');
    const counter = $('.services-count b');
    const dist = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.services', start: 'top top', end: () => '+=' + dist(), pin: '.services-pin', scrub: 0.8, invalidateOnRefresh: true,
        onUpdate(self) {
          gsap.set('.services-progress i', { scaleX: self.progress });
          const idx = Math.min(cards.length, Math.max(1, Math.round(self.progress * cards.length + 0.4)));
          counter.textContent = String(idx).padStart(2, '0');
        }
      }
    });
    cards.forEach(card => {
      gsap.fromTo($('img', card), { xPercent: -8 }, {
        xPercent: 8, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
      });
      gsap.from($('.service-num', card), {
        x: 120, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 95%', end: 'left 50%', scrub: true }
      });
    });
    return () => gsap.set(track, { x: 0 });
  });

  /* ---------- Atelier des finitions : récit piloté par le scroll ---------- */
  const atelier = $('.atelier');
  if (atelier) {
    const card = $('.biz-card', atelier), tilt = $('.card-tilt', atelier);
    const film = $('.foil-film', card), sweep = $('.uv-sweep', card);
    const steps = $$('.at-step', atelier), bars = $$('.at-progress i', atelier);
    const countB = $('.at-count b', atelier), cta = $('.at-cta', atelier);
    const st = { foil: 0, emb: 0, uv: 0, edge: 0, show: 0 };
    const bell = v => Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
    let stepNow = -2;

    function paint() {
      card.style.setProperty('--foil', st.foil.toFixed(3));
      card.style.setProperty('--emb', st.emb.toFixed(3));
      card.style.setProperty('--uv', st.uv.toFixed(3));
      card.style.setProperty('--edge', st.edge.toFixed(3));
      // le film doré avance avec le front de dorure, la racle de vernis traverse la carte
      film.style.transform = `translateX(${((st.foil * 0.66 - 0.05) / 0.26 * 100).toFixed(1)}%)`;
      film.style.opacity = bell(st.foil).toFixed(3);
      sweep.style.transform = `translateX(${(st.uv * 330 - 100).toFixed(1)}%)`;
      sweep.style.opacity = bell(st.uv).toFixed(3);
      bars[0].style.setProperty('--p', st.foil); bars[1].style.setProperty('--p', st.emb);
      bars[2].style.setProperty('--p', st.uv); bars[3].style.setProperty('--p', st.edge);
    }
    function setStep(t) {
      // t : temps de la timeline (0,3 de pause puis 1 unité par finition)
      const i = t < 0.3 ? -1 : t >= 4.35 ? 4 : Math.min(3, Math.floor(t - 0.3));
      if (i === stepNow) return;
      stepNow = i;
      steps.forEach((s, j) => s.classList.toggle('is-on', j === Math.min(i, 3)));
      countB.textContent = String(Math.max(0, Math.min(4, i + 1))).padStart(2, '0');
      cta.classList.toggle('is-on', i === 4);
    }

    if (reduced) {
      Object.assign(st, { foil: 1, emb: 1, uv: 1, edge: 1 });
      paint();
      steps.forEach(s => s.classList.add('is-on'));
      cta.classList.add('is-on');
    } else {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate() { paint(); setStep(this.time()); },
        scrollTrigger: { trigger: atelier, start: 'top top', end: () => '+=' + window.innerHeight * 4, pin: '.atelier-pin', scrub: 0.8, anticipatePin: 1 }
      });
      tl.to({}, { duration: 0.3 })
        .to(st, { foil: 1, duration: 1 })
        .to(st, { emb: 1, duration: 1 })
        .to(st, { uv: 1, duration: 1 })
        .to(st, { show: 1, duration: 0.35, ease: 'power2.inOut' })
        .to(st, { edge: 1, duration: 0.3 })
        .to(st, { show: 0, duration: 0.35, ease: 'power2.inOut' })
        .to({}, { duration: 0.5 });
      paint(); setStep(0);
    }

    // Inclinaison : suit le pointeur, sinon léger balancement ; la tranche se montre à l'étape 4
    const tiltState = { tx: 0, ty: 0, x: 0, y: 0, hover: false, visible: false };
    const stageEl = $('.atelier-stage', atelier);
    stageEl.addEventListener('pointermove', e => {
      const r = stageEl.getBoundingClientRect();
      tiltState.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      tiltState.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      tiltState.hover = true;
    });
    stageEl.addEventListener('pointerleave', () => (tiltState.hover = false));
    ScrollTrigger.create({ trigger: atelier, start: 'top bottom', end: 'bottom top', onToggle: s => (tiltState.visible = s.isActive) });
    gsap.ticker.add(() => {
      if (!tiltState.visible) return;
      const t = performance.now() / 1000;
      const gx = tiltState.hover ? tiltState.tx : (reduced ? 0 : Math.sin(t * 0.6) * 0.45);
      const gy = tiltState.hover ? tiltState.ty : (reduced ? 0 : Math.cos(t * 0.45) * 0.3);
      tiltState.x += (gx - tiltState.x) * 0.08;
      tiltState.y += (gy - tiltState.y) * 0.08;
      const sv = st.show;
      tilt.style.transform = `rotateY(${tiltState.x * 22 * (1 - sv) + sv * 64}deg) rotateX(${-tiltState.y * 16 * (1 - sv) + sv * 22}deg) rotateZ(${sv * -6}deg)`;
      card.style.setProperty('--mx', (tiltState.x * 0.5 + 0.5).toFixed(3));
      card.style.setProperty('--my', (tiltState.y * 0.5 + 0.5).toFixed(3));
    });
  }

  /* ---------- Méthode : jauge CMJN ---------- */
  if (!reduced) {
    gsap.to('.process-meter i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.process-steps', start: 'top 70%', end: 'bottom 70%', scrub: true } });
  } else gsap.set('.process-meter i', { scaleX: 1 });

  /* ---------- Avis : glisser pour défiler ---------- */
  const rail = $('.reviews-rail');
  let drag = null;
  rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = { x: e.clientX, s: rail.scrollLeft }; rail.classList.add('is-drag'); });
  window.addEventListener('pointermove', e => { if (drag) rail.scrollLeft = drag.s - (e.clientX - drag.x); });
  window.addEventListener('pointerup', () => { drag = null; rail.classList.remove('is-drag'); });

  /* ---------- Popup de demande de devis ---------- */
  const modal = $('#quote-modal'), panel = $('.qm-panel', modal);
  const modalForm = $('.quote-modal', modal), modalDone = $('.qm-done', modal);
  let lastFocus = null;
  function openQuote() {
    lastFocus = document.activeElement;
    closeMenu();
    modalForm.hidden = false; modalDone.hidden = true;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qm-lock');
    lenis && lenis.stop();
    setTimeout(() => $('input[name="name"]', modal).focus({ preventScroll: true }), 450);
  }
  function closeQuote() {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qm-lock');
    lenis && lenis.start();
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  $$('[data-quote]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openQuote(); }));
  $$('[data-close]', modal).forEach(el => el.addEventListener('click', closeQuote));
  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeQuote(); return; }
    if (e.key !== 'Tab') return;
    // garde le focus dans la popup
    const items = $$('button, a[href], input, textarea', panel).filter(el => !el.closest('[hidden]') && el.offsetParent !== null);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Formulaires de devis (section contact + popup) ---------- */
  $$('.quote').forEach(form => {
    const status = $('.quote-status', form);
    form.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach(f => {
        const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
        f.closest('.field').classList.toggle('is-error', bad);
        if (bad) ok = false;
      });
      if (!ok) { status.textContent = 'Merci de compléter les champs indiqués.'; return; }
      const d = new FormData(form);
      const types = d.getAll('type').join(', ') || 'Non précisé';
      const body = [
        `Projet : ${types}`, `Nom : ${d.get('name')}`, `Société : ${d.get('company') || '—'}`,
        `E-mail : ${d.get('email')}`, `Téléphone : ${d.get('phone') || '—'}`, '', d.get('message')
      ].join('\n');
      // TODO : brancher sur un service d'envoi (Formspree, backend…) ; en attendant, ouverture du client mail.
      window.location.href = `mailto:gladys.lemoine@cfi-services.fr?subject=${encodeURIComponent('Demande de devis — ' + types)}&body=${encodeURIComponent(body)}`;
      if (form === modalForm) {
        form.hidden = true; modalDone.hidden = false;
        if (!reduced) gsap.from(modalDone.children, { y: 20, opacity: 0, stagger: 0.07, duration: 0.7, ease: 'expo.out' });
        form.reset(); status.textContent = '';
      } else {
        status.textContent = 'Votre messagerie s’ouvre avec la demande pré-remplie. Merci !';
      }
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
