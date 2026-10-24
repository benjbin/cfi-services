/* Matériaux de la machine. Contrat : createMaterials(THREE, util) → { M, inkMat }
   M doit contenir au minimum : white, dark, graphite, chrome, rubber, roll, floor, uv, led.
   Micro-détail procédural injecté dans le shader (onBeforeCompile) en coordonnées objet :
   les UV des RoundedBox sont étirées face par face (0→1 sur 3,9 m), une normal map y filerait.
   Le bruit est en mètres, donc à l'échelle réelle quelle que soit la pièce, et s'efface quand
   il devient plus fin que le pixel (pas de scintillement) en se reportant sur la rugosité. */

const GLSL = /* glsl */`
varying vec3 vCfiPos;
const mat3 CFI_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float cfiHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float cfiNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cfiHash(i), cfiHash(i + vec3(1, 0, 0)), f.x), mix(cfiHash(i + vec3(0, 1, 0)), cfiHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cfiHash(i + vec3(0, 0, 1)), cfiHash(i + vec3(1, 0, 1)), f.x), mix(cfiHash(i + vec3(0, 1, 1)), cfiHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float cfiFbm(vec3 p) { return 0.55 * cfiNoise(p) + 0.3 * cfiNoise(CFI_ROT * p * 2.3 + 7.1) + 0.15 * cfiNoise(CFI_ROT * p * 5.9 + 3.7); }
vec3 cfiGrad(vec3 p) {
  float c = cfiNoise(p);
  return vec3(cfiNoise(p + vec3(0.2, 0, 0)) - c, cfiNoise(p + vec3(0, 0.2, 0)) - c, cfiNoise(p + vec3(0, 0, 0.2)) - c) * 5.0;
}
// bump par dérivées écran (même principe que perturbNormalArb de three)
vec3 cfiBump(vec3 sp, vec3 n, vec2 dH, float fd) {
  vec3 sx = dFdx(sp), sy = dFdy(sp);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd;
  return normalize(abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2));
}
`;

const f = v => Number(v).toFixed(5);

/* o : { key, scale:[sx,sy,sz] (cellules/m du relief), tilt (pente du relief), cc (part sur le vernis),
         rough (variation relative de rugosité), roughScale (cellules/m), color (variation d'albédo) } */
function addDetail(mat, o) {
  const s = o.scale, smax = Math.max(...s);
  const tilt = o.tilt || 0, rv = o.rough || 0, cv = o.color || 0, rs = o.roughScale || 3;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCfiPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCfiPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 cfiP = CFI_ROT * (vCfiPos * vec3(${f(s[0])}, ${f(s[1])}, ${f(s[2])}));
        vec3 cfiFw = fwidth(cfiP);
        float cfiAA = 1.0 - smoothstep(0.2, 0.8, max(max(cfiFw.x, cfiFw.y), cfiFw.z));
        float cfiLow = cfiFbm(vCfiPos * ${f(rs)});
        diffuseColor.rgb *= 1.0 + ${f(cv)} * (cfiLow * 2.0 - 1.0);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + ${f(rv)} * (cfiLow * 2.0 - 1.0)) + (1.0 - cfiAA) * ${f(tilt * 1.5)}, 0.03, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 cfiG = cfiGrad(cfiP);
        vec2 cfiDH = vec2(dot(cfiG, dFdx(cfiP)), dot(cfiG, dFdy(cfiP))) * ${f(tilt / smax)} * cfiAA;
        normal = cfiBump(-vViewPosition, normal, cfiDH, faceDirection);`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          clearcoatNormal = cfiBump(-vViewPosition, clearcoatNormal, cfiDH * ${f(o.cc ?? 1)}, faceDirection);
        #endif`);
  };
  mat.customProgramCacheKey = () => 'cfi-' + o.key;
  return mat;
}

export function createMaterials(THREE, util) {
  const M = {
    // Capots : ABS gris très clair, peau d'orange fine (~2 mm) sous un vernis satiné
    white: addDetail(new THREE.MeshPhysicalMaterial({
      color: 0xcdd0d4, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.16, envMapIntensity: 1
    }), { key: 'white', scale: [480, 480, 480], tilt: 0.035, cc: 0.7, rough: 0.12, roughScale: 2.5 }),
    // Plastique noir grainé, mat-satiné
    dark: addDetail(new THREE.MeshStandardMaterial({
      color: 0x16171a, roughness: 0.55, metalness: 0, envMapIntensity: 1
    }), { key: 'dark', scale: [700, 700, 700], tilt: 0.06, rough: 0.15, roughScale: 4 }),
    // Anthracite brossé : anisotropie + stries le long de x
    graphite: addDetail(new THREE.MeshPhysicalMaterial({
      color: 0x3a3c42, roughness: 0.34, metalness: 0.85, anisotropy: 0.55, anisotropyRotation: 0, envMapIntensity: 1
    }), { key: 'graphite', scale: [6, 900, 900], tilt: 0.025, rough: 0.1, roughScale: 3 }),
    // Chrome : réflectance réaliste (~0.6), à peine dépoli
    chrome: addDetail(new THREE.MeshStandardMaterial({
      color: 0xd2d4d8, roughness: 0.1, metalness: 1, envMapIntensity: 1
    }), { key: 'chrome', scale: [1, 1, 1], tilt: 0, rough: 0.25, roughScale: 6 }),
    rubber: addDetail(new THREE.MeshStandardMaterial({
      color: 0x0d0d0e, roughness: 0.9, envMapIntensity: 0.6
    }), { key: 'rubber', scale: [350, 350, 350], tilt: 0.08, rough: 0.05 }),
    // Papier couché : grain fin + légère variation d'albédo
    roll: addDetail(new THREE.MeshStandardMaterial({
      color: 0xe4e4e0, roughness: 0.78, envMapIntensity: 0.7
    }), { key: 'roll', scale: [1200, 1200, 1200], tilt: 0.04, rough: 0.06, roughScale: 30, color: 0.03 }),
    // Sol résine sombre : rugosité nuageuse (reflets flous qui « respirent »), très léger relief
    floor: addDetail(new THREE.MeshStandardMaterial({
      color: 0x0c0b0e, roughness: 0.3, metalness: 0, envMapIntensity: 0.8
    }), { key: 'floor', scale: [60, 60, 60], tilt: 0.01, rough: 0.55, roughScale: 0.45, color: 0.2 }),
    // Émissifs : au-dessus du seuil du bloom (0.98) sans le saturer
    uv: new THREE.MeshStandardMaterial({ color: 0x1a0840, emissive: 0x7a4dff, emissiveIntensity: 3.2, roughness: 0.4 }),
    led: new THREE.MeshStandardMaterial({ color: 0x0a2a14, emissive: 0x2bff8a, emissiveIntensity: 3, roughness: 0.3 })
  };

  // Cartouches : plastique teinté laqué, vernis épais quasi miroir (une instance par teinte)
  const inks = new Map();
  const inkMat = hex => {
    if (!inks.has(hex)) inks.set(hex, addDetail(new THREE.MeshPhysicalMaterial({
      color: hex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1
    }), { key: 'ink', scale: [500, 500, 500], tilt: 0.02, cc: 0.5, rough: 0.1 }));
    return inks.get(hex);
  };
  return { M, inkMat };
}
