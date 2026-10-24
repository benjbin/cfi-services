/* ==========================================================================
   CFI — Hero 3D : une imprimante grand format modélisée et rendue en temps réel
   La bâche s'imprime vraiment, passe après passe, sous la tête d'impression ;
   la caméra suit un plan-séquence piloté par le scroll et la souris.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('hero3d');
if (canvas) init().catch(err => { console.error(err); document.documentElement.classList.add('no-webgl'); });

async function init() {
  /* ---------- Rendu ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const mobile = matchMedia('(max-width: 900px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#0b0a0d');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 7, 18);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.03, 60);

  /* ---------- Matériaux ---------- */
  const M = {
    white: new THREE.MeshPhysicalMaterial({ color: 0xd6d8dc, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.8 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: 0.3, metalness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.07, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }),
    roll: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.75 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x0e0d10, roughness: 0.42, metalness: 0.15 }),
    uv: new THREE.MeshStandardMaterial({ color: 0x220a55, emissive: 0x7a4dff, emissiveIntensity: 5 }),
    led: new THREE.MeshStandardMaterial({ color: 0x0a2a14, emissive: 0x2bff8a, emissiveIntensity: 4 })
  };
  const inkMat = hex => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });

  const box = (w, h, d, r, mat, x, y, z) => {
    const m = new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const cyl = (r, len, mat, x, y, z, axis = 'x', seg = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };

  /* ---------- Machine ---------- */
  const PLATEN_Y = 1.08;
  const MEDIA_W = 3.2;
  const printer = new THREE.Group();
  scene.add(printer);

  // Pieds, traverses, roulettes
  [-1.5, 1.5].forEach(x => {
    printer.add(box(0.08, 0.8, 0.46, 0.02, M.dark, x, 0.44, -0.08));
    printer.add(box(0.12, 0.05, 0.78, 0.015, M.graphite, x, 0.045, -0.08));
    [-0.4, 0.24].forEach(z => printer.add(cyl(0.032, 0.03, M.rubber, x, 0.032, z, 'x')));
  });
  printer.add(cyl(0.024, 3.0, M.graphite, 0, 0.32, -0.12, 'x'));
  printer.add(cyl(0.018, 3.0, M.graphite, 0, 0.62, -0.3, 'x'));

  // Corps et tours latérales
  printer.add(box(3.56, 0.26, 0.62, 0.035, M.white, 0, 0.93, -0.06));
  [-1, 1].forEach(s => {
    printer.add(box(0.34, 0.66, 0.88, 0.045, M.white, s * 1.94, 1.1, -0.07));
    printer.add(box(0.36, 0.05, 0.9, 0.02, M.dark, s * 1.94, 0.78, -0.07));
  });
  // Poutre supérieure (capot du chariot) + liseré sombre
  printer.add(box(3.9, 0.25, 0.3, 0.045, M.white, 0, 1.5, -0.22));
  printer.add(box(3.86, 0.03, 0.28, 0.01, M.dark, 0, 1.37, -0.22));

  // Platine perforée (aspiration)
  const platenTex = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#121315';
    for (let y = 4; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  });
  platenTex.wrapS = platenTex.wrapT = THREE.RepeatWrapping; platenTex.repeat.set(14, 2);
  printer.add(box(3.42, 0.03, 0.52, 0, new THREE.MeshStandardMaterial({ map: platenTex, roughness: 0.55, metalness: 0.5 }), 0, PLATEN_Y - 0.017, -0.02));

  // Rails chromés + règle d'encodeur
  printer.add(cyl(0.013, 3.75, M.chrome, 0, 1.25, -0.11, 'x'));
  printer.add(cyl(0.013, 3.75, M.chrome, 0, 1.33, -0.11, 'x'));
  const encoder = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 0.012), new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85 }));
  encoder.position.set(0, 1.29, -0.075); printer.add(encoder);

  // Rouleau de média à l'arrière
  printer.add(cyl(0.09, 3.26, M.roll, 0, 0.94, -0.62, 'x', 48));
  [-1.66, 1.66].forEach(x => printer.add(cyl(0.1, 0.03, M.graphite, x, 0.94, -0.62, 'x', 48)));
  printer.add(cyl(0.018, 3.6, M.chrome, 0, 0.94, -0.62, 'x'));

  // Pupitre : écran émissif sur la tour droite
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 256; screenCanvas.height = 128;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const drawScreen = pct => {
    const g = screenCanvas.getContext('2d');
    g.fillStyle = '#04121c'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#7fe3ff'; g.font = '600 20px "JetBrains Mono", monospace'; g.fillText('IMPRESSION', 16, 34);
    g.fillStyle = '#3aa6c9'; g.font = '14px "JetBrains Mono", monospace'; g.fillText('1440 dpi · CMJN · 4/4', 16, 60);
    g.fillStyle = '#0d3346'; g.fillRect(16, 82, 224, 14);
    g.fillStyle = '#7fe3ff'; g.fillRect(16, 82, 224 * pct, 14);
    g.fillStyle = '#7fe3ff'; g.font = '13px "JetBrains Mono", monospace'; g.fillText(Math.round(pct * 100) + ' %', 16, 116);
    screenTex.needsUpdate = true;
  };
  drawScreen(0.42);
  const panel = new THREE.Group();
  panel.add(box(0.26, 0.17, 0.03, 0.012, M.dark, 0, 0, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.105), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 0.016; panel.add(screen);
  panel.position.set(1.94, 1.26, 0.38); panel.rotation.x = -0.35; printer.add(panel);

  // Marquage CFI sur la tour et la poutre
  const logoTex = canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#6c4092'; g.beginPath(); g.arc(70, 128, 52, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '900 54px Archivo, sans-serif'; g.fillText('cfi', 34, 146);
    g.fillStyle = '#1a1b1e'; g.font = '900 92px Archivo, sans-serif'; g.fillText('CFI', 150, 156);
    g.font = '500 26px "JetBrains Mono", monospace'; g.fillText('S E R V I C E S', 154, 196);
  });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.4 }));
  logo.position.set(1.94, 0.98, 0.371); printer.add(logo);
  const beamTex = canvasTex(1024, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#2a2b30'; g.font = '600 34px "JetBrains Mono", monospace'; g.fillText('CFI SERVICES  ·  GRAND FORMAT  ·  3200 mm', 10, 44);
  });
  const beamLabel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.0875), new THREE.MeshStandardMaterial({ map: beamTex, transparent: true, roughness: 0.4 }));
  beamLabel.position.set(-1.05, 1.53, -0.068); printer.add(beamLabel);

  // Chariot d'impression
  const carriage = new THREE.Group();
  carriage.add(box(0.36, 0.2, 0.28, 0.02, M.graphite, 0, 1.21, -0.01));
  carriage.add(box(0.32, 0.13, 0.02, 0.008, M.white, 0, 1.22, 0.135));
  carriage.add(box(0.31, 0.022, 0.2, 0.004, M.dark, 0, 1.1, -0.01));
  [-0.215, 0.215].forEach(x => carriage.add(box(0.05, 0.045, 0.22, 0.008, M.dark, x, 1.115, -0.01)));
  [-0.215, 0.215].forEach(x => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.006, 0.19), M.uv);
    lamp.position.set(x, 1.091, -0.01); carriage.add(lamp);
  });
  [0x00a0dc, 0xe5007d, 0xffe100, 0x141416].forEach((c, i) => {
    carriage.add(box(0.055, 0.07, 0.15, 0.01, inkMat(c), -0.09 + i * 0.06, 1.345, -0.02));
    carriage.add(box(0.057, 0.012, 0.152, 0.004, M.white, -0.09 + i * 0.06, 1.322, -0.02));
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 12), M.led);
  led.position.set(0.13, 1.26, 0.147); carriage.add(led);
  const uvLight = new THREE.PointLight(0x7b4dff, 1.6, 0.9, 2);
  uvLight.position.set(0, 1.095, -0.01); carriage.add(uvLight);
  printer.add(carriage);

  // Chaîne porte-câbles en U
  const LINKS = 46, CHAIN_L = 2.25, CHAIN_R = 0.045, ANCHOR_X = 0.1, CHAIN_Y = 1.405;
  const chain = new THREE.InstancedMesh(new RoundedBoxGeometry(0.044, 0.024, 0.07, 2, 0.006), M.dark, LINKS);
  chain.castShadow = true; printer.add(chain);
  const dummy = new THREE.Object3D();
  function updateChain(hx) {
    const xb = (CHAIN_L - Math.PI * CHAIN_R + ANCHOR_X + hx) / 2;
    const lower = xb - ANCHOR_X;
    for (let i = 0; i < LINKS; i++) {
      const d = (i + 0.5) / LINKS * CHAIN_L;
      if (d < lower) { dummy.position.set(ANCHOR_X + d, CHAIN_Y, -0.03); dummy.rotation.set(0, 0, 0); }
      else if (d < lower + Math.PI * CHAIN_R) {
        const a = (d - lower) / CHAIN_R;
        dummy.position.set(xb + CHAIN_R * Math.sin(a), CHAIN_Y + CHAIN_R - CHAIN_R * Math.cos(a), -0.03);
        dummy.rotation.set(0, 0, a);
      } else { dummy.position.set(xb - (d - lower - Math.PI * CHAIN_R), CHAIN_Y + 2 * CHAIN_R, -0.03); dummy.rotation.set(0, 0, Math.PI); }
      dummy.updateMatrix(); chain.setMatrixAt(i, dummy.matrix);
    }
    chain.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Visuel imprimé ---------- */
  await Promise.all([document.fonts?.load('900 100px Archivo'), document.fonts?.load('italic 100px "Instrument Serif"'), document.fonts?.load('500 20px "JetBrains Mono"')].map(p => p && p.catch(() => {})));
  const photo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/img/grand-format.jpg'; });
  const ART_W = 2048, ART_H = 1536;
  const artTex = canvasTex(ART_W, ART_H, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#00a0dc'); grad.addColorStop(0.5, '#e5007d'); grad.addColorStop(1, '#ffe100');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    if (photo) {
      const s = Math.max(w / photo.width, h / photo.height);
      g.globalAlpha = 0.92; g.drawImage(photo, (w - photo.width * s) / 2, (h - photo.height * s) / 2, photo.width * s, photo.height * s); g.globalAlpha = 1;
    }
    const shade = g.createLinearGradient(0, 0, w, 0);
    shade.addColorStop(0, 'rgba(10,8,14,.78)'); shade.addColorStop(0.55, 'rgba(10,8,14,.2)'); shade.addColorStop(1, 'rgba(10,8,14,0)');
    g.fillStyle = shade; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = '900 520px Archivo, sans-serif'; g.fillText('CFI', 120, 720);
    g.font = 'italic 190px "Instrument Serif", serif'; g.fillText('On l’imprime.', 130, 1000);
    g.font = '500 44px "JetBrains Mono", monospace'; g.fillText('C F I   S E R V I C E S   ·   I M P R E S S I O N   T O U T   S U P P O R T', 130, 1180);
    ['#00a0dc', '#e5007d', '#ffe100', '#111', '#66c6ea', '#f066b1', '#ffed66', '#777'].forEach((c, i) => { g.fillStyle = c; g.fillRect(130 + i * 70, 1290, 60, 60); });
  });
  artTex.flipY = false; artTex.wrapT = THREE.RepeatWrapping; artTex.needsUpdate = true;
  const ART_LEN = MEDIA_W * ART_H / ART_W;

  /* ---------- Bâche : chemin du média, impression passe par passe ---------- */
  const path = new THREE.CatmullRomCurve3([
    [-0.62, 1.03], [-0.5, 1.07], [-0.27, PLATEN_Y + 0.001], [0, PLATEN_Y + 0.001], [0.2, PLATEN_Y + 0.001],
    [0.285, PLATEN_Y - 0.025], [0.325, PLATEN_Y - 0.13], [0.35, 0.72], [0.39, 0.38], [0.45, 0.1]
  ].map(([z, y]) => new THREE.Vector3(0, y, z)), false, 'catmullrom', 0.3);
  const NS = 260, NX = 48;
  const pts = path.getSpacedPoints(NS);
  const arc = [0];
  for (let i = 1; i <= NS; i++) arc[i] = arc[i - 1] + pts[i].distanceTo(pts[i - 1]);
  let headIdx = 0;
  pts.forEach((p, i) => { if (Math.abs(p.z) < Math.abs(pts[headIdx].z) && p.y > PLATEN_Y - 0.01) headIdx = i; });
  const S_HEAD = arc[headIdx];
  const frontIdx = pts.findIndex(p => p.z > 0.25);
  const S_FRONT = arc[frontIdx];

  const pos = new Float32Array((NX + 1) * (NS + 1) * 3);
  const muv = new Float32Array((NX + 1) * (NS + 1) * 2);
  const uvs = new Float32Array((NX + 1) * (NS + 1) * 2);
  const idx = [];
  for (let j = 0; j <= NS; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i, u = i / NX;
    pos.set([(u - 0.5) * MEDIA_W, pts[j].y, pts[j].z], k * 3);
    muv.set([u, arc[j]], k * 2); uvs.set([u, j / NS], k * 2);
  }
  for (let j = 0; j < NS; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + NX + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const mediaGeo = new THREE.BufferGeometry();
  mediaGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mediaGeo.setAttribute('mediaUv', new THREE.BufferAttribute(muv, 2));
  mediaGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  mediaGeo.setIndex(idx); mediaGeo.computeVertexNormals();

  const U = {
    uArt: { value: artTex }, uFeed: { value: 0 }, uFn: { value: 0 }, uBand: { value: 0.034 },
    uSHead: { value: S_HEAD }, uSFront: { value: S_FRONT }, uHeadU: { value: 0 }, uDir: { value: 1 },
    uArtLen: { value: ART_LEN }, uTime: { value: 0 }
  };
  const mediaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide });
  mediaMat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 mediaUv; varying vec2 vMediaUv; uniform float uTime; uniform float uSFront;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vMediaUv = mediaUv;
float hang = max(mediaUv.y - uSFront, 0.);
transformed.z += sin(uTime * .8 + mediaUv.y * 3.2 + mediaUv.x * 2.2) * .014 * hang;
transformed.x += sin(uTime * .5 + mediaUv.y * 2.) * .004 * hang;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vMediaUv; uniform sampler2D uArt;
uniform float uFeed, uFn, uBand, uSHead, uHeadU, uDir, uArtLen;`)
      .replace('#include <map_fragment>', `
float cc = uFeed - (vMediaUv.y - uSHead);
float printed = step(cc, uFn - uBand);
float inBand = step(uFn - uBand, cc) * step(cc, uFn);
float swept = uDir > 0. ? step(vMediaUv.x, uHeadU) : step(uHeadU, vMediaUv.x);
printed = max(printed, inBand * swept);
vec3 artC = texture2D(uArt, vec2(vMediaUv.x, fract(-cc / uArtLen))).rgb;
diffuseColor.rgb = mix(vec3(.78, .78, .77), artC, printed);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, .32, printed);`);
  };
  const media = new THREE.Mesh(mediaGeo, mediaMat);
  media.castShadow = true; media.receiveShadow = true;
  printer.add(media);

  /* ---------- Sol, lumières, poussière ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const key = new THREE.SpotLight(0xfff1e0, 38, 14, 0.62, 0.7, 2);
  key.position.set(2.6, 4.6, 3.2); key.target.position.set(0, 1, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.4); rim.position.set(-4, 3, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xff4fa8, 3, 7, 2); fill.position.set(-2.6, 1.4, 2.2); scene.add(fill);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff6ea, toneMapped: false }));
  strip.position.set(0, 1.372, -0.08); printer.add(strip);
  const stripLight = new THREE.PointLight(0xfff2e2, 0.6, 1.2, 2); stripLight.position.set(0, 1.33, 0.05); printer.add(stripLight);

  const DUST = 420;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) dp.set([(Math.random() - 0.5) * 7, 1.7 + Math.random() * 1.6, -0.6 - Math.random() * 3], i * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe9d0, size: 0.012, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ---------- Post-traitement ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.35, 0.98);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Plan-séquence caméra ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = [
    { pos: V(3.5, 2.1, 4.1), tgt: V(-1.35, 0.95, 0), fov: 30, follow: 0 },      // plan d'ouverture : la machine à droite, le texte à gauche
    { pos: V(2.45, 1.3, 0.8), tgt: V(0.25, 1.1, 0), fov: 30, follow: 0 },       // rasant le long de la platine
    { pos: V(1.0, 1.45, 1.0), tgt: V(0, 1.17, -0.02), fov: 30, follow: 1 },     // gros plan qui suit la tête d'impression
    { pos: V(0, 0.52, 2.6), tgt: V(0, 1.02, 0), fov: 36, follow: 0 }            // contre-plongée sur la bâche imprimée
  ];
  const INTRO = { pos: V(-1.6, 2.7, 5.2), tgt: V(0, 1, 0), fov: 34 };
  const state = { p: 0, intro: 0, mx: 0, my: 0, smx: 0, smy: 0, running: true, visible: true };
  const ease = t => t * t * (3 - 2 * t);
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0);

  function shotAt(p) {
    const f = Math.min(SHOTS.length - 1.0001, Math.max(0, p * (SHOTS.length - 1)));
    const i = Math.floor(f), t = ease(f - i);
    const a = SHOTS[i], b = SHOTS[i + 1];
    const follow = (a.follow + (b.follow - a.follow) * t) * carriage.position.x * 0.85;
    const pos = a.pos.clone().lerp(b.pos, t), tgt = a.tgt.clone().lerp(b.tgt, t);
    pos.x += follow; tgt.x += follow;
    return { pos, tgt, fov: a.fov + (b.fov - a.fov) * t };
  }

  /* ---------- Taille ---------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    composer.setSize(r.width, r.height);
    bloom.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* ---------- Animation ---------- */
  const PASS_T = 1.3, HEAD_X = 1.64, N0 = 60;
  const clock = new THREE.Clock();
  let lastScreen = 0;

  function frame() {
    requestAnimationFrame(frame);
    if (!state.running || !state.visible) return;
    const t = state.fixedT ?? clock.getElapsedTime();

    // Tête : aller-retour avec décélération en bout de course ; avance du média à chaque passe
    const n = Math.floor(t / PASS_T), ph = t / PASS_T - n;
    const dir = n % 2 ? -1 : 1;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, ph / 0.9));
    const hx = dir > 0 ? -HEAD_X + 2 * HEAD_X * e : HEAD_X - 2 * HEAD_X * e;
    carriage.position.x = hx;
    updateChain(hx);
    const band = U.uBand.value, fn = (N0 + n) * band;
    const step = Math.min(1, Math.max(0, (ph - 0.9) / 0.1));
    U.uFn.value = fn;
    U.uFeed.value = fn + ease(step) * band;
    U.uHeadU.value = (hx + MEDIA_W / 2) / MEDIA_W;
    U.uDir.value = dir;
    U.uTime.value = t;
    led.material.emissiveIntensity = 2.5 + Math.sin(t * 8) * 1.5;
    if (t - lastScreen > 0.5) { drawScreen((t % 60) / 60); lastScreen = t; }
    dust.rotation.y = t * 0.01; dust.position.y = Math.sin(t * 0.2) * 0.05;

    // Caméra : intro depuis le noir, puis plan-séquence au scroll, avec parallaxe souris et respiration
    state.smx += (state.mx - state.smx) * 0.05;
    state.smy += (state.my - state.smy) * 0.05;
    const s = shotAt(state.p);
    const k = ease(Math.min(1, state.intro));
    camPos.copy(INTRO.pos).lerp(s.pos, k);
    camTgt.copy(INTRO.tgt).lerp(s.tgt, k);
    const dist = camPos.distanceTo(camTgt);
    camPos.x += (state.smx * 0.09 + Math.sin(t * 0.21) * 0.025) * dist;
    camPos.y += (-state.smy * 0.05 + Math.sin(t * 0.17) * 0.012) * dist;
    // en portrait, la machine reste centrée au-dessus du texte
    if (camera.aspect < 0.9) { const w = 1 - Math.min(1, state.p * 3); camTgt.x += w * 1.1; camTgt.y -= w * 0.95; }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    const portrait = camera.aspect < 0.9 ? 1.6 : 1;
    camera.fov = (INTRO.fov + (s.fov - INTRO.fov) * k) * portrait;
    camera.updateProjectionMatrix();

    composer.render();
  }

  // L'intro démarre quand le loader a disparu
  const startIntro = () => {
    canvas.classList.add('is-ready');
    const t0 = performance.now();
    const tick = () => { state.intro = Math.min(1, (performance.now() - t0) / 3200); if (state.intro < 1) requestAnimationFrame(tick); };
    tick();
  };
  if (!document.body.classList.contains('is-loading')) startIntro();
  else new MutationObserver((_, obs) => { if (!document.body.classList.contains('is-loading')) { obs.disconnect(); startIntro(); } })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

  frame();

  window.CFIHero3D = {
    setProgress(p) { state.p = p; },
    setPointer(nx, ny) { state.mx = nx; state.my = ny; },
    setRunning(v) { state.visible = v; },
    skipIntro() { state.intro = 1; canvas.classList.add('is-ready'); },
    freeze(t) { state.fixedT = t; }
  };
}
