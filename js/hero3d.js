/* ==========================================================================
   CFI — Hero 3D : une imprimante grand format modélisée et rendue en temps réel
   Orchestrateur : assemble les modules de js/hero3d/ et pilote l'animation.
   - render.js    : moteur, post-traitement, plan-séquence caméra
   - lighting.js  : environnement, lumières, sol, atmosphère
   - materials.js : matériaux
   - model.js     : géométrie de la machine et du chariot
   - media.js     : bâche qui s'imprime passe par passe
   ========================================================================== */
import * as THREE from 'three';
import { makeUtil } from './hero3d/util.js';
import { createWebGLRenderer, createPipeline, createCameraRig } from './hero3d/render.js';
import { setupLighting } from './hero3d/lighting.js';
import { createMaterials } from './hero3d/materials.js';
import { buildPrinter } from './hero3d/model.js';
import { buildMedia } from './hero3d/media.js';

const canvas = document.getElementById('hero3d');
if (canvas) init().catch(err => { console.error(err); document.documentElement.classList.add('no-webgl'); });

async function init() {
  const mobile = matchMedia('(max-width: 900px)').matches;
  const renderer = createWebGLRenderer(THREE, canvas, { mobile });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.03, 60);
  const util = makeUtil(THREE, renderer);

  const mats = createMaterials(THREE, util);
  const lighting = setupLighting(THREE, renderer, scene, mats);
  const machine = buildPrinter(THREE, util, mats);
  scene.add(machine.printer);
  const media = await buildMedia(THREE, util, machine);
  machine.printer.add(media.mesh);

  const pipeline = createPipeline(THREE, renderer, scene, camera);
  const rig = createCameraRig(THREE, camera);

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    pipeline.setSize(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* ---------- Animation ---------- */
  const PASS_T = 1.3, HEAD_X = 1.64;
  const state = { p: 0, intro: 0, mx: 0, my: 0, smx: 0, smy: 0, visible: true, fixedT: null };
  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (!state.visible) return;
    const t = state.fixedT ?? clock.getElapsedTime();

    // Tête : aller-retour avec décélération en bout de course
    const n = Math.floor(t / PASS_T), ph = t / PASS_T - n;
    const dir = n % 2 ? -1 : 1;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, ph / 0.9));
    const hx = dir > 0 ? -HEAD_X + 2 * HEAD_X * e : HEAD_X - 2 * HEAD_X * e;

    machine.update(t, hx);
    media.update(t, { hx, dir, n, ph });
    lighting.update(t);

    state.smx += (state.mx - state.smx) * 0.05;
    state.smy += (state.my - state.smy) * 0.05;
    const cam = rig.update(t, { p: state.p, intro: state.intro, mx: state.smx, my: state.smy, carriageX: hx }) || {};
    pipeline.render(t, cam);
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
