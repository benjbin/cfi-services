/* Modèle de l'imprimante grand format.
   Contrat : buildPrinter(THREE, util, { M, inkMat }) → { printer, carriage, update(t, hx), PLATEN_Y, MEDIA_W }
   - printer : Group racine (le média y est ajouté par l'orchestrateur)
   - carriage : Group du chariot ; update() le place en x = hx
   - PLATEN_Y : hauteur du dessus de la platine (le média passe à PLATEN_Y + 0.001, tête au-dessus en z ≈ 0)
   - MEDIA_W : largeur du média (m)
   Repères : x = largeur machine (±1.6 pour le média), y = haut, z = avant (+). Le sol est à y = 0.
   Les pièces statiques sont fusionnées par matériau (une poignée de draw calls) ; vis et maillons en InstancedMesh. */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function buildPrinter(THREE, util, { M, inkMat }) {
  const { canvasTex, RoundedBoxGeometry } = util;
  const PLATEN_Y = 1.08;
  const MEDIA_W = 3.2;
  const PI = Math.PI;
  const printer = new THREE.Group();
  const carriage = new THREE.Group();

  /* ---------- Outils de géométrie ---------- */
  const rbox = (w, h, d, r = 0, seg = 1) => r > 0 ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d);
  const cylG = (r, len, axis = 'y', seg = 24, r2 = r) => {
    const g = new THREE.CylinderGeometry(r, r2, len, seg);
    if (axis === 'x') g.rotateZ(PI / 2);
    if (axis === 'z') g.rotateX(PI / 2);
    return g;
  };
  // Profil (z, y) extrudé le long de x, de x0 à x1 ; le chanfrein reste à l'intérieur du profil
  const prism = (pts, x0, x1, b = 0.004, bs = 2) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), {
      depth: Math.max(0.0005, x1 - x0 - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: bs, curveSegments: 4
    });
    g.rotateY(-PI / 2); g.translate(x1 - b, 0, 0);
    return g;
  };
  const frame = (x, y, z, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

  // Lot de géométries fusionnées par matériau
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const KEEP = ['position', 'normal', 'uv'];
  function batch(target) {
    const lists = new Map();
    const B = {
      add(geo, mat, x = 0, y = 0, z = 0, o = {}) {
        if (o.q) _q.copy(o.q); else _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0));
        _m.compose(_p.set(x, y, z), _q, _s);
        if (o.frame) _m.premultiply(o.frame);
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        g.applyMatrix4(_m);
        for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
        const key = mat.uuid + (o.shadow ? '+s' : '');
        if (!lists.has(key)) lists.set(key, { mat, shadow: !!o.shadow, geos: [] });
        lists.get(key).geos.push(g);
        return B;
      },
      box(w, h, d, r, mat, x, y, z, o = {}) { return B.add(rbox(w, h, d, r, o.seg), mat, x, y, z, o); },
      cyl(r, len, mat, x, y, z, axis = 'y', seg = 24, o = {}) { return B.add(cylG(r, len, axis, seg, o.r2), mat, x, y, z, o); },
      flush() {
        for (const { mat, shadow, geos } of lists.values()) {
          const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
          mesh.castShadow = shadow; mesh.receiveShadow = true;
          target.add(mesh);
        }
        lists.clear();
      }
    };
    return B;
  }
  const S = batch(printer), C = batch(carriage);
  const SH = { shadow: true };

  /* ---------- Matériaux locaux ---------- */
  const grey = M.white.clone(); grey.color.set(0xa9adb4);
  const satin = new THREE.MeshStandardMaterial({ color: 0xa4a8ae, metalness: 1, roughness: 0.34 });
  const screwM = new THREE.MeshStandardMaterial({ color: 0x83868c, metalness: 1, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.7, roughness: 0.4 });
  const keyM = new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.62 });
  const blueKey = new THREE.MeshStandardMaterial({ color: 0x2a64c8, roughness: 0.4 });
  const glossBlack = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.12, metalness: 0.2 });
  const acrylic = new THREE.MeshPhysicalMaterial({
    color: 0x2b2833, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
    depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6
  });
  const ledG = M.led.clone(); ledG.emissiveIntensity = 2.2;
  const ledO = M.led.clone(); ledO.color.set(0x2a1500); ledO.emissive.set(0xff9a1f); ledO.emissiveIntensity = 2.2;
  const ledB = M.led.clone(); ledB.color.set(0x0a1230); ledB.emissive.set(0x8a5cff); ledB.emissiveIntensity = 2.4;
  const ledData = ledO.clone();
  const INKS = [0x00a0dc, 0xe5007d, 0xffe100, 0x141416, 0xf2f2f0, 0xcfd6db];
  const INK_N = ['C', 'M', 'Y', 'K', 'W', 'V'];
  const inkM = INKS.map(c => inkMat(c));
  const hex = c => '#' + c.toString(16).padStart(6, '0');

  /* ---------- Atlas d'étiquettes (une seule texture pour tous les marquages) ---------- */
  const AW = 2048, AH = 512, R = {};
  const region = (k, x, y, w, h, draw) => { R[k] = { x, y, w, h, draw }; };
  const MONO = '"JetBrains Mono", monospace', SANS = 'Archivo, sans-serif';
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const tri = (g, w, h, draw) => {
    g.fillStyle = '#111'; g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 4, h - 8); g.lineTo(4, h - 8); g.closePath(); g.fill();
    g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(w - 16, h - 15); g.lineTo(16, h - 15); g.closePath(); g.fill();
    g.fillStyle = '#111'; draw();
  };
  region('logo', 0, 0, 512, 256, g => {
    g.fillStyle = '#6c4092'; g.beginPath(); g.arc(70, 128, 52, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `900 54px ${SANS}`; g.fillText('cfi', 34, 146);
    g.fillStyle = '#1a1b1e'; g.font = `900 92px ${SANS}`; g.fillText('CFI', 150, 156);
    g.font = `500 26px ${MONO}`; g.fillText('S E R V I C E S', 154, 196);
  });
  region('carFront', 512, 0, 512, 256, (g, w, h) => {
    g.fillStyle = '#1b1c20'; rr(g, 0, 0, w, h, 26); g.fill();
    g.strokeStyle = '#34363c'; g.lineWidth = 4; rr(g, 6, 6, w - 12, h - 12, 22); g.stroke();
    g.fillStyle = '#6c4092'; g.beginPath(); g.arc(70, 92, 38, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `900 40px ${SANS}`; g.fillText('cfi', 43, 105);
    g.fillStyle = '#e9e9ec'; g.font = `900 64px ${SANS}`; g.fillText('UV-3200', 130, 116);
    g.fillStyle = '#8d9098'; g.font = `500 24px ${MONO}`; g.fillText('6 TÊTES · 1440 DPI · LED UV', 40, 186);
    ['#00a0dc', '#e5007d', '#ffe100', '#111', '#eee', '#cfd6db'].forEach((c, i) => { g.fillStyle = c; g.fillRect(40 + i * 34, 206, 26, 10); });
  });
  // Pupitre : 0.32 × 0.20 m → 512 × 320 px
  const PX = lx => (lx / 0.32 + 0.5) * 512, PY = ly => (0.5 - ly / 0.2) * 320;
  region('panel', 1024, 0, 512, 320, g => {
    g.fillStyle = '#c9ccd2'; g.font = `600 15px ${MONO}`; g.fillText('CFI · UV-3200', PX(-0.15), PY(0.08));
    g.fillStyle = '#6c4092'; g.fillRect(PX(0.12), PY(0.087), 26, 6);
    g.strokeStyle = '#4a4d55'; g.lineWidth = 2; rr(g, PX(-0.142), PY(0.07), PX(0.002) - PX(-0.142), PY(-0.02) - PY(0.07), 6); g.stroke();
    g.fillStyle = '#9da1a9'; g.font = `500 11px ${MONO}`; g.textAlign = 'center';
    ['F1', 'F2', 'F3', 'F4'].forEach((s, i) => g.fillText(s, PX(-0.115 + i * 0.03), PY(-0.063)));
    [['MENU', 0.069], ['ENTRÉE', 0.034], ['ANNUL.', -0.001]].forEach(([s, y]) => g.fillText(s, PX(0.132), PY(y)));
    [['PRÊT', 0], ['DATA', 1], ['UV', 2]].forEach(([s, i]) => g.fillText(s, PX(0.02 + i * 0.028), PY(-0.085)));
    g.strokeStyle = '#9da1a9'; g.lineWidth = 2; g.beginPath(); g.arc(PX(0.132), PY(-0.068), 5, -1.1, 4.25); g.stroke();
    g.beginPath(); g.moveTo(PX(0.132), PY(-0.068) - 7); g.lineTo(PX(0.132), PY(-0.068) - 1); g.stroke();
    g.fillStyle = '#9da1a9'; [[0, 0.046, 0], [0, -0.006, PI], [-0.026, 0.02, -PI / 2], [0.026, 0.02, PI / 2]].forEach(([dx, y, a]) => {
      g.save(); g.translate(PX(0.065 + dx), PY(y)); g.rotate(a); g.beginPath(); g.moveTo(0, -4); g.lineTo(4, 3); g.lineTo(-4, 3); g.fill(); g.restore();
    });
  });
  region('serial', 1536, 0, 256, 128, (g, w, h) => {
    g.fillStyle = '#c8ccd2'; rr(g, 0, 0, w, h, 10); g.fill();
    g.fillStyle = '#1b1c20'; g.font = `800 20px ${SANS}`; g.fillText('CFI SERVICES', 14, 28);
    g.font = `500 12px ${MONO}`;
    ['Modèle : UV-3200 LED', '230 V ~ 50/60 Hz · 16 A', 'N° série : CFI-26-0417', 'Fabriqué pour CFI · CE'].forEach((s, i) => g.fillText(s, 14, 50 + i * 16));
    for (let i = 0; i < 40; i++) g.fillRect(170 + i * 2, 92, (i * 7) % 3 ? 1 : 2, 24);
  });
  region('warn', 1792, 0, 128, 128, (g, w, h) => tri(g, w, h, () => { g.font = `900 64px ${SANS}`; g.textAlign = 'center'; g.fillText('!', w / 2, h - 28); }));
  region('hot', 1920, 0, 128, 128, (g, w, h) => tri(g, w, h, () => {
    g.lineWidth = 6; g.strokeStyle = '#111';
    for (let i = -1; i <= 1; i++) { g.beginPath(); for (let y = 0; y <= 46; y += 2) g.lineTo(w / 2 + i * 16 + Math.sin(y / 7) * 5, h - 26 - y); g.stroke(); }
  }));
  region('holes', 1536, 128, 256, 256, (g, w, h) => {
    g.fillStyle = '#0c0c0f';
    for (let y = 12, r = 0; y < h - 8; y += 10, r++) for (let x = 12 + (r % 2) * 5; x < w - 8; x += 10) { g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  });
  region('uvwarn', 1792, 128, 256, 96, (g, w, h) => {
    g.fillStyle = '#ffd400'; rr(g, 0, 0, w, h, 8); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 5; rr(g, 5, 5, w - 10, h - 10, 6); g.stroke();
    g.fillStyle = '#5b2d9e'; g.beginPath(); g.arc(46, h / 2, 24, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `900 22px ${SANS}`; g.textAlign = 'center'; g.fillText('UV', 46, h / 2 + 8);
    g.fillStyle = '#111'; g.textAlign = 'left'; g.font = `900 24px ${SANS}`; g.fillText('ATTENTION', 82, 42);
    g.font = `600 14px ${MONO}`; g.fillText('RAYONNEMENT UV', 82, 66);
  });
  region('pinch', 1792, 224, 256, 64, (g, w, h) => {
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111'; for (let x = -h; x < 70; x += 20) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 10, h); g.lineTo(x + 10 + h, 0); g.lineTo(x + h, 0); g.fill(); }
    g.fillStyle = '#ffd400'; g.fillRect(70, 0, w - 70, h);
    g.fillStyle = '#111'; g.font = `800 17px ${SANS}`; g.fillText('RISQUE DE', 80, 28); g.fillText('PINCEMENT', 80, 50);
  });
  region('beam', 0, 256, 1024, 64, g => {
    g.fillStyle = '#2a2b30'; g.font = `600 34px ${MONO}`; g.fillText('CFI SERVICES  ·  GRAND FORMAT  ·  3200 mm', 10, 44);
  });
  region('model', 0, 320, 512, 64, g => {
    g.fillStyle = '#6c4092'; g.fillRect(8, 18, 28, 28);
    g.fillStyle = '#2a2b30'; g.font = `900 34px ${SANS}`; g.fillText('UV-3200', 50, 46);
    g.font = `500 20px ${MONO}`; g.fillText('LED CURE · 6 HEADS', 230, 44);
  });
  region('nozzle', 512, 320, 128, 160, (g, w, h) => {
    g.fillStyle = '#9ea3ab'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9cdd3'; g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#16171a';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) for (let y = 16 + k * 1.5; y < h - 16; y += 3) g.fillRect(20 + r * 26 + k * 4, y, 1.4, 1.4);
  });
  region('fan', 640, 320, 128, 128, (g, w, h) => {
    g.strokeStyle = '#2c2e33'; g.lineWidth = 5;
    for (let r = 14; r < 60; r += 11) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
    g.lineWidth = 6; [0, PI / 2].forEach(a => { g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); g.lineTo(w / 2 - Math.cos(a) * 60, h / 2 - Math.sin(a) * 60); g.stroke(); });
    g.fillStyle = '#2c2e33'; g.beginPath(); g.arc(w / 2, h / 2, 10, 0, 7); g.fill();
  });
  region('stripes', 768, 320, 256, 32, (g, w, h) => {
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111'; for (let x = -h; x < w; x += 24) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  region('badge', 1024, 320, 256, 64, (g, w, h) => {
    g.fillStyle = '#6c4092'; rr(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#fff'; g.font = `900 34px ${SANS}`; g.textAlign = 'center'; g.fillText('UV-LED', w / 2, 45);
  });
  region('cfimark', 1280, 320, 256, 64, g => {
    g.fillStyle = '#6c4092'; g.beginPath(); g.arc(30, 32, 22, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = `900 22px ${SANS}`; g.fillText('cfi', 15, 40);
    g.fillStyle = '#2a2b30'; g.font = `500 22px ${MONO}`; g.fillText('S E R V I C E S', 64, 41);
  });
  INKS.forEach((c, i) => {
    region('tank' + i, i * 64, 384, 64, 64, (g, w, h) => {
      g.fillStyle = '#f4f4f2'; rr(g, 2, 2, w - 4, h - 4, 6); g.fill();
      g.fillStyle = hex(c); g.fillRect(2, h - 16, w - 4, 12);
      g.fillStyle = '#111'; g.font = `900 34px ${SANS}`; g.textAlign = 'center'; g.fillText(INK_N[i], w / 2, 40);
    });
    region('cart' + i, 1024 + i * 64, 384, 64, 128, (g, w, h) => {
      g.fillStyle = '#ecedef'; rr(g, 2, 2, w - 4, h - 4, 6); g.fill();
      g.fillStyle = hex(c); g.fillRect(2, 2, w - 4, 30);
      g.fillStyle = '#111'; g.font = `900 30px ${SANS}`; g.textAlign = 'center'; g.fillText(INK_N[i], w / 2, 70);
      g.font = `500 11px ${MONO}`; g.fillText('UV · 1 L', w / 2, 90);
      for (let k = 0; k < 18; k++) g.fillRect(10 + k * 2.4, 100, k % 3 ? 1 : 1.8, 16);
    });
  });
  const drawAtlas = g => {
    g.clearRect(0, 0, AW, AH);
    for (const r of Object.values(R)) {
      g.save(); g.translate(r.x, r.y); g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip();
      g.textAlign = 'left'; r.draw(g, r.w, r.h); g.restore();
    }
  };
  const atlas = canvasTex(AW, AH, drawAtlas);
  const labelM = new THREE.MeshStandardMaterial({
    map: atlas, transparent: true, roughness: 0.46, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const labelGeo = (k, w, h) => {
    const r = R[k], g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    const u0 = r.x / AW, u1 = (r.x + r.w) / AW, v1 = 1 - r.y / AH, v0 = 1 - (r.y + r.h) / AH;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return g;
  };
  const label = (B, k, w, h, x, y, z, o) => B.add(labelGeo(k, w, h), labelM, x, y, z, o);
  const FACE = { px: { ry: PI / 2 }, nx: { ry: -PI / 2 }, pz: {}, down: { rx: PI / 2 } };

  // Règle graduée (texture dédiée, 0 au bord gauche du média)
  const RULE_L = 3.4, RULE_PX = 4096 / RULE_L;
  const drawRuler = (g, w, h) => {
    g.fillStyle = '#c3c7cd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16171a'; g.font = `600 22px ${MONO}`; g.textAlign = 'center';
    for (let mm = -50; mm <= 3250; mm += 5) {
      const x = (mm / 1000 - MEDIA_W / 2 + RULE_L / 2) * RULE_PX;
      const big = mm % 100 === 0, mid = mm % 50 === 0, cm = mm % 10 === 0;
      g.fillRect(x - 0.9, 0, 1.8, big ? 34 : mid ? 26 : cm ? 18 : 10);
      if (big && mm >= 0) g.fillText(String(mm / 10), x, 58);
    }
  };
  const rulerTex = canvasTex(4096, 64, drawRuler);
  const rulerM = new THREE.MeshStandardMaterial({ map: rulerTex, roughness: 0.32, metalness: 0.6 });

  // Les polices du site arrivent après la construction : on redessine les marquages
  const redraw = () => {
    drawAtlas(atlas.image.getContext('2d')); atlas.needsUpdate = true;
    drawRuler(rulerTex.image.getContext('2d'), 4096, 64); rulerTex.needsUpdate = true;
  };
  if (typeof document !== 'undefined' && document.fonts?.load) {
    Promise.all([document.fonts.load(`900 60px ${SANS}`), document.fonts.load(`600 20px ${MONO}`)]).then(redraw).catch(() => {});
  }

  // Vis (InstancedMesh) : position + normale de la face
  const screwGeo = new THREE.CylinderGeometry(0.0033, 0.0038, 0.002, 12);
  const SCREW_ROT = { x: [0, 0, -PI / 2], nx: [0, 0, PI / 2], y: [0, 0, 0], z: [PI / 2, 0, 0], nz: [-PI / 2, 0, 0] };
  const screwsS = [], screwsC = [];
  const screw = (list, x, y, z, n = 'z', fr = null) => list.push({ x, y, z, n, fr });
  function screwMesh(list, target) {
    const im = new THREE.InstancedMesh(screwGeo, screwM, list.length);
    const o = new THREE.Object3D();
    list.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z); o.rotation.set(...SCREW_ROT[s.n]); o.updateMatrix();
      if (s.fr) o.matrix.premultiply(s.fr);
      im.setMatrixAt(i, o.matrix);
    });
    im.receiveShadow = true; target.add(im);
  }

  /* ---------- Chemin du média (identique à media.js) : sert à épouser la bâche sans la toucher ---------- */
  const mediaCurve = new THREE.CatmullRomCurve3([
    [-0.62, 1.03], [-0.5, 1.07], [-0.27, PLATEN_Y + 0.001], [0, PLATEN_Y + 0.001], [0.2, PLATEN_Y + 0.001],
    [0.285, PLATEN_Y - 0.025], [0.325, PLATEN_Y - 0.13], [0.35, 0.72], [0.39, 0.38], [0.45, 0.1]
  ].map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'catmullrom', 0.3);
  const MP = mediaCurve.getPoints(900).map(v => [v.z, v.y]);
  // Décalage d'une polyligne (z, y) vers l'intérieur de la courbe (sous / derrière la bâche)
  const offsetPath = (pts, off) => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1;
    const o = typeof off === 'function' ? off(i, pts.length) : off;
    return [p[0] + ty / l * o, p[1] - tz / l * o];
  });
  const thin = (pts, k) => pts.filter((_, i) => i % k === 0 || i === pts.length - 1);

  /* ======================================================================
     PIÈTEMENT : montants sous les tours, pieds à roulettes et vérins, traverses,
     enrouleur et barre de tension (derrière la bâche qui pend)
     ====================================================================== */
  const LEG_X = 1.99;
  [-1, 1].forEach(s => {
    const x = s * LEG_X;
    S.box(0.1, 0.62, 0.16, 0.008, M.graphite, x, 0.43, -0.07, { ...SH, seg: 2 });
    S.box(0.12, 0.06, 0.92, 0.01, M.graphite, x, 0.115, -0.08, { ...SH, seg: 2 });
    S.box(0.13, 0.012, 0.2, 0.003, M.dark, x, 0.734, -0.07);                       // platine de liaison sous la tour
    S.add(prism([[0.01, 0.145], [0.25, 0.145], [0.01, 0.34]], x - 0.007, x + 0.007, 0.002, 1), M.graphite);
    S.add(prism([[-0.15, 0.145], [-0.15, 0.36], [-0.44, 0.145]], x - 0.007, x + 0.007, 0.002, 1), M.graphite);
    [0.18, 0.62].forEach(y => { screw(screwsS, x + 0.0505, y, -0.03, 'x'); screw(screwsS, x + 0.0505, y, -0.11, 'x'); screw(screwsS, x - 0.0505, y, -0.03, 'nx'); screw(screwsS, x - 0.0505, y, -0.11, 'nx'); });
    // Roulettes pivotantes avec frein
    [-0.48, 0.3].forEach(z => {
      S.box(0.075, 0.006, 0.075, 0.002, M.graphite, x, 0.082, z);
      S.cyl(0.022, 0.012, M.dark, x, 0.073, z, 'y', 20);
      [-1, 1].forEach(k => S.box(0.006, 0.05, 0.05, 0.002, M.graphite, x + k * 0.019, 0.048, z - 0.01));
      S.cyl(0.034, 0.026, M.rubber, x, 0.034, z - 0.014, 'x', 28);
      S.cyl(0.016, 0.03, satin, x, 0.034, z - 0.014, 'x', 16);
      S.box(0.032, 0.005, 0.035, 0.002, M.dark, x, 0.066, z + 0.032, { rx: -0.35 });
    });
    // Vérins de calage
    [-0.36, 0.18].forEach(z => {
      S.cyl(0.007, 0.075, M.chrome, x, 0.0475, z, 'y', 12);
      S.cyl(0.014, 0.01, M.graphite, x, 0.072, z, 'y', 6);
      S.cyl(0.02, 0.006, M.graphite, x, 0.015, z, 'y', 20);
      S.cyl(0.026, 0.012, M.rubber, x, 0.006, z, 'y', 24, { r2: 0.03 });
    });
    // Enrouleur : bras + flasque
    S.box(0.03, 0.05, 0.22, 0.006, M.graphite, s * 1.925, 0.2, 0.1);
    S.cyl(0.06, 0.02, M.graphite, s * 1.665, 0.2, 0.18, 'x', 32, { r2: 0.05 });
    // Barre de tension (bras pivotant)
    S.box(0.03, 0.06, 0.02, 0.005, M.dark, s * 1.925, 0.36, 0.015);
    S.cyl(0.024, 0.03, M.graphite, s * 1.925, 0.36, 0.035, 'x', 24);
    const aLen = Math.hypot(0.3, 0.11);
    S.box(0.022, 0.034, aLen, 0.006, M.dark, s * 1.925, 0.415, 0.18, { rx: -Math.atan2(0.11, 0.3) });
    S.cyl(0.022, 0.012, M.graphite, s * 1.93, 0.47, 0.33, 'x', 20);
  });
  S.box(3.88, 0.08, 0.06, 0.008, M.graphite, 0, 0.3, -0.1, { ...SH, seg: 2 });
  S.box(3.88, 0.05, 0.05, 0.006, M.graphite, 0, 0.17, -0.4, SH);
  S.cyl(0.045, 3.3, satin, 0, 0.2, 0.18, 'x', 40);                                   // mandrin d'enroulement (vide)
  S.cyl(0.012, 3.84, M.chrome, 0, 0.2, 0.18, 'x', 12);
  S.box(0.08, 0.12, 0.12, 0.01, M.dark, -1.86, 0.2, 0.18, { seg: 2 });                // moteur d'enrouleur
  S.cyl(0.018, 3.86, M.chrome, 0, 0.47, 0.33, 'x', 24);                               // barre de tension (2,5 cm derrière la bâche)

  /* ======================================================================
     CORPS, PLATINE, GUIDES DE MÉDIA
     ====================================================================== */
  S.box(3.66, 0.245, 0.59, 0.01, M.dark, 0, 0.9225, -0.075, SH);

  // Platine perforée (aspiration)
  const platenTex = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#121315';
    for (let y = 4; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  });
  platenTex.wrapS = platenTex.wrapT = THREE.RepeatWrapping; platenTex.repeat.set(13.75, 1.6);
  const platenM = new THREE.MeshStandardMaterial({ map: platenTex, roughness: 0.55, metalness: 0.5 });
  S.box(3.36, 0.034, 0.42, 0.002, platenM, 0, PLATEN_Y - 0.019, -0.08);
  [-1, 1].forEach(s => S.box(0.12, 0.075, 0.5, 0.004, M.graphite, s * 1.74, 1.0375, -0.05));

  // Guide avant / sécheur : épouse la bâche par-dessous (3,5 → 12 mm d'écart, la bâche ondule en bas)
  const front = thin(MP.filter(([z, y]) => z > 0.1 && y > 0.775), 3);
  const closeFront = top => [...top, [0.18, top[top.length - 1][1]], [0.18, 1.04], [0.1, 1.04]];
  S.add(prism(closeFront(offsetPath(front, (i, n) => 0.0035 + 0.0085 * i / (n - 1))), -1.66, 1.66, 0.002, 1), darkMetal, 0, 0, 0, SH);
  [-1, 1].forEach(s => S.add(prism(closeFront(offsetPath(front, -0.004)), s > 0 ? 1.66 : -1.675, s > 0 ? 1.675 : -1.66, 0.002, 1), M.dark));
  // Guide arrière : de la sortie du rouleau à la platine
  const rear = thin(MP.filter(([z, y]) => z > -0.53 && z < -0.29 && y > 1.0), 3);
  S.add(prism([...offsetPath(rear, 0.006), [-0.29, 1.0], [-0.53, 1.0]], -1.66, 1.66, 0.002, 1), darkMetal);

  // Guides de bord (clamps) posés sur la lisière du média
  [-1, 1].forEach(s => {
    S.box(0.026, 0.003, 0.34, 0.001, satin, s * 1.598, 1.0847, -0.01);
    S.box(0.004, 0.0075, 0.34, 0.001, satin, s * 1.6125, 1.0815, -0.01);
    S.box(0.03, 0.011, 0.03, 0.003, M.dark, s * 1.605, 1.0905, 0.175);
    label(S, 'stripes', 0.026, 0.006, s * 1.598, 1.0864, -0.15, { rx: -PI / 2 });
  });

  // Galets presseurs : barre, bras, fourches et galets (bas à 1.083, au-dessus de la bâche)
  S.box(3.82, 0.03, 0.03, 0.004, M.dark, 0, 1.19, -0.21);
  for (let i = 0; i < 9; i++) {
    const x = -1.56 + i * 0.39;
    S.box(0.03, 0.06, 0.045, 0.005, M.graphite, x, 1.15, -0.212);
    S.box(0.026, 0.008, 0.03, 0.003, grey, x, 1.183, -0.188);
    [-1, 1].forEach(k => S.box(0.004, 0.04, 0.03, 0.001, satin, x + k * 0.0145, 1.108, -0.215));
    S.cyl(0.011, 0.023, M.rubber, x, 1.094, -0.215, 'x', 20);
    S.cyl(0.003, 0.033, M.chrome, x, 1.094, -0.215, 'x', 8);
  }

  /* ======================================================================
     TOURS LATÉRALES : capots à chanfreins, baie de parking du chariot,
     grilles d'aération, pupitre (droite), cartouches (droite)
     ====================================================================== */
  const T_PROFILE = [[-0.52, 0.74], [0.38, 0.74], [0.38, 1.3], [0.3, 1.52], [0.25, 1.61], [0.2, 1.65], [-0.47, 1.65], [-0.52, 1.6]];
  const T_LOWER = [[-0.52, 0.74], [0.38, 0.74], [0.38, 1.085], [-0.52, 1.085]];
  const T_FRONT = [[0.14, 1.085], [0.38, 1.085], [0.38, 1.3], [0.351, 1.38], [0.14, 1.38]];
  const T_BACK = [[-0.52, 1.085], [-0.15, 1.085], [-0.15, 1.38], [-0.52, 1.38]];
  const T_UPPER = [[-0.52, 1.38], [0.351, 1.38], [0.3, 1.52], [0.25, 1.61], [0.2, 1.65], [-0.47, 1.65], [-0.52, 1.6]];
  const span = (s, a, b) => s > 0 ? [a, b] : [-b, -a];
  // Grille à ventelles inclinées sur la face extérieure
  function grille(s, yc, zc, H, W) {
    const xf = s * 2.18;
    S.box(0.004, H, W, 0.0015, M.dark, xf + s * 0.0005, yc, zc);
    for (let y = yc - H / 2 + 0.012; y < yc + H / 2 - 0.006; y += 0.016) S.add(new THREE.BoxGeometry(0.003, 0.011, W - 0.014), grey, xf + s * 0.0035, y, zc, { rz: s * 0.55 });
    [-1, 1].forEach(k => {
      S.box(0.008, 0.008, W + 0.012, 0.003, M.white, xf + s * 0.003, yc + k * (H / 2 + 0.002), zc);
      S.box(0.008, H + 0.012, 0.008, 0.003, M.white, xf + s * 0.003, yc, zc + k * (W / 2 + 0.002));
      screw(screwsS, xf + s * 0.007, yc + k * (H / 2 + 0.002), zc - W / 2 - 0.002, s > 0 ? 'x' : 'nx');
      screw(screwsS, xf + s * 0.007, yc + k * (H / 2 + 0.002), zc + W / 2 + 0.002, s > 0 ? 'x' : 'nx');
    });
  }
  [-1, 1].forEach(s => {
    S.add(prism(T_PROFILE, ...span(s, 1.92, 2.18), 0.012, 3), M.white, 0, 0, 0, SH);
    [T_LOWER, T_FRONT, T_BACK, T_UPPER].forEach(p => S.add(prism(p, ...span(s, 1.8, 1.92), 0.008, 2), M.white, 0, 0, 0, SH));
    S.box(0.012, 0.295, 0.29, 0.002, M.dark, s * 1.913, 1.2325, -0.005);               // fond de baie
    grille(s, 0.99, -0.05, 0.26, 0.5);
    if (s < 0) grille(s, 1.4, -0.1, 0.2, 0.4);
    S.box(0.008, 0.035, 0.16, 0.012, M.dark, s * 2.181, 1.58, -0.3, { seg: 2 });       // poignée encastrée
    [1.84, 2.14].forEach(x => screw(screwsS, s * x, 0.77, 0.381, 'z'));
  });
  // Station de capsulage (baie droite)
  S.box(0.1, 0.004, 0.2, 0.0015, M.dark, 1.855, 1.087, -0.01);
  [-0.05, 0.03].forEach(z => S.box(0.05, 0.004, 0.065, 0.0015, M.rubber, 1.86, 1.091, z));

  // Tour droite : logo, cartouches, plaque signalétique, interrupteur
  label(S, 'logo', 0.3, 0.15, 1.99, 1.17, 0.3812);
  label(S, 'logo', 0.36, 0.18, 2.1808, 1.42, -0.14, FACE.px);
  label(S, 'serial', 0.12, 0.06, 2.1808, 1.0, -0.42, FACE.px);
  S.box(0.008, 0.036, 0.05, 0.003, M.dark, 2.183, 0.86, -0.42);
  S.box(0.004, 0.026, 0.018, 0.002, keyM, 2.188, 0.862, -0.425, { rz: 0.12 });
  S.box(0.33, 0.17, 0.006, 0.003, M.dark, 1.99, 0.885, 0.382);
  [[-0.155, -0.075], [0.155, -0.075], [-0.155, 0.075], [0.155, 0.075]].forEach(([dx, dy]) => screw(screwsS, 1.99 + dx, 0.885 + dy, 0.3852, 'z'));
  INKS.forEach((c, i) => {
    const x = 1.99 + (i - 2.5) * 0.052;
    S.box(0.044, 0.15, 0.016, 0.004, M.graphite, x, 0.885, 0.39);
    S.box(0.044, 0.016, 0.004, 0.0015, inkM[i], x, 0.948, 0.3995);
    S.box(0.02, 0.008, 0.006, 0.002, M.dark, x, 0.818, 0.4);                         // prise de doigt
    label(S, 'cart' + i, 0.032, 0.064, x, 0.88, 0.3985);
    S.cyl(0.0028, 0.003, i === 2 ? ledO : ledG, x, 0.982, 0.3815, 'z', 12);
  });
  // Tour gauche : trappe de maintenance perforée, serrure, marquages
  label(S, 'holes', 0.24, 0.24, -1.99, 1.02, 0.3812);
  S.cyl(0.009, 0.004, M.chrome, -1.99, 0.84, 0.382, 'z', 20);
  label(S, 'warn', 0.045, 0.045, -2.1, 1.2, 0.3812);
  label(S, 'cfimark', 0.2, 0.05, -1.99, 1.4103, 0.3408, { rx: -0.349 });              // rampe avant (le pupitre est à droite)

  // Pupitre : cadre, écran, pavé directionnel, touches, voyants
  const PF = frame(1.99, 1.41, 0.34, -0.349);
  const P = (geo, mat, x, y, z, o = {}) => S.add(geo, mat, x, y, z, { ...o, frame: PF });
  P(rbox(0.33, 0.21, 0.014, 0.005, 2), M.dark, 0, 0, 0.006);
  P(labelGeo('panel', 0.32, 0.2), labelM, 0, 0, 0.0132);
  P(rbox(0.142, 0.092, 0.004, 0.0018), glossBlack, -0.07, 0.025, 0.0145);
  [0, 1, 2, 3].forEach(i => P(rbox(0.022, 0.011, 0.006, 0.0025), keyM, -0.115 + i * 0.03, -0.045, 0.016));
  P(rbox(0.02, 0.016, 0.006, 0.003), keyM, 0.065, 0.05, 0.016);
  P(rbox(0.02, 0.016, 0.006, 0.003), keyM, 0.065, -0.01, 0.016);
  P(rbox(0.016, 0.02, 0.006, 0.003), keyM, 0.035, 0.02, 0.016);
  P(rbox(0.016, 0.02, 0.006, 0.003), keyM, 0.095, 0.02, 0.016);
  P(cylG(0.011, 0.006, 'z', 24), blueKey, 0.065, 0.02, 0.016);
  [0.055, 0.02, -0.015].forEach(y => P(rbox(0.026, 0.012, 0.006, 0.0025), keyM, 0.132, y, 0.016));
  P(cylG(0.0145, 0.004, 'z', 28), ledG, 0.132, -0.068, 0.0145);
  P(cylG(0.012, 0.007, 'z', 28), keyM, 0.132, -0.068, 0.0165);
  [ledG, ledData, ledB].forEach((m, i) => P(cylG(0.0028, 0.003, 'z', 12), m, 0.02 + i * 0.028, -0.07, 0.0145));
  [[-0.155, 0.095], [0.155, 0.095], [-0.155, -0.095], [0.155, -0.095]].forEach(([x, y]) => screw(screwsS, x, y, 0.0135, 'z', PF));
  // Écran (texture redessinée 2 fois par seconde)
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 256;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const drawScreen = pct => {
    const g = screenCanvas.getContext('2d');
    g.fillStyle = '#04121c'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#0b2636'; g.fillRect(0, 0, 512, 44);
    g.fillStyle = '#7fe3ff'; g.font = `700 22px ${MONO}`; g.textAlign = 'left'; g.fillText('CFI UV-3200', 16, 30);
    g.fillStyle = '#2bff8a'; g.beginPath(); g.arc(352, 22, 6, 0, 7); g.fill();
    g.font = `600 18px ${MONO}`; g.fillText('IMPRESSION', 366, 29);
    g.fillStyle = '#d6f6ff'; g.font = `600 20px ${MONO}`; g.fillText('BACHE_CFI_3200x1500.tif', 16, 80);
    g.fillStyle = '#3aa6c9'; g.font = `500 16px ${MONO}`; g.fillText('1440 dpi · 8 passes · CMJN+B+V', 16, 106);
    g.fillStyle = '#0d3346'; g.fillRect(16, 124, 480, 18);
    g.fillStyle = '#7fe3ff'; g.fillRect(16, 124, 480 * pct, 18);
    g.fillStyle = '#7fe3ff'; g.font = `700 26px ${MONO}`; g.fillText(Math.round(pct * 100) + ' %', 16, 180);
    g.fillStyle = '#3aa6c9'; g.font = `500 16px ${MONO}`;
    g.fillText('reste ' + Math.max(0, Math.round((1 - pct) * 38)) + ' min', 16, 206);
    g.fillText('UV 82 %  ·  vide 4.2 kPa', 16, 232);
    INKS.forEach((c, i) => {
      const x = 330 + i * 28, lv = [0.72, 0.58, 0.18, 0.84, 0.46, 0.66][i];
      g.fillStyle = '#0d3346'; g.fillRect(x, 160, 18, 70);
      g.fillStyle = hex(c === 0x141416 ? 0x5a5d66 : c); g.fillRect(x, 160 + 70 * (1 - lv), 18, 70 * lv);
      g.fillStyle = '#7fb8cc'; g.font = `600 13px ${MONO}`; g.textAlign = 'center'; g.fillText(INK_N[i], x + 9, 248);
    });
    g.textAlign = 'left';
    screenTex.needsUpdate = true;
  };
  drawScreen(0.42);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.05, roughness: 0.16, metalness: 0 }));
  screen.position.set(-0.07, 0.025, 0.0168);
  const panelG = new THREE.Group();
  panelG.position.set(1.99, 1.41, 0.34); panelG.rotation.x = -0.349;
  panelG.add(screen); printer.add(panelG);

  /* ======================================================================
     POUTRE : trois capots extrudés avec joints, rails, plaque arrière et règle
     ====================================================================== */
  const B_PROFILE = [[-0.08, 1.38], [-0.08, 1.53], [-0.11, 1.605], [-0.16, 1.63], [-0.34, 1.63], [-0.375, 1.6], [-0.375, 1.38]];
  [[-1.84, -0.621], [-0.619, 0.619], [0.621, 1.84]].forEach(([a, b]) => S.add(prism(B_PROFILE, a, b, 0.003, 2), M.white, 0, 0, 0, SH));
  S.box(3.66, 0.22, 0.27, 0, M.dark, 0, 1.505, -0.225);                               // âme sombre visible dans les joints
  label(S, 'beam', 1.0, 0.0625, -0.95, 1.5678, -0.0943, { rx: -0.38 });
  label(S, 'model', 0.4, 0.05, 1.2, 1.5678, -0.0943, { rx: -0.38 });
  label(S, 'badge', 0.15, 0.0375, -1.55, 1.455, -0.0792);
  label(S, 'pinch', 0.1, 0.025, -0.3, 1.455, -0.0792);
  // Rails, règle d'encodeur, plaque arrière avec règle graduée
  S.cyl(0.013, 3.82, M.chrome, 0, 1.25, -0.11, 'x', 24);
  S.cyl(0.013, 3.82, M.chrome, 0, 1.33, -0.11, 'x', 24);
  const encoder = new THREE.Mesh(new THREE.PlaneGeometry(3.82, 0.012), new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85 }));
  encoder.position.set(0, 1.29, -0.075); printer.add(encoder);
  S.box(3.82, 0.23, 0.007, 0.002, M.dark, 0, 1.265, -0.1315);
  S.add(new THREE.PlaneGeometry(RULE_L, 0.022), rulerM, 0, 1.166, -0.1277);
  // Goulotte de la chaîne porte-câbles
  S.box(1.76, 0.004, 0.095, 0.0015, M.graphite, 0.91, 1.388, -0.0255);
  S.box(1.76, 0.022, 0.004, 0.0015, M.graphite, 0.91, 1.397, 0.024);
  [0.2, 0.6, 1.0, 1.4, 1.72].forEach(x => screw(screwsS, x, 1.397, 0.0262, 'z'));
  S.box(0.04, 0.03, 0.075, 0.004, M.dark, 0.05, 1.405, -0.03);                        // point fixe de la chaîne

  /* ======================================================================
     CAPOT AVANT EN ACRYLIQUE FUMÉ, RELEVÉ (charnières, vérins à gaz, poignée)
     ====================================================================== */
  const TH = 100 * PI / 180, ct = Math.cos(TH), st = Math.sin(TH), HZ = -0.17, HY = 1.64;
  const toW = ([cz, cy]) => [HZ + cz * ct - cy * st, HY + cy * ct + cz * st];
  const lip = [[0, 0], [0.38, 0]];
  for (let i = 1; i <= 8; i++) { const a = PI / 2 - i / 8 * (70 * PI / 180); lip.push([0.38 + 0.06 * Math.cos(a), -0.06 + 0.06 * Math.sin(a)]); }
  lip.push([0.436 + 0.05 * 0.342, -0.0395 - 0.05 * 0.94]);
  const coverShape = [...lip, ...offsetPath(lip, 0.005).reverse()].map(toW);
  const coverMesh = new THREE.Mesh(prism(coverShape, -1.745, 1.745, 0.0015, 1), acrylic);
  coverMesh.renderOrder = 2; printer.add(coverMesh);
  [-1, 1].forEach(s => S.add(prism(coverShape, ...span(s, 1.745, 1.753), 0.001, 1), M.rubber));
  const CF = frame(0, HY, HZ, -TH);
  S.add(rbox(3.49, 0.012, 0.03, 0.004), grey, 0, 0.004, 0.022, { frame: CF });          // profilé de charnière
  S.add(rbox(0.6, 0.035, 0.012, 0.005, 2), M.dark, 0, -0.06, 0.453, { frame: CF, rx: -0.349 });
  [-1.45, -0.55, 0.55, 1.45].forEach(x => {
    S.cyl(0.008, 0.075, M.graphite, x, HY, HZ, 'x', 16);
    S.box(0.07, 0.004, 0.045, 0.0015, M.graphite, x, 1.632, -0.19);
    screw(screwsS, x - 0.022, 1.634, -0.2, 'y'); screw(screwsS, x + 0.022, 1.634, -0.2, 'y');
  });
  // Vérins à gaz : du chanfrein de la poutre à la face intérieure du capot
  const up = new THREE.Vector3(0, 1, 0);
  [-1, 1].forEach(s => {
    const [tz, ty] = toW([0.24, -0.012]);
    const a = new THREE.Vector3(s * 1.69, 1.618, -0.125), b = new THREE.Vector3(s * 1.69, ty, tz);
    const d = b.clone().sub(a), len = d.length(); d.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, d);
    const at = k => a.clone().addScaledVector(d, k);
    let p = at(0.075); S.cyl(0.0085, 0.13, M.graphite, p.x, p.y, p.z, 'y', 16, { q });
    p = at(0.14 + (len - 0.14) / 2); S.cyl(0.004, len - 0.14, M.chrome, p.x, p.y, p.z, 'y', 10, { q });
    S.add(new THREE.SphereGeometry(0.008, 12, 8), M.dark, a.x, a.y, a.z);
    S.add(new THREE.SphereGeometry(0.006, 12, 8), M.dark, b.x, b.y, b.z);
    S.box(0.02, 0.012, 0.03, 0.003, M.dark, s * 1.69, 1.612, -0.125);
  });

  /* ======================================================================
     ROULEAU DE MÉDIA ARRIÈRE et ses supports
     ====================================================================== */
  S.cyl(0.09, MEDIA_W, M.roll, 0, 0.94, -0.62, 'x', 48, SH);
  [-1, 1].forEach(s => {
    S.cyl(0.1, 0.03, M.graphite, s * 1.615, 0.94, -0.62, 'x', 48);
    S.cyl(0.05, 0.03, M.graphite, s * 1.645, 0.94, -0.62, 'y', 32, { r2: 0.075, rz: s > 0 ? -PI / 2 : PI / 2 });
    S.box(0.04, 0.07, 0.07, 0.006, M.dark, s * 1.75, 0.94, -0.62);
    S.box(0.03, 0.05, 0.28, 0.006, M.dark, s * 1.75, 0.895, -0.495, { rx: -2.795 });
  });
  S.cyl(0.018, 3.54, M.chrome, 0, 0.94, -0.62, 'x', 16);
  S.cyl(0.026, 0.024, M.chrome, -1.786, 0.94, -0.62, 'x', 24);                         // molette de frein

  /* ======================================================================
     CHARIOT : carénage, plaque de têtes, lampes UV, sub-tanks, tubes, nappe
     (x local ; y et z dans le repère machine)
     ====================================================================== */
  C.box(0.32, 0.2, 0.2, 0.008, M.graphite, 0, 1.215, -0.02, SH);
  C.box(0.33, 0.25, 0.035, 0.006, M.graphite, 0, 1.235, -0.1075, SH);
  [-1, 1].forEach(s => [1.25, 1.33].forEach(y => C.box(0.012, 0.04, 0.034, 0.004, M.dark, s * 0.171, y, -0.11)));
  // Carénage blanc à chanfrein + bandeau sombre, joint entre les deux
  C.add(prism([[-0.09, 1.198], [0.122, 1.198], [0.122, 1.285], [0.106, 1.31], [-0.09, 1.31]], -0.172, 0.172, 0.006, 3), M.white, 0, 0, 0, SH);
  C.add(prism([[-0.09, 1.135], [0.118, 1.135], [0.118, 1.194], [-0.09, 1.194]], -0.168, 0.168, 0.004, 2), M.dark);
  label(C, 'carFront', 0.15, 0.075, 0, 1.2425, 0.1226);
  label(C, 'hot', 0.022, 0.022, -0.13, 1.163, 0.1186);
  label(C, 'warn', 0.022, 0.022, 0.13, 1.163, 0.1186);
  label(C, 'serial', 0.06, 0.03, 0.1726, 1.255, 0.02, FACE.px);
  label(C, 'cfimark', 0.1, 0.025, -0.1726, 1.255, 0.02, FACE.nx);
  [[-0.158, 1.208], [0.158, 1.208], [-0.158, 1.275]].forEach(([x, y]) => screw(screwsC, x, y, 0.1225, 'z'));
  // Plaque des têtes, jupes anti-statiques, 6 têtes en quinconce (buses en dessous)
  C.box(0.31, 0.018, 0.2, 0.003, M.graphite, 0, 1.105, -0.01);
  [0.093, -0.113].forEach(z => C.box(0.31, 0.012, 0.006, 0.002, M.rubber, 0, 1.103, z));
  [[-0.11, -0.055], [-0.03, -0.055], [0.05, -0.055], [-0.05, 0.03], [0.03, 0.03], [0.11, 0.03]].forEach(([x, z]) => {
    C.box(0.055, 0.008, 0.07, 0.002, satin, x, 1.093, z);
    label(C, 'nozzle', 0.048, 0.06, x, 1.0888, z, FACE.down);
  });
  // Lampes UV : boîtier, fenêtre émissive, ailettes, ventilateur latéral
  [-1, 1].forEach(s => {
    const x = s * 0.21;
    C.box(0.07, 0.11, 0.19, 0.008, M.graphite, x, 1.15, -0.01, { ...SH, seg: 2 });
    C.add(new THREE.PlaneGeometry(0.05, 0.16), M.uv, x, 1.0944, -0.01, FACE.down);
    for (let z = -0.09; z <= 0.071; z += 0.02) C.add(new THREE.BoxGeometry(0.056, 0.035, 0.0025), M.dark, x, 1.2225, z);
    C.cyl(0.026, 0.005, M.dark, s * 0.2475, 1.15, -0.01, 'x', 28);
    label(C, 'fan', 0.05, 0.05, s * 0.2503, 1.15, -0.01, s > 0 ? FACE.px : FACE.nx);
    label(C, 'uvwarn', 0.06, 0.0225, x, 1.17, 0.0856);
    [-0.025, 0.025].forEach(dx => screw(screwsC, x + dx, 1.197, 0.0855, 'z'));
  });
  // Sub-tanks d'encre (C M J N Blanc Vernis) avec bouchons, raccords, étiquettes
  C.box(0.3, 0.008, 0.125, 0.002, M.dark, 0, 1.314, -0.03);
  const TANK_X = i => -0.125 + i * 0.05;
  INKS.forEach((c, i) => {
    const x = TANK_X(i);
    C.box(0.042, 0.044, 0.11, 0.004, inkM[i], x, 1.34, -0.03, { seg: 2 });
    C.box(0.044, 0.008, 0.03, 0.002, M.white, x, 1.366, 0.0);
    C.cyl(0.004, 0.006, M.dark, x, 1.373, 0.01, 'y', 10);
    label(C, 'tank' + i, 0.026, 0.026, x, 1.34, 0.0254);
  });
  // Support de chaîne : plaque, bras, guide-tubes, nappe plate
  C.box(0.05, 0.225, 0.012, 0.003, M.graphite, 0, 1.4225, 0.036);
  C.box(0.05, 0.01, 0.11, 0.003, M.graphite, 0, 1.518, -0.012);
  C.box(0.004, 0.033, 0.06, 0.001, M.graphite, -0.002, 1.4965, -0.03);
  C.box(0.05, 0.02, 0.03, 0.004, M.dark, 0, 1.535, 0.035);
  [1.43, 1.49].forEach(y => C.box(0.044, 0.01, 0.014, 0.003, M.dark, 0, y, 0.054));
  C.box(0.032, 0.2, 0.0015, 0, grey, 0, 1.415, 0.0428);
  C.box(0.036, 0.012, 0.016, 0.002, M.dark, 0, 1.318, 0.048);
  [1.33, 1.40].forEach(y => screw(screwsC, 0.019, y, 0.0425, 'z'));
  INKS.forEach((c, i) => {
    const x = TANK_X(i), xo = (i - 2.5) * 0.0058;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, 1.374, 0.01), new THREE.Vector3(x, 1.378, 0.034), new THREE.Vector3(x * 0.55 + xo, 1.384, 0.053),
      new THREE.Vector3(xo, 1.425, 0.055), new THREE.Vector3(xo, 1.5, 0.055), new THREE.Vector3(xo * 0.6, 1.53, 0.042)
    ]);
    C.add(new THREE.TubeGeometry(curve, 28, 0.0028, 6), inkM[i]);
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 12), M.led.clone());
  led.position.set(0.152, 1.272, 0.1235); carriage.add(led);
  const uvLight = new THREE.PointLight(0x7b4dff, 1.6, 0.9, 2);
  uvLight.position.set(0, 1.095, -0.01); carriage.add(uvLight);
  printer.add(carriage);

  /* ---------- Chaîne porte-câbles en U (maillons + faisceau de tubes visibles) ---------- */
  const CHAIN_R = 0.045, ANCHOR_X = 0.07, CHAIN_Y = 1.4065, CHAIN_Z = -0.03;
  const CHAIN_L = 1.64 + ANCHOR_X + PI * CHAIN_R + 0.02;   // la boucle reste hors des tours (x < 1.77)
  const LINKS = Math.round(CHAIN_L / 0.04), PITCH = CHAIN_L / LINKS;
  const linkGeo = mergeGeometries([
    new RoundedBoxGeometry(0.038, 0.026, 0.005, 1, 0.002).translate(0, 0, 0.0325),
    new RoundedBoxGeometry(0.038, 0.026, 0.005, 1, 0.002).translate(0, 0, -0.0325),
    new THREE.BoxGeometry(0.012, 0.004, 0.06).translate(0, 0.011, 0),
    new THREE.BoxGeometry(0.012, 0.004, 0.06).translate(0, -0.011, 0)
  ].map(g => g.index ? g.toNonIndexed() : g));
  const chain = new THREE.InstancedMesh(linkGeo, M.dark, LINKS);
  chain.castShadow = true; printer.add(chain);
  const bundleGeo = mergeGeometries(INKS.map((c, i) => {
    const g = new THREE.CylinderGeometry(0.0034, 0.0034, PITCH * 1.04, 8, 1, true).rotateZ(PI / 2)
      .translate(0, (i % 2 - 0.5) * 0.008, (Math.floor(i / 2) - 1) * 0.012);
    const col = new THREE.Color(c === 0x141416 ? 0x2a2b30 : c), n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, k) => col.toArray()[k % 3]), 3));
    return g;
  }));
  const bundle = new THREE.InstancedMesh(bundleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 }), LINKS);
  printer.add(bundle);
  const dummy = new THREE.Object3D();
  function updateChain(hx) {
    const xb = (CHAIN_L - PI * CHAIN_R + ANCHOR_X + hx) / 2;
    const lower = xb - ANCHOR_X;
    for (let i = 0; i < LINKS; i++) {
      const d = (i + 0.5) * PITCH;
      if (d < lower) { dummy.position.set(ANCHOR_X + d, CHAIN_Y, CHAIN_Z); dummy.rotation.set(0, 0, 0); }
      else if (d < lower + PI * CHAIN_R) {
        const a = (d - lower) / CHAIN_R;
        dummy.position.set(xb + CHAIN_R * Math.sin(a), CHAIN_Y + CHAIN_R - CHAIN_R * Math.cos(a), CHAIN_Z);
        dummy.rotation.set(0, 0, a);
      } else { dummy.position.set(xb - (d - lower - PI * CHAIN_R), CHAIN_Y + 2 * CHAIN_R, CHAIN_Z); dummy.rotation.set(0, 0, PI); }
      dummy.updateMatrix(); chain.setMatrixAt(i, dummy.matrix); bundle.setMatrixAt(i, dummy.matrix);
    }
    chain.instanceMatrix.needsUpdate = true; bundle.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Assemblage final ---------- */
  S.flush(); C.flush();
  screwMesh(screwsS, printer); screwMesh(screwsC, carriage);
  updateChain(0);

  let lastScreen = -1;
  function update(t, hx) {
    carriage.position.x = hx;
    updateChain(hx);
    led.material.emissiveIntensity = 2.5 + Math.sin(t * 8) * 1.5;
    ledData.emissiveIntensity = (t * 6) % 1 < 0.55 ? 3 : 0.3;
    if (t - lastScreen > 0.5 || t < lastScreen) { drawScreen((t % 60) / 60); lastScreen = t; }
  }

  return { printer, carriage, update, PLATEN_Y, MEDIA_W };
}
