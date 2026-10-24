/* Environnement, lumières, sol, atmosphère.
   Contrat : setupLighting(THREE, renderer, scene, { M }) → { update(t) }
   Exposition attendue : renderer.toneMappingExposure = 1 (ACES). Les intensités sont en unités
   physiques three (candela / lux / nit). Un blanc de capot face au key ≈ 0.5 linéaire : pas de brûlure. */
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Appuis au sol (cf. model.js) : traverses des pieds en x = ±1.5, roulettes en z = −0.4 / 0.24
const FEET_X = [-1.99, 1.99], FEET_Z = -0.08, WHEELS_Z = [-0.494, 0.286];
// Key : position, cible, ouverture (partagés par la lumière, le faisceau et la poussière)
const KEY_POS = [3.2, 5.2, 4.0], KEY_TGT = [0, 1, 0], KEY_ANGLE = 0.5;

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

/* Tache floue arrondie (ombre portée d'un rectangle hors cadre : shadowBlur marche partout) */
function blobTexture(THREE, w, h, rw, rh, blur) {
  const c = canvas(w, h, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.shadowColor = '#fff'; g.shadowBlur = blur; g.shadowOffsetX = W * 2;
    g.fillStyle = '#fff';
    const x = (W - rw) / 2 - W * 2, y = (H - rh) / 2, r = Math.min(rw, rh) / 2;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, rw, rh, r) : g.rect(x, y, rw, rh); g.fill();
  });
  return new THREE.CanvasTexture(c);
}

/* Studio procédural pour PMREM : boîte noire + softboxes émissives (réflexions nettes, bords doux) */
function studioEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030304);
  const soft = new THREE.CanvasTexture(canvas(256, 256, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.shadowColor = '#fff'; g.shadowBlur = 18; g.shadowOffsetX = W * 2; g.fillStyle = '#fff';
    g.fillRect(22 - W * 2, 22, W - 44, H - 44);
  }));
  soft.colorSpace = THREE.SRGBColorSpace;
  const box = (w, h, pos, hex, lum) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: soft, color: new THREE.Color(hex).multiplyScalar(lum), side: THREE.DoubleSide, fog: false }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  const kd = new THREE.Vector3(...KEY_POS).sub(new THREE.Vector3(...KEY_TGT)).normalize().multiplyScalar(6);
  box(3.4, 2.4, kd.toArray(), 0xfff1e2, 2.4);            // grande boîte du key
  box(7.0, 0.55, [0, 6, 1.2], 0xffffff, 1.8);            // bande zénithale : le filet net sur la poutre
  box(0.5, 3.6, [-1.6, 1.6, 6], 0xfff6ee, 1.0);          // bandes verticales face machine
  box(0.35, 3.6, [-3.6, 1.4, 5.2], 0xfff6ee, 0.7);
  box(0.6, 4.2, [-4.5, 2.4, -4.2], 0xdfe8ff, 2.0);       // contre-jour froid
  box(0.5, 3.2, [5, 2, -3], 0xffe6cc, 1.1);              // contre-jour chaud
  box(2.2, 2.2, [-6, 0.8, 1.6], 0xff2d8f, 0.3);          // touches de marque
  box(2.2, 2.2, [6, 0.6, -1], 0x2dc8ff, 0.25);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x0b0a0d }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.6; env.add(ground);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.012, 0.1, 50);
  pmrem.dispose();
  env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  soft.dispose();
  return rt.texture;
}

export function setupLighting(THREE, renderer, scene, { M }) {
  const BG = new THREE.Color('#0b0a0d');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 8.5, 22);
  // NB : scene.environmentIntensity n'existe qu'à partir de r163 → dosage via envMapIntensity des matériaux
  scene.environment = studioEnvironment(THREE, renderer);

  /* ---------- Sol + occlusion de contact ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const decal = (tex, w, d, x, z, opacity, y = 0.0015) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
      color: 0x000000, alphaMap: tex, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; scene.add(m);
  };
  // halo large sous toute la machine (lumière d'ambiance masquée par le corps)
  decal(blobTexture(THREE, 512, 256, 330, 90, 70), 5.6, 2.2, 0, -0.2, 0.55);
  // sous chaque pied : traverse + roulettes, plus serré et plus sombre
  const footTex = blobTexture(THREE, 128, 256, 34, 170, 26);
  const wheelTex = blobTexture(THREE, 64, 64, 18, 18, 10);
  FEET_X.forEach(x => {
    decal(footTex, 0.42, 1.25, x, FEET_Z, 0.8, 0.002);
    WHEELS_Z.forEach(z => decal(wheelTex, 0.16, 0.16, x, z, 0.9, 0.0025));
  });

  /* ---------- Éclairage 3 points ---------- */
  // Key : grand spot chaud, pénombre très douce, seule ombre de la scène
  const key = new THREE.SpotLight(0xfff0e0, 70, 0, KEY_ANGLE, 0.9, 2);
  key.position.set(...KEY_POS); key.target.position.set(...KEY_TGT);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2; key.shadow.camera.far = 14;   // plage serrée = précision de profondeur
  key.shadow.bias = -0.00015; key.shadow.normalBias = 0.018;
  scene.add(key, key.target);
  // Contre-jours : froid haut-gauche (détoure la poutre), chaud bas-droit (arêtes des tours)
  const rim = new THREE.DirectionalLight(0xa9c4ff, 2.4); rim.position.set(-3.5, 3.2, -4.5); scene.add(rim);
  const kick = new THREE.DirectionalLight(0xffe2c8, 1.0); kick.position.set(4.5, 2.2, -3); scene.add(kick);
  // Fill de marque, discret
  const fillM = new THREE.PointLight(0xff3d9a, 4, 10, 2); fillM.position.set(-3.2, 1.3, 2.8); scene.add(fillM);
  const fillC = new THREE.PointLight(0x3cc8ff, 3, 10, 2); fillC.position.set(3.6, 0.5, -2.0); scene.add(fillC);

  // Lueur sous la poutre : barre LED visible + RectAreaLight orientée vers la platine
  RectAreaLightUniformsLib.init();
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.01, 0.02),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6ea).multiplyScalar(2.2) }));
  strip.position.set(0, 1.372, -0.08); scene.add(strip);
  const bar = new THREE.RectAreaLight(0xfff2e2, 6, 3.4, 0.05);
  bar.position.set(0, 1.352, -0.09); bar.rotation.x = -Math.PI / 2; scene.add(bar);

  /* ---------- Atmosphère ---------- */
  const kp = new THREE.Vector3(...KEY_POS), kAxis = new THREE.Vector3(...KEY_TGT).sub(kp);
  const kLen = kAxis.length() * 1.2; kAxis.normalize();
  // Faisceau volumétrique : cône additif, fondu aux deux bouts, à l'axe et près de la caméra
  const coneGeo = new THREE.ConeGeometry(Math.tan(KEY_ANGLE * 0.85) * kLen, kLen, 48, 1, true);
  coneGeo.translate(0, -kLen / 2, 0);
  const beam = new THREE.Mesh(coneGeo, new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xfff0e0) }, uI: { value: 0.035 }, uLen: { value: kLen } },
    vertexShader: /* glsl */`
      uniform float uLen; varying float vL; varying vec3 vN, vV;
      void main() {
        vL = -position.y / uLen;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uI; varying float vL; varying vec3 vN, vV;
      void main() {
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.5);
        float along = smoothstep(0.02, 0.3, vL) * (1.0 - smoothstep(0.5, 0.95, vL));
        float nearCam = smoothstep(0.8, 2.5, length(vV));
        gl_FragColor = vec4(uColor * (uI * facing * along * nearCam), 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  }));
  beam.position.copy(kp);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), kAxis);
  beam.renderOrder = 2; scene.add(beam);

  // Poussière : fines particules (1–2,5 px), éclairées seulement dans le cône du key,
  // effacées à moins de ~2 m de l'objectif ; placées dans le faisceau ou derrière la machine
  const DUST = 520;
  const dp = new Float32Array(DUST * 3), ds = new Float32Array(DUST);
  const u = new THREE.Vector3(1, 0, 0).cross(kAxis).normalize(), w = kAxis.clone().cross(u);
  for (let i = 0; i < DUST; i++) {
    let p;
    if (i < DUST * 0.6) {
      const a = 0.18 + Math.random() * 0.55, r = Math.sqrt(Math.random()) * Math.tan(KEY_ANGLE * 0.8) * a * kLen, th = Math.random() * 6.283;
      p = kp.clone().addScaledVector(kAxis, a * kLen).addScaledVector(u, Math.cos(th) * r).addScaledVector(w, Math.sin(th) * r);
    } else p = new THREE.Vector3((Math.random() - 0.5) * 7, 0.4 + Math.random() * 2.8, -0.9 - Math.random() * 3);
    dp.set(p.toArray(), i * 3); ds[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(ds, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 5 * renderer.getPixelRatio() },
      uKeyPos: { value: kp }, uKeyDir: { value: kAxis }, uCos: { value: Math.cos(KEY_ANGLE) }
    },
    vertexShader: /* glsl */`
      uniform float uTime, uPx, uCos; uniform vec3 uKeyPos, uKeyDir;
      attribute float seed; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.11 + seed * 40.0) * 0.18, sin(uTime * 0.07 + seed * 23.0) * 0.12, cos(uTime * 0.09 + seed * 31.0) * 0.18);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float inBeam = smoothstep(uCos - 0.02, uCos + 0.06, dot(normalize(p - uKeyPos), uKeyDir));
        float twinkle = 0.6 + 0.4 * sin(uTime * (0.6 + seed) + seed * 50.0);
        vA = (0.12 + 0.88 * inBeam) * twinkle * smoothstep(1.8, 3.2, d);
        gl_PointSize = clamp(uPx / d, 1.0, 2.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.84) * a * 0.9, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false; dust.renderOrder = 3; scene.add(dust);

  return {
    update(t) {
      dustMat.uniforms.uTime.value = t;
      beam.material.uniforms.uI.value = 0.035 * (0.92 + 0.08 * Math.sin(t * 0.35));
    }
  };
}
