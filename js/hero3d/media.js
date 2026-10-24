/* Média (bâche) : chemin du rouleau à la sortie, impression passe par passe.
   Contrat : await buildMedia(THREE, util, { PLATEN_Y, MEDIA_W }) → { mesh, update(t, head) }
   head = { hx, dir, n, ph } : position x de la tête, sens de la passe (±1), numéro de passe, phase 0→1.
   Le maillage est exprimé dans le repère du Group `printer` (l'orchestrateur l'y ajoute).
   Rendu : vinyle satiné tramé (normal map procédurale), encre posée en soustractif sur le blanc du média,
   encre fraîche brillante qui polymérise derrière la tête, trame CMJN visible de très près seulement,
   bords épais, partie qui pend animée dans le vertex shader (aucun calcul CPU par frame). */
export async function buildMedia(THREE, util, { PLATEN_Y, MEDIA_W }) {
  const { canvasTex } = util;
  const HEAD_X = 1.64;                 // course de la tête (cf. js/hero3d.js)
  const mobile = matchMedia('(max-width: 900px)').matches;

  /* ---------- Visuel imprimé : une copie de bâche + gouttière (traits de coupe, gamme de contrôle) ----------
     Conçu sur 4096 × 1376 (1280 px/m) : visuel 3,12 × 1,00 m, marges latérales 4 cm, gouttière 7,5 cm.
     Le blanc du visuel = pas d'encre : c'est le vinyle qui apparaît (l'encre est appliquée en soustractif). */
  await Promise.all([document.fonts?.load('900 100px Archivo'), document.fonts?.load('italic 100px "Instrument Serif"'), document.fonts?.load('500 20px "JetBrains Mono"')].map(p => p && p.catch(() => {})));
  const photo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/img/grand-format.jpg'; });
  const DW = 4096, DH = 1376, ML = 52, IMG_H = 1280;
  const ART_W = mobile ? 2048 : 4096, ART_H = Math.round(ART_W * DH / DW);
  const artTex = canvasTex(ART_W, ART_H, (g, w) => {
    g.scale(w / DW, w / DW);
    g.fillStyle = '#fff'; g.fillRect(0, 0, DW, DH);
    const X0 = ML, X1 = DW - ML, IW = X1 - X0;
    g.save(); g.beginPath(); g.rect(X0, 0, IW, IMG_H); g.clip();
    // photo à droite (repli : dégradé CMJ)
    const PX = 1500, PW = X1 - PX;
    if (photo) {
      const s = Math.max(PW / photo.width, IMG_H / photo.height);
      g.drawImage(photo, PX + (PW - photo.width * s) / 2, (IMG_H - photo.height * s) / 2, photo.width * s, photo.height * s);
    } else {
      const c = g.createLinearGradient(PX, 0, X1, IMG_H);
      c.addColorStop(0, '#00a0dc'); c.addColorStop(0.5, '#e5007d'); c.addColorStop(1, '#ffe100');
      g.fillStyle = c; g.fillRect(PX, 0, PW, IMG_H);
    }
    // aplat violet de marque, fondu dans la photo
    const v = g.createLinearGradient(X0, 0, 2450, 0);
    v.addColorStop(0, '#3a1d58'); v.addColorStop(0.42, '#6c4092'); v.addColorStop(0.62, 'rgba(108,64,146,.92)'); v.addColorStop(1, 'rgba(108,64,146,0)');
    g.fillStyle = v; g.fillRect(X0, 0, IW, IMG_H);
    const vv = g.createLinearGradient(0, 0, 0, IMG_H);
    vv.addColorStop(0, 'rgba(20,8,32,.28)'); vv.addColorStop(0.5, 'rgba(20,8,32,0)'); vv.addColorStop(1, 'rgba(20,8,32,.35)');
    g.fillStyle = vv; g.fillRect(X0, 0, IW, IMG_H);
    // filets CMJ obliques
    [['#00a0dc', 0], ['#e5007d', 1], ['#ffe100', 2]].forEach(([c, i]) => {
      g.fillStyle = c; g.beginPath();
      const x = 1700 + i * 46; g.moveTo(x, IMG_H); g.lineTo(x + 30, IMG_H); g.lineTo(x + 330, 0); g.lineTo(x + 300, 0); g.fill();
    });
    // typographie (blanc = vinyle nu)
    g.fillStyle = '#fff';
    g.font = '500 40px "JetBrains Mono", monospace';
    g.fillText('I M P R E S S I O N   G R A N D   F O R M A T', 196, 200);
    g.fillRect(196, 232, 120, 6);
    g.font = '900 600px Archivo, sans-serif'; g.fillText('CFI', 168, 790);
    g.font = 'italic 230px "Instrument Serif", serif'; g.fillText('On l’imprime.', 190, 1030);
    g.font = '500 40px "JetBrains Mono", monospace';
    g.fillText('C F I   S E R V I C E S   ·   T O U T   S U P P O R T', 196, 1130);
    ['#00a0dc', '#e5007d', '#ffe100', '#111'].forEach((c, i) => { g.fillStyle = c; g.fillRect(196 + i * 72, 1172, 56, 56); });
    g.restore();

    // gouttière : traits de coupe, gamme de contrôle, repère, infos de job
    const GY = IMG_H, GH = DH - IMG_H;
    g.fillStyle = '#141414';
    [X0, X1].forEach(x => { g.fillRect(x - 1, GY + 8, 2, 30); g.fillRect(x - 1, DH - 38, 2, 30); });
    [0, GY, DH].forEach(y => { g.fillRect(4, y - 1, ML - 14, 2); g.fillRect(X1 + 10, y - 1, ML - 14, 2); });
    const patches = ['#00a0dc', '#e5007d', '#ffe100', '#111111', '#e30613', '#009640', '#2b2a83', '#6c4092',
      '#e6e6e6', '#c8c8c8', '#a0a0a0', '#787878', '#4b4b4b', '#262626'];
    const py = GY + (GH - 34) / 2;
    patches.forEach((c, i) => { g.fillStyle = c; g.fillRect(140 + i * 40, py, 34, 34); });
    g.fillStyle = '#141414'; g.font = '500 22px "JetBrains Mono", monospace';
    g.fillText('CFI SERVICES  ·  BÂCHE PVC 510 g  ·  3200 × 1000 mm  ·  ENCRES UV  ·  CMJN', 760, py + 25);
    g.strokeStyle = '#141414'; g.lineWidth = 2;
    const rx = DW / 2 + 520, ry = GY + GH / 2;
    g.beginPath(); g.arc(rx, ry, 15, 0, Math.PI * 2); g.moveTo(rx - 26, ry); g.lineTo(rx + 26, ry); g.moveTo(rx, ry - 26); g.lineTo(rx, ry + 26); g.stroke();
    g.fillText('ON L’IMPRIME.', DW - 420, py + 25);
  });
  artTex.flipY = false; artTex.wrapT = THREE.RepeatWrapping; artTex.needsUpdate = true;
  const ART_LEN = MEDIA_W * ART_H / ART_W;   // ≈ 1,075 m : une copie remplit presque toute la partie qui pend

  /* ---------- Grain du vinyle : toile polyester enduite (tuile 2,4 cm, fil ≈ 1,5 mm) → normal map ---------- */
  const GT = 256, THREADS = 16, GRAIN_TILE = 0.024;
  const grainTex = canvasTex(GT, GT, (g, w, h) => {
    const rnd = Float32Array.from({ length: w * h }, Math.random), H = new Float32Array(w * h);
    const at = (a, x, y) => a[((y + h) % h) * w + (x + w) % w];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tx = x * THREADS / w, ty = y * THREADS / h;
      const warp = 0.5 - 0.5 * Math.cos(2 * Math.PI * tx), weft = 0.5 - 0.5 * Math.cos(2 * Math.PI * ty);
      const over = (Math.floor(tx) + Math.floor(ty)) & 1 ? warp : weft;   // dessus / dessous du tissage
      let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) n += at(rnd, x + i, y + j);
      H[y * w + x] = 0.25 * (warp + weft) + 0.3 * over + 0.35 * n / 9;
    }
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (at(H, x + 1, y) - at(H, x - 1, y)) * 2.2, dy = (at(H, x, y + 1) - at(H, x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  grainTex.flipY = false; grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.needsUpdate = true;

  /* ---------- Chemin du média ---------- */
  const path = new THREE.CatmullRomCurve3([
    [-0.62, 1.03], [-0.5, 1.07], [-0.27, PLATEN_Y + 0.001], [0, PLATEN_Y + 0.001], [0.2, PLATEN_Y + 0.001],
    [0.285, PLATEN_Y - 0.025], [0.325, PLATEN_Y - 0.13], [0.35, 0.72], [0.39, 0.38], [0.45, 0.1]
  ].map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'catmullrom', 0.3);
  const NS = 260, NX = 64;
  const pts = path.getSpacedPoints(NS);
  const nrm = pts.map((_, j) => { const T = path.getTangentAt(j / NS); return [0, T.z, -T.y]; });   // N = T × X
  const arc = [0];
  for (let i = 1; i <= NS; i++) arc[i] = arc[i - 1] + pts[i].distanceTo(pts[i - 1]);
  let headIdx = 0;
  pts.forEach((p, i) => { if (Math.abs(p.z) < Math.abs(pts[headIdx].z) && p.y > PLATEN_Y - 0.01) headIdx = i; });
  const S_HEAD = arc[headIdx];
  const S_FRONT = arc[pts.findIndex(p => p.z > 0.25)];

  // colonnes resserrées vers les bords (edge curl) ; + 2 bandes de tranche (épaisseur) sur les bords
  const colU = Array.from({ length: NX + 1 }, (_, i) => 0.5 * (i / NX) + 0.5 * (0.5 - 0.5 * Math.cos(Math.PI * i / NX)));
  const NV = (NX + 1) * (NS + 1) + 4 * (NS + 1);
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), muv = new Float32Array(NV * 2), uvs = new Float32Array(NV * 2), edg = new Float32Array(NV * 2);
  const idx = [];
  let v = 0;
  const vert = (u, j, side, depth) => {
    pos.set([(u - 0.5) * MEDIA_W, pts[j].y, pts[j].z], v * 3); nor.set(nrm[j], v * 3);
    muv.set([u, arc[j]], v * 2); uvs.set([u, j / NS], v * 2); edg.set([side, depth], v * 2);
    return v++;
  };
  for (let j = 0; j <= NS; j++) for (let i = 0; i <= NX; i++) vert(colU[i], j, 0, 0);
  for (let j = 0; j < NS; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + NX + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  [-1, 1].forEach(side => {
    const base = v;
    for (let j = 0; j <= NS; j++) { vert(side < 0 ? 0 : 1, j, side, 0); vert(side < 0 ? 0 : 1, j, side, 1); }
    for (let j = 0; j < NS; j++) {
      const A = base + j * 2, B = A + 1, C = A + 2, D = A + 3;   // face extérieure orientée vers ±X
      if (side < 0) idx.push(A, B, C, B, D, C); else idx.push(A, C, B, B, C, D);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('mediaUv', new THREE.BufferAttribute(muv, 2));
  geo.setAttribute('aEdge', new THREE.BufferAttribute(edg, 2));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 0.05;

  const U = {
    uArt: { value: artTex }, uGrain: { value: grainTex }, uFeed: { value: 0 }, uFn: { value: 0 }, uBand: { value: 0.034 },
    uSHead: { value: S_HEAD }, uSFront: { value: S_FRONT }, uHeadU: { value: 0 }, uDir: { value: 1 }, uPh: { value: 0 },
    uArtLen: { value: ART_LEN }, uTime: { value: 0 }, uMediaW: { value: MEDIA_W }, uThick: { value: 0.0018 },
    uWhite: { value: new THREE.Color(0.86, 0.845, 0.805) },   // blanc vinyle légèrement chaud (linéaire)
    uBack: { value: new THREE.Color(0.74, 0.735, 0.715) }      // dos du média, plus mat
  };

  /* Déformation de la partie qui pend, le long de la normale du chemin (m).
     Partagée par le matériau et les matériaux d'ombre pour que l'ombre suive la bâche. */
  const DISP = `
attribute vec2 mediaUv; attribute vec2 aEdge;
uniform float uTime, uSFront, uMediaW, uThick;
float mediaH(vec2 m) {
  float hang = max(m.y - uSFront, 0.);
  float env = smoothstep(0., .22, hang);
  float x = (m.x - .5) * uMediaW;
  float e = abs(2. * m.x - 1.);
  // ondulation lente : la bâche est lestée par son poids, amplitude croissante vers le bas
  float h = (sin(uTime * .55 + m.y * 2.3 + m.x * 1.2) * .009 + sin(uTime * .31 - m.y * 1.4 + 1.7) * .005) * hang * env;
  // edge curl : bords qui s'enroulent vers l'arrière
  h -= .028 * pow(e, 5.) * env * (.85 + .15 * sin(uTime * .4 + m.y * 1.9));
  // plis de tension sous le bord avant, effacés plus bas par la gravité
  h += .0028 * env * exp(-hang * 1.8) * sin(x * 17. + hang * 6. + sin(x * 2.3) * 2.);
  return h;
}`;

  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${DISP}
varying vec2 vMediaUv; varying vec3 vTanX; varying float vEdge, vHang;`)
      .replace('#include <beginnormal_vertex>', `
vec3 mN = normalize(normal), mX = vec3(1., 0., 0.), mT = normalize(cross(mX, mN));
float mh = mediaH(mediaUv);
float mhx = (mediaH(mediaUv + vec2(.002, 0.)) - mh) / (.002 * uMediaW);
float mhs = (mediaH(mediaUv + vec2(0., .005)) - mh) / .005;
vec3 objectNormal = normalize(mN - mhx * mX - mhs * mT);
vec3 mDisp = mN * mh - objectNormal * (uThick * aEdge.y);
vTanX = normalize(normalMatrix * cross(objectNormal, mT));
if (aEdge.x != 0.) objectNormal = normalize(cross(objectNormal, mT)) * aEdge.x;
vMediaUv = mediaUv; vEdge = abs(aEdge.x);
vHang = smoothstep(0., .15, mediaUv.y - uSFront);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += mDisp;
transformed.x += sin(uTime * .37 + mediaUv.y * 1.3) * .003 * max(mediaUv.y - uSFront, 0.);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vMediaUv; varying vec3 vTanX; varying float vEdge, vHang;
uniform sampler2D uArt, uGrain;
uniform float uFeed, uFn, uBand, uSHead, uHeadU, uDir, uPh, uArtLen, uMediaW;
uniform vec3 uWhite, uBack;
// âge de l'encre (en passes) dans la bande k (0 = bande en cours) : sens alterné, même loi que la tête
float inkAge(float k, float xm) {
  float d = uDir * (mod(k, 2.) < .5 ? 1. : -1.);
  float ex = clamp(d > 0. ? (xm + ${HEAD_X.toFixed(2)}) / ${(2 * HEAD_X).toFixed(2)} : (${HEAD_X.toFixed(2)} - xm) / ${(2 * HEAD_X).toFixed(2)}, 0., 1.);
  return k + uPh - .9 * acos(1. - 2. * ex) / PI;
}
float wetK(float k, float xm) { float a = inkAge(k, xm); return a < 0. ? 0. : exp(-a / 1.15); }
// point de trame : couverture v, angle a, demi-largeur d'antialias w (en cellules)
float hdot(vec2 p, float a, float v, float w) {
  vec2 q = mat2(cos(a), sin(a), -sin(a), cos(a)) * p;
  float r = sqrt(v) * .72;
  return smoothstep(r + w, r - w, length(fract(q) - .5));
}`)
      .replace('#include <map_fragment>', `
// coordonnée matière (m) : liée à la bâche, croît vers l'amont (rouleau)
float cc = uFeed - (vMediaUv.y - uSHead);
float xm = (vMediaUv.x - .5) * uMediaW;
// --- masque imprimé : bandes passées + bande en cours derrière la tête (rien en avant de la tête)
float aw = max(fwidth(cc), 4e-4);
float bandLo = uFn - uBand;
float lo = smoothstep(bandLo - aw, bandLo, cc);
float sw = uDir > 0. ? uHeadU - vMediaUv.x : vMediaUv.x - uHeadU;
float printed = (1. - lo) + lo * (1. - smoothstep(uFn - aw, uFn, cc)) * smoothstep(0., .0015, sw);
printed *= 1. - vEdge;
// --- visuel, appliqué comme une encre (transmittance) sur le blanc du vinyle
vec3 artC = texture2D(uArt, vec2(vMediaUv.x, -cc / uArtLen)).rgb;
float bq = cc / uBand, bf = fract(bq);
float bh = fract(sin(floor(bq) * 12.9898) * 43758.5453);
float dens = 1. + (bh - .5) * .03 + .06 * exp(-pow(min(bf, 1. - bf) * uBand / .0007, 2.));   // banding + micro-chevauchement
vec3 inkC = pow(max(artC, vec3(1e-4)), vec3(dens));
// --- trame CMJN (rosette), visible seulement de très près : fondue selon la taille écran des cellules
vec2 hp = vec2(xm, cc) * 340.;
float hw = length(fwidth(hp));
float hVis = 1. - smoothstep(.12, .34, hw);
if (hVis > 0.) {
  vec3 s = pow(inkC, vec3(1. / 2.2));
  float k = 1. - max(s.r, max(s.g, s.b)), ik = max(1. - k, 1e-3);
  vec3 cmy = clamp((1. - s - k) / ik, 0., 1.);
  float w = hw * .6;
  float dC = hdot(hp, .2618, cmy.x, w), dM = hdot(hp, 1.309, cmy.y, w), dY = hdot(hp, 0., cmy.z, w), dK = hdot(hp, .7854, k, w);
  vec3 ht = (1. - vec3(dC, dM, dY)) * (1. - dK);
  inkC = mix(inkC, pow(ht, vec3(2.2)), hVis * .55);
}
// --- encre fraîche : brillante, un peu plus dense, polymérise en s'éloignant de la tête (fondu entre bandes)
float kb = max(floor((uFn - cc) / uBand), 0.), kf = fract((uFn - cc) / uBand);
float wet = wetK(kb, xm);
wet = mix(wet, wetK(kb + 1., xm), .5 * smoothstep(.8, 1., kf));
wet = mix(wet, wetK(max(kb - 1., 0.), xm), .5 * (1. - smoothstep(0., .2, kf)) * step(.5, kb));
float ink = clamp(1. - min(artC.r, min(artC.g, artC.b)), 0., 1.) * printed;
wet *= ink;
inkC *= 1. - .06 * wet;
vec3 mCol;
if (gl_FrontFacing) mCol = uWhite * mix(vec3(1.), inkC, printed);
else mCol = uBack * mix(vec3(1.), artC, printed * .16);            // dos : le visuel transparaît à peine
mCol = mix(mCol, uWhite * .8, vEdge);                               // tranche
diffuseColor.rgb = mCol;
float mRough = mix(.5, mix(.38, .1, wet / max(ink, 1e-3)), ink);
float mCoat = wet * .9;
float mGrainK = (1. - vEdge) * .32 * mix(1., .5, ink) * (1. - .8 * wet);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = gl_FrontFacing ? mRough : .62;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 mGeoN = normal;
{
  vec3 gn = texture2D(uGrain, vec2(xm, cc) / ${GRAIN_TILE.toFixed(3)}).xyz * 2. - 1.;
  vec3 tX = normalize(vTanX - dot(vTanX, normal) * normal), tY = cross(normal, tX);
  normal = normalize(normal + (gn.x * tX + gn.y * tY) * mGrainK);
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// rétroéclairage léger de la partie qui pend (lumière venant de l'arrière-haut, filtrée par l'encre)
{
  vec3 Lb = normalize((viewMatrix * vec4(-.5, .45, -.74, 0.)).xyz);
  totalEmissiveRadiance += mCol * .07 * vHang * (1. - vEdge) * max(dot(-mGeoN, Lb), 0.) * float(gl_FrontFacing);
}`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= gl_FrontFacing ? mCoat : 0.;
#endif`);
  };

  // Ombres : même déformation que le matériau
  const shadowInject = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${DISP}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed += normalize(normal) * (mediaH(mediaUv) - uThick * aEdge.y);`);
  };
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = shadowInject;
  const distMat = new THREE.MeshDistanceMaterial();
  distMat.onBeforeCompile = shadowInject;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.customDepthMaterial = depthMat; mesh.customDistanceMaterial = distMat;
  mesh.castShadow = true; mesh.receiveShadow = true;

  const N0 = 60;
  const ease = t => t * t * (3 - 2 * t);
  function update(t, { hx, dir, n, ph }) {
    const band = U.uBand.value, fn = (N0 + n) * band;
    const step = Math.min(1, Math.max(0, (ph - 0.9) / 0.1));
    U.uFn.value = fn;
    U.uFeed.value = fn + ease(step) * band;
    U.uHeadU.value = (hx + MEDIA_W / 2) / MEDIA_W;
    U.uDir.value = dir;
    U.uPh.value = ph;
    U.uTime.value = t;
  }

  return { mesh, update };
}
