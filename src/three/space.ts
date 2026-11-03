import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Scene,
  type ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';

import { REDUCED_MOTION, WIDE } from '../motion/media';
import { createConstellations } from './constellations';
import { additiveMaterial } from './materials';
import meteorFragment from './meteor.frag.glsl?raw';
import meteorVertex from './meteor.vert.glsl?raw';
import { gaussian, randoms } from './random';
import skyVertex from './sky.vert.glsl?raw';
import starFragment from './star.frag.glsl?raw';
import starsVertex from './stars.vert.glsl?raw';

export interface SpaceScene {
  setHero: (progress: number) => void;
  setJourney: (progress: number) => void;
  setFinale: (progress: number) => void;
  destroy: () => void;
}

const WORDMARK = 'KYVEX';
const WORDMARK_WIDTH = 5;
const CAMERA_FOV = 60;
const HERO_TRAVEL = 10;
const TRAVEL = 140;
const FIELD_SPREAD = 32;
const FIELD_DEPTH = TRAVEL + 90;
const WORD_DISTANCE = 14;
// Share of the half view height the wordmark sits above centre, leaving room for the contact copy.
const WORD_LIFT = 0.36;
const SKY_RADIUS = 500;
// Share of the remaining distance eased per 60 Hz frame; scaled by real frame time so motion is rate independent.
const EASING = 0.06;
// Share of full brightness kept behind page copy, so text stays readable.
const CONTENT_INTENSITY = 0.55;
// Matches --color-bg in global.css.
const BACKGROUND = 0x030304;
const METEOR_LIFE = 1.2;
const METEOR_GAP_MIN = 3;
const METEOR_GAP_MAX = 8;

const BAND_NORMAL = new Vector3(0.25, 0.9, 0.35).normalize();
const BAND_ROTATION = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), BAND_NORMAL);
const WORD_COLOUR = new Vector3(0x8d / 255, 0xb8 / 255, 1);

// Stellar class colours (O to M) with weights tilted towards the white and yellow stars the eye sees most.
const STAR_TYPES: ReadonlyArray<readonly [number, number]> = [
  [0.04, 0x9bb0ff],
  [0.12, 0xaabfff],
  [0.2, 0xcad7ff],
  [0.22, 0xf8f7ff],
  [0.2, 0xfff4ea],
  [0.14, 0xffd2a1],
  [0.08, 0xffcc6f],
];

function starColour(out: Float32Array, offset: number): void {
  let pick = Math.random();
  let hex = STAR_TYPES[STAR_TYPES.length - 1][1];
  for (const [weight, colour] of STAR_TYPES) {
    if (pick < weight) {
      hex = colour;
      break;
    }
    pick -= weight;
  }
  out.set([((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255], offset);
}

function wordmarkPoints(count: number): Float32Array {
  const width = 1000;
  const height = 260;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const positions = new Float32Array(count * 3);
  if (!context) return positions;

  context.font = '800 220px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(WORDMARK, width / 2, height / 2);

  const pixels = context.getImageData(0, 0, width, height).data;
  const filled: number[] = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (pixels[(y * width + x) * 4 + 3] > 128) filled.push(x, y);
    }
  }
  if (filled.length === 0) return positions;

  const scale = WORDMARK_WIDTH / width;
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(Math.random() * (filled.length / 2)) * 2;
    positions.set(
      [(filled[pick] - width / 2) * scale, -(filled[pick + 1] - height / 2) * scale, (Math.random() - 0.5) * 0.1],
      i * 3,
    );
  }
  return positions;
}

function fieldGeometry(count: number, wordCount: number): BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const word = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions.set(
      [(Math.random() * 2 - 1) * FIELD_SPREAD, (Math.random() * 2 - 1) * FIELD_SPREAD, 20 - Math.random() * FIELD_DEPTH],
      i * 3,
    );
    starColour(colours, i * 3);
    // A steep power curve keeps most stars faint, with a rare bright one.
    sizes[i] = 0.7 + Math.random() ** 10 * 7;
    word[i] = i < wordCount ? 1 : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colours, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aRandom', new BufferAttribute(randoms(count), 1));
  geometry.setAttribute('aWord', new BufferAttribute(word, 1));
  geometry.setAttribute('aTarget', new BufferAttribute(wordmarkPoints(count), 3));
  return geometry;
}

function skyGeometry(count: number): BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const direction = new Vector3();

  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.65) {
      const longitude = Math.random() * Math.PI * 2;
      const latitude = gaussian() * 0.12;
      direction
        .set(Math.cos(longitude) * Math.cos(latitude), Math.sin(latitude), Math.sin(longitude) * Math.cos(latitude))
        .applyQuaternion(BAND_ROTATION);
    } else {
      direction.randomDirection();
    }
    positions.set([direction.x * SKY_RADIUS, direction.y * SKY_RADIUS, direction.z * SKY_RADIUS], i * 3);
    starColour(colours, i * 3);
    sizes[i] = 0.5 + Math.random() ** 6 * 2;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colours, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aRandom', new BufferAttribute(randoms(count), 1));
  return geometry;
}

function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
  try {
    return new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
}

export interface SpaceOptions {
  canvas: HTMLCanvasElement;
  onLost: () => void;
}

export function mountSpace({ canvas, onLost }: SpaceOptions): SpaceScene | null {
  const renderer = createRenderer(canvas);
  if (!renderer) return null;

  const motionQuery = window.matchMedia(REDUCED_MOTION);
  const wide = window.matchMedia(WIDE).matches;
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, SKY_RADIUS * 2);
  camera.rotation.order = 'YXZ';
  renderer.setClearColor(BACKGROUND);

  const time = { value: 0 };
  const pixelRatio = { value: 1 };
  const intensity = { value: 1 };
  const starUniforms = {
    uTime: time,
    uPixelRatio: pixelRatio,
    uIntensity: intensity,
    uSize: { value: 22 },
    uMorph: { value: 0 },
    uWordScale: { value: 1 },
    uWordOrigin: { value: new Vector3() },
    uWordColor: { value: WORD_COLOUR },
  };
  const meteorUniforms = {
    uMeteor: { value: new Vector4(0, 0, 0, 0) },
    uAspect: { value: 1 },
    uLife: { value: 0 },
  };

  const field = new Points(
    fieldGeometry(wide ? 26000 : 11000, wide ? 9000 : 4000),
    additiveMaterial(starsVertex, starFragment, starUniforms),
  );
  const sky = new Points(
    skyGeometry(wide ? 14000 : 6000),
    additiveMaterial(skyVertex, starFragment, { uTime: time, uPixelRatio: pixelRatio, uIntensity: intensity, uSize: { value: 1.1 } }),
  );
  const meteor = new Mesh(new PlaneGeometry(1, 1), additiveMaterial(meteorVertex, meteorFragment, meteorUniforms));
  // Word stars fly outside their initial bounds and the meteor is placed in clip space, so neither may be culled.
  field.frustumCulled = false;
  sky.frustumCulled = false;
  meteor.frustumCulled = false;
  // The vertex shader lays the quad tail-first along the heading, which mirrors it, so the back face is the visible one.
  meteor.material.side = DoubleSide;
  meteor.visible = false;

  const constellations = createConstellations({ uTime: time, uPixelRatio: pixelRatio, uIntensity: intensity });
  const scene = new Scene();
  scene.add(sky, field, constellations.group, meteor);

  const target = { hero: 0, journey: 0, finale: 0 };
  const current = { hero: 0, journey: 0, finale: 0 };
  const pointer = new Vector2(0, 0);
  const pointerTarget = new Vector2(0, 0);
  const pointerPixels = new Vector2();
  let pointerInside = false;
  let meteorStart = 0;
  let nextMeteor = 1.5 + Math.random() * 1.5;
  let previousSeconds: number | null = null;
  let running = false;

  const placeCamera = (): void => {
    const hero = MathUtils.smoothstep(current.hero, 0, 1);
    const finale = MathUtils.smoothstep(current.finale, 0, 1);
    const sway = 1 - finale * 0.9;

    camera.position.set(0, 0, -(HERO_TRAVEL * hero + (TRAVEL - HERO_TRAVEL) * current.journey));
    camera.rotation.set(pointer.y * 0.05 * sway, -pointer.x * 0.08 * sway, Math.sin(current.journey * Math.PI) * 0.25);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);

    starUniforms.uMorph.value = current.finale;
    const contentIntensity = 1 - (1 - CONTENT_INTENSITY) * hero;
    const finaleGlow = MathUtils.smoothstep(finale, 0.6, 1);
    intensity.value = contentIntensity + (1 - contentIntensity) * finaleGlow;
  };

  const render = (): void => {
    placeCamera();
    constellations.update(camera, pointerInside ? pointerPixels : null, time.value, canvas.clientWidth, canvas.clientHeight);
    renderer.render(scene, camera);
  };

  const updateMeteor = (seconds: number): void => {
    const path = meteorUniforms.uMeteor.value;
    if (!meteor.visible && seconds >= nextMeteor) {
      const startX = (Math.random() * 2 - 1) * meteorUniforms.uAspect.value * 0.8;
      const tilt = Math.PI * (0.12 + Math.random() * 0.2);
      path.set(startX, 0.3 + Math.random() * 0.6, startX > 0 ? -Math.PI + tilt : -tilt, 0);
      meteorStart = seconds;
      meteor.visible = true;
    }
    if (!meteor.visible) return;
    const progress = (seconds - meteorStart) / METEOR_LIFE;
    if (progress < 1) {
      path.w = progress;
      meteorUniforms.uLife.value = Math.sin(Math.PI * progress);
      return;
    }
    meteor.visible = false;
    nextMeteor = seconds + METEOR_GAP_MIN + Math.random() * (METEOR_GAP_MAX - METEOR_GAP_MIN);
  };

  const tick = (timestamp: number): void => {
    const seconds = timestamp / 1000;
    const frames = previousSeconds === null ? 1 : Math.min(4, (seconds - previousSeconds) * 60);
    const easing = 1 - (1 - EASING) ** frames;
    previousSeconds = seconds;
    time.value = seconds;
    pointer.lerp(pointerTarget, easing);
    current.hero += (target.hero - current.hero) * easing;
    current.journey += (target.journey - current.journey) * easing;
    current.finale += (target.finale - current.finale) * easing;
    updateMeteor(seconds);
    render();
  };

  const resize = (): void => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width === 0 || height === 0) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const halfHeight = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180) * WORD_DISTANCE;
    starUniforms.uWordScale.value = Math.min(2, (halfHeight * camera.aspect * 2 * 0.85) / WORDMARK_WIDTH);
    starUniforms.uWordOrigin.value.set(0, halfHeight * WORD_LIFT, -TRAVEL - WORD_DISTANCE);
    meteorUniforms.uAspect.value = camera.aspect;
    pixelRatio.value = ratio;
    if (!running) render();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    pointerTarget.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    pointerPixels.set(event.clientX, event.clientY);
    pointerInside = true;
  };

  const onPointerLeave = (): void => {
    pointerTarget.set(0, 0);
    pointerInside = false;
  };

  const listenToPointer = (listen: boolean): void => {
    const root = document.documentElement;
    if (listen) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      root.addEventListener('pointerleave', onPointerLeave);
      return;
    }
    window.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
  };

  const applyMotionPreference = (): void => {
    running = !motionQuery.matches;
    renderer.setAnimationLoop(running ? tick : null);
    listenToPointer(running);
    if (running) return;
    Object.assign(current, target);
    pointer.set(0, 0);
    pointerInside = false;
    meteor.visible = false;
    previousSeconds = null;
    render();
  };

  const snapTo = (key: keyof typeof target, progress: number): void => {
    target[key] = progress;
    if (running) return;
    current[key] = progress;
    render();
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    onLost();
  };

  let resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  const onResolutionChange = (): void => {
    resolutionQuery.removeEventListener('change', onResolutionChange);
    resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    resolutionQuery.addEventListener('change', onResolutionChange);
    resize();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  motionQuery.addEventListener('change', applyMotionPreference);
  resolutionQuery.addEventListener('change', onResolutionChange);
  canvas.addEventListener('webglcontextlost', onContextLost);

  resize();
  applyMotionPreference();

  return {
    setHero: (progress) => snapTo('hero', progress),
    setJourney: (progress) => snapTo('journey', progress),
    setFinale: (progress) => snapTo('finale', progress),
    destroy(): void {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      motionQuery.removeEventListener('change', applyMotionPreference);
      resolutionQuery.removeEventListener('change', onResolutionChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      listenToPointer(false);
      for (const object of [sky, field, meteor]) {
        object.geometry.dispose();
        (object.material as ShaderMaterial).dispose();
      }
      constellations.dispose();
      renderer.dispose();
    },
  };
}
