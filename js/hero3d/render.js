/* Moteur de rendu, post-traitement et plan-séquence caméra.
   Contrats :
   - createWebGLRenderer(THREE, canvas, { mobile }) → renderer
   - createPipeline(THREE, renderer, scene, camera) → { setSize(w, h), render(t, cam) }
     cam : objet renvoyé par rig.update() ({ focus, dof, fov, shot }), peut être {}.
   - createCameraRig(THREE, camera) → { update(t, { p, intro, mx, my, carriageX }) → cam }
     p : progression du scroll 0→1 ; intro : 0→1 ; mx, my : pointeur lissé −1→1 ; carriageX : x du chariot.

   Chaîne (bureau) : scène MSAA HDR → G-buffer (normales + profondeur) → GTAO → profondeur de champ
   → bloom (émissifs) → ACES + sRGB → pellicule (étalonnage, aberration, vignettage, grain).
   Mobile : scène MSAA → bloom → ACES → pellicule. Qualité adaptative selon le temps de frame. */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

const OPTS = new WeakMap();   // options du moteur (mobile) transmises au pipeline

export function createWebGLRenderer(THREE, canvas, { mobile }) {
  // pas d'antialias natif : l'AA est fait dans le pipeline (MSAA sur la cible HDR, sinon SMAA)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;   // marge pour les capots blancs ; l'épaule finale fait le reste
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  OPTS.set(renderer, { mobile: !!mobile });
  return renderer;
}

/* ---------- Shaders ---------- */
const DOF_SHADER = {
  defines: { SAMPLES: 24 },
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, resolution: { value: null },
    cameraNear: { value: 0.1 }, cameraFar: { value: 60 }, focus: { value: 3 }, strength: { value: 0 }, maxCoC: { value: 7 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 resolution;
    uniform float cameraNear, cameraFar, focus, strength, maxCoC;
    varying vec2 vUv;
    float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
    // cercle de confusion (px) d'une lentille mince : ∝ |1 − mise au point / profondeur|
    float coc(float z) { return clamp(abs(1.0 - focus / max(z, 1e-3)) * strength, 0.0, 1.0) * maxCoC; }
    void main() {
      vec4 c0 = texture2D(tDiffuse, vUv);
      float z0 = viewDepth(vUv), r0 = coc(z0);
      if (r0 < 0.5) { gl_FragColor = c0; return; }
      // spirale dorée tournée par pixel (bruit entrelacé) : pas d'anneaux visibles
      float rot = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
      vec3 acc = c0.rgb; float wsum = 1.0;
      for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / float(SAMPLES)) * r0;
        float a = fi * 2.3999632 + rot;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolution;
        float z = viewDepth(uv);
        // un premier plan net ne bave pas sur un arrière-plan flou
        float w = z < z0 - 0.03 ? smoothstep(r - 1.0, r + 1.0, coc(z)) : 1.0;
        acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, c0.a);
    }`
};

const FILM_SHADER = {
  uniforms: {
    tDiffuse: { value: null }, resolution: { value: null }, time: { value: 0 },
    grain: { value: 0.022 }, vignette: { value: 0.3 }, ca: { value: 0.0035 },
    contrast: { value: 0.16 }, lift: { value: 0.012 }, liftTint: { value: null }
  },
  vertexShader: DOF_SHADER.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 resolution;
    uniform float time, grain, vignette, ca, contrast, lift; uniform vec3 liftTint;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 d = vUv - 0.5;
      vec2 da = d * vec2(resolution.x / resolution.y, 1.0);
      float r2 = dot(da, da);
      // aberration chromatique latérale : nulle au centre, ~3 px dans les coins
      vec2 off = d * ca * r2;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c = clamp(c, 0.0, 1.0);
      // contraste filmique (courbe en S douce)
      c = mix(c, c * c * (3.0 - 2.0 * c), contrast);
      // épaule : les hautes lumières s'arrondissent au lieu de brûler (blanc max ≈ 0.93)
      vec3 hi = 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2));
      c = mix(c, hi, step(0.8, c));
      // virage : ombres froides/violettes, hautes lumières légèrement chaudes
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(vec3(0.985, 0.99, 1.03), vec3(1.02, 1.0, 0.965), smoothstep(0.15, 0.85, l));
      // noirs relevés et teintés
      c = c * (1.0 - lift) + lift * liftTint;
      // vignettage doux
      c *= 1.0 - vignette * smoothstep(0.35, 1.05, sqrt(r2));
      // grain fin, cadence 24 i/s, plus présent dans les tons moyens ; sert aussi de tramage
      vec2 seed = gl_FragCoord.xy + mod(floor(time * 24.0), 997.0) * vec2(17.13, 31.71);
      float n = hash(seed) + hash(seed + 71.7) - 1.0;
      c += n * grain * (0.35 + 2.6 * l * (1.0 - l));
      gl_FragColor = vec4(c, 1.0);
    }`
};

export function createPipeline(THREE, renderer, scene, camera) {
  const { mobile } = OPTS.get(renderer) || { mobile: false };
  const plain = () => { renderer.setRenderTarget(null); renderer.render(scene, camera); };
  try {
    return buildPipeline(THREE, renderer, scene, camera, mobile);
  } catch (err) {
    console.warn('[hero3d] post-traitement indisponible, rendu direct', err);
    return { setSize() {}, render: plain };
  }
}

function buildPipeline(THREE, renderer, scene, camera, mobile) {
  const webgl2 = renderer.capabilities.isWebGL2;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const res = new THREE.Vector2(size.x, size.y);
  const hdr = { type: THREE.HalfFloatType };

  /* Scène : rendue dans une cible HDR multi-échantillonnée, puis résolue dans le composer
     (le MSAA reste confiné à cette passe ; les passes plein écran travaillent sur des cibles simples). */
  class ScenePass extends Pass {
    constructor() {
      super();
      this.msaa = webgl2 ? new THREE.WebGLRenderTarget(size.x, size.y, { ...hdr, samples: 4 }) : null;
      this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), depthTest: false, depthWrite: false }));
    }
    setSize(w, h) { this.msaa?.setSize(w, h); }
    render(r, writeBuffer) {
      r.setRenderTarget(this.msaa || (this.renderToScreen ? null : writeBuffer));
      r.clear();
      r.render(scene, camera);
      if (!this.msaa) return;
      this.copy.material.uniforms.tDiffuse.value = this.msaa.texture;
      r.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.copy.render(r);
    }
  }

  /* G-buffer partagé par la GTAO et la profondeur de champ (une seule passe de géométrie). */
  class GBufferPass extends Pass {
    constructor() {
      super();
      this.needsSwap = false;
      this.depth = new THREE.DepthTexture(size.x, size.y);
      this.depth.format = THREE.DepthStencilFormat;
      this.depth.type = THREE.UnsignedInt248Type;
      this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, depthTexture: this.depth
      });
      this.normalMat = new THREE.MeshNormalMaterial();
      this.hidden = [];
      this.clear = new THREE.Color();
    }
    setSize(w, h) { this.target.setSize(w, h); }
    render(r) {
      // points et lignes (poussière) ne comptent ni pour l'AO ni pour la mise au point
      scene.traverseVisible(o => { if (o.isPoints || o.isLine) { o.visible = false; this.hidden.push(o); } });
      const auto = r.shadowMap.autoUpdate, bg = scene.background, alpha = r.getClearAlpha();
      r.getClearColor(this.clear);
      r.shadowMap.autoUpdate = false;   // ombres déjà calculées par la passe scène
      scene.background = null; scene.overrideMaterial = this.normalMat;
      r.setRenderTarget(this.target);
      r.setClearColor(0x7777ff, 1); r.clear();
      r.render(scene, camera);
      scene.overrideMaterial = null; scene.background = bg;
      r.shadowMap.autoUpdate = auto;
      r.setClearColor(this.clear, alpha);
      for (const o of this.hidden) o.visible = true;
      this.hidden.length = 0;
    }
  }

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, hdr));
  const scenePass = new ScenePass();
  composer.addPass(scenePass);

  // Occlusion ambiante et profondeur de champ : bureau uniquement
  let gbuf = null, gtao = null, dof = null;
  if (!mobile && webgl2) {
    try {
      gbuf = new GBufferPass();
      composer.addPass(gbuf);
      gtao = new GTAOPass(scene, camera, size.x, size.y);
      gtao.setGBuffer(gbuf.depth, gbuf.target.texture);   // ne refait pas son propre G-buffer
      gtao.updateGtaoMaterial({ radius: 0.2, distanceExponent: 1.4, thickness: 0.6, distanceFallOff: 1, scale: 1, samples: 12, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 16 });
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
    } catch (err) { console.warn('[hero3d] GTAO désactivée', err); gtao = null; }
    try {
      dof = new ShaderPass(DOF_SHADER);
      dof.material.uniforms.tDepth.value = gbuf.depth;
      dof.material.uniforms.resolution.value = res;
      composer.addPass(dof);
    } catch (err) { console.warn('[hero3d] profondeur de champ désactivée', err); dof = null; }
  }

  // Bloom très léger : seuil HDR haut, seuls les émissifs (UV, LED, écran) et rares reflets passent
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.2, 0.42, 0.82);
  bloom.highPassUniforms.smoothWidth.value = 0.25;
  composer.addPass(bloom);

  composer.addPass(new OutputPass());   // ACES + sRGB
  const smaa = webgl2 ? null : new SMAAPass(size.x, size.y);
  if (smaa) composer.addPass(smaa);

  const film = new ShaderPass(FILM_SHADER);
  film.material.uniforms.resolution.value = res;
  film.material.uniforms.liftTint.value = new THREE.Vector3(0.72, 0.78, 1.0);
  composer.addPass(film);

  /* ---------- Garde-fous : un shader qui ne compile pas désactive sa seule passe ---------- */
  const watched = [[dof, () => [dof.material]], [film, () => [film.material]],
    [gtao, () => [gtao.gtaoMaterial, gtao.pdMaterial, gtao.blendMaterial]]].filter(([p]) => p);
  const verified = new Set();
  const broken = m => renderer.properties.get(m)?.currentProgram?.diagnostics?.runnable === false;
  function guard() {
    for (const [pass, mats] of watched) {
      if (verified.has(pass) || !pass.enabled) continue;
      const ms = mats();
      if (ms.some(broken)) { console.warn('[hero3d] passe désactivée (shader)'); pass.enabled = false; pass.failed = true; verified.add(pass); }
      else if (ms.every(m => renderer.properties.get(m)?.currentProgram)) verified.add(pass);
    }
  }

  /* ---------- Qualité adaptative ----------
     3 : complet · 2 : sans AO · 1 : sans DOF, pixel ratio réduit · 0 : sans bloom, pixel ratio 1.
     Mesure le temps de frame (moyenne glissante) ; sous ~45 i/s pendant ~1,2 s → un cran plus bas. */
  const dprMax = renderer.getPixelRatio();
  const devDpr = window.devicePixelRatio || 1;
  let level = mobile || !webgl2 ? 1 : 3;
  const quality = { avg: 1000 / 60, slow: 0, last: 0, settle: 2.5 };

  function applyLevel() {
    if (gtao && !gtao.failed) gtao.enabled = level >= 3;
    if (dof && !dof.failed) dof.dofAllowed = level >= 2;
    bloom.enabled = level >= 1;
    const cap = level >= 2 ? dprMax : level === 1 ? Math.min(dprMax, mobile ? 1.5 : 1.25) : 1;
    const pr = Math.min(devDpr, cap);
    if (Math.abs(pr - renderer.getPixelRatio()) > 0.01) {
      renderer.setPixelRatio(pr);
      composer.setPixelRatio(pr);
      renderer.getDrawingBufferSize(res);
    }
  }
  applyLevel();

  function measure() {
    const now = performance.now(), dt = now - quality.last;
    quality.last = now;
    if (!(dt > 0 && dt < 250)) return;   // onglet masqué, pause, première frame
    if (quality.settle > 0) { quality.settle -= dt / 1000; return; }   // compilation, intro
    quality.avg += (dt - quality.avg) * 0.06;
    quality.slow = quality.avg > 22.2 ? quality.slow + dt / 1000 : Math.max(0, quality.slow - dt / 2000);
    if (quality.slow > 1.2 && level > 0) {
      level--; quality.slow = 0; quality.settle = 1.5; quality.avg = 1000 / 60;
      applyLevel();
    }
  }

  let failed = false;
  return {
    get level() { return level; },
    setSize(w, h) {
      composer.setSize(w, h);
      renderer.getDrawingBufferSize(res);
    },
    render(t = 0, cam = {}) {
      if (failed) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
      measure();
      if (dof) {
        const u = dof.material.uniforms, s = cam.dof ?? 0;
        u.focus.value = cam.focus ?? 4;
        u.strength.value = s * 1.4;
        u.cameraNear.value = camera.near; u.cameraFar.value = camera.far;
        u.maxCoC.value = Math.min(12, 7 * res.y / 1080);
        dof.enabled = !dof.failed && dof.dofAllowed && s > 0.02;
      }
      if (gbuf) gbuf.enabled = !!((gtao && gtao.enabled) || (dof && dof.enabled));
      film.material.uniforms.time.value = t;
      try {
        composer.render();
        if (verified.size < watched.length) guard();
      } catch (err) {
        console.warn('[hero3d] post-traitement interrompu, rendu direct', err);
        failed = true;
        renderer.setRenderTarget(null); renderer.render(scene, camera);
      }
    }
  };
}

/* ---------- Plan-séquence caméra ---------- */
export function createCameraRig(THREE, camera) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // fov vertical (°) ; follow : suivi du chariot ; fp/fc : point de mise au point et poids du chariot ; dof : force du flou
  const SHOTS = [
    { pos: V(3.5, 2.1, 4.1), tgt: V(-1.35, 0.95, 0), fov: 30, follow: 0, fp: V(0.3, 1.05, 0.25), fc: 0, dof: 0.16 },   // ouverture : machine à droite, texte à gauche
    { pos: V(2.45, 1.3, 0.8), tgt: V(0.25, 1.1, 0), fov: 27, follow: 0, fp: V(0.25, 1.1, 0), fc: 0.35, dof: 0.45 },     // rasant le long de la platine
    { pos: V(1.0, 1.45, 1.0), tgt: V(0, 1.17, -0.02), fov: 26, follow: 1, fp: V(0, 1.17, 0), fc: 1, dof: 1 },          // gros plan qui suit la tête d'impression
    { pos: V(0, 0.52, 2.6), tgt: V(0, 1.02, 0), fov: 36, follow: 0, fp: V(0, 1.02, 0), fc: 0, dof: 0.3 }               // contre-plongée sur la bâche imprimée
  ];
  const INTRO = { pos: V(-1.9, 3.0, 6.2), tgt: V(0.1, 1.0, 0), fov: 34 };
  const N = SHOTS.length;

  // trajectoires de grue lissées (Catmull-Rom centripète) passant exactement par chaque plan
  const posCurve = new THREE.CatmullRomCurve3(SHOTS.map(s => s.pos), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(SHOTS.map(s => s.tgt), false, 'centripetal');

  const clamp01 = x => Math.min(1, Math.max(0, x));
  const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);
  // chaque plan « se pose » : léger palier autour des clés, puis départ/arrivée en douceur
  const hold = u => smoother(clamp01((u - 0.08) / 0.84));
  // arrivée : démarrage doux, longue décélération
  const cine = u => { const s = smoother(clamp01(u)); return 1 - (1 - s) * (1 - s); };
  const lerp = (a, b, k) => a + (b - a) * k;

  // amortisseur critique (inertie d'une tête lourde) — renvoie la valeur lissée
  const spring = () => ({ x: 0, v: 0, init: false });
  function damp(s, target, T, dt) {
    if (!s.init || dt <= 0) { s.x = target; s.v = 0; s.init = true; return s.x; }
    const w = 2 / T, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = s.x - target, tmp = (s.v + w * ch) * dt;
    s.v = (s.v - w * tmp) * e;
    s.x = target + (ch + tmp) * e;
    return s.x;
  }

  // bruit de gradient 1D lissé (steadicam) : pas de sinus reconnaissable
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const grad = x => { const i = Math.floor(x), f = x - i, u = smoother(f); return lerp(hash(i) * f, hash(i + 1) * (f - 1), u) * 2; };
  const fbm = (x, seed) => grad(x + seed * 19.7) * 0.7 + grad(x * 2.31 + seed * 7.3) * 0.3;

  const sp = spring(), sFollow = spring(), sFocus = spring();
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0), sPos = V(0, 0, 0), sTgt = V(0, 0, 0);
  const fwd = V(0, 0, 0), right = V(0, 0, 0), up = V(0, 1, 0), tmp = V(0, 0, 0), focusPt = V(0, 0, 0), headPt = V(0, 1.2, 0);
  const sphA = new THREE.Spherical(), sphB = new THREE.Spherical(), offA = V(0, 0, 0), offB = V(0, 0, 0);
  let lastT = null;

  return {
    update(t, { p = 0, intro = 1, mx = 0, my = 0, carriageX = 0 } = {}) {
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;

      // progression du scroll amortie, puis position dans le plan-séquence
      const ps = damp(sp, clamp01(p), 0.45, dt);
      const f = Math.min(N - 1.0001, Math.max(0, ps * (N - 1)));
      const i = Math.floor(f), k = hold(f - i);
      const a = SHOTS[i], b = SHOTS[i + 1];
      const u = (i + k) / (N - 1);
      posCurve.getPoint(u, sPos);
      tgtCurve.getPoint(u, sTgt);
      const fov = lerp(a.fov, b.fov, k), dofAmt = lerp(a.dof, b.dof, k), fc = lerp(a.fc, b.fc, k);

      // suivi du chariot : la caméra panote plus qu'elle ne travelle, avec un temps de retard
      const fx = damp(sFollow, lerp(a.follow, b.follow, k) * carriageX, 0.6, dt);
      sTgt.x += fx * 0.85; sPos.x += fx * 0.6;

      // intro : arrivée en arc (orbite + dolly) depuis le plan lointain
      const ki = cine(intro);
      camTgt.copy(INTRO.tgt).lerp(sTgt, ki);
      sphA.setFromVector3(offA.subVectors(INTRO.pos, INTRO.tgt));
      sphB.setFromVector3(offB.subVectors(sPos, sTgt));
      let dTheta = sphB.theta - sphA.theta;
      if (dTheta > Math.PI) dTheta -= 2 * Math.PI; else if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
      sphA.set(lerp(sphA.radius, sphB.radius, ki), lerp(sphA.phi, sphB.phi, ki), sphA.theta + dTheta * ki);
      camPos.setFromSpherical(sphA).add(camTgt);

      // parallaxe souris discrète, dans le repère de la caméra
      const dist = camPos.distanceTo(camTgt);
      fwd.subVectors(camTgt, camPos).normalize();
      right.crossVectors(fwd, up).normalize();
      camPos.addScaledVector(right, mx * 0.075 * dist).addScaledVector(up, -my * 0.045 * dist);

      // bougé steadicam : dérive lente et organique, proportionnelle à la distance
      const amp = 0.004 * dist + 0.003;
      camPos.x += fbm(t * 0.33, 1) * amp; camPos.y += fbm(t * 0.29, 2) * amp * 0.7; camPos.z += fbm(t * 0.25, 3) * amp * 0.6;
      camTgt.x += fbm(t * 0.41, 4) * amp * 0.35; camTgt.y += fbm(t * 0.37, 5) * amp * 0.3;

      // en portrait, la machine reste centrée au-dessus du texte
      const portrait = camera.aspect < 0.9;
      if (portrait) { const w = 1 - Math.min(1, ps * 3); camTgt.x += w * 1.25; camTgt.y -= w * 1.3; }

      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(camTgt);
      camera.rotateZ(fbm(t * 0.21, 6) * 0.0028);   // roulis à peine perceptible
      camera.fov = lerp(INTRO.fov, fov, ki) * (portrait ? 1.6 : 1);
      camera.updateProjectionMatrix();

      // mise au point : profondeur (axe optique) du point visé, tirée en douceur par un pointeur de mise au point
      headPt.x = carriageX;
      focusPt.lerpVectors(tmp.copy(a.fp).lerp(b.fp, k), headPt, fc);
      fwd.subVectors(camTgt, camPos).normalize();
      const fd = Math.max(0.2, tmp.subVectors(focusPt, camPos).dot(fwd));
      const focus = damp(sFocus, fd, 0.25, dt);

      return { focus, dof: dofAmt * ki, fov: camera.fov, shot: f };
    }
  };
}
