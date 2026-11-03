import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  type IUniform,
  LineSegments,
  MathUtils,
  type PerspectiveCamera,
  Points,
  type Vector2,
  Vector3,
  Vector4,
} from 'three';

import fragmentShader from './star.frag.glsl?raw';
import lineFragment from './line.frag.glsl?raw';
import lineVertex from './line.vert.glsl?raw';
import vertexShader from './constellation.vert.glsl?raw';
import { additiveMaterial } from './materials';
import { randoms } from './random';

export interface Constellations {
  group: Group;
  update: (camera: PerspectiveCamera, pointer: Vector2 | null, seconds: number, width: number, height: number) => void;
  dispose: () => void;
}

interface SharedUniforms {
  uTime: IUniform<number>;
  uPixelRatio: IUniform<number>;
  uIntensity: IUniform<number>;
}

type Point2 = readonly [number, number];

interface Figure {
  name: string;
  stars: readonly Point2[];
  edges: readonly Point2[];
  centre: readonly [number, number, number];
  scale: number;
  tilt: number;
}

// Shapes are traced from the real asterisms, in local units of roughly -1 to 1. Depths are spaced along the flight.
const FIGURES: readonly Figure[] = [
  {
    name: 'Orion',
    stars: [[-0.6, 0.9], [0.5, 0.8], [0, 1.25], [-0.15, 0], [0, 0.05], [0.15, 0.1], [-0.45, -0.9], [0.6, -0.8]],
    edges: [[2, 0], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
    centre: [12, 3, -32],
    scale: 5,
    tilt: 0.15,
  },
  {
    name: 'Cassiopeia',
    stars: [[-1, 0.3], [-0.5, -0.3], [0, 0.1], [0.5, -0.4], [1, 0.2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    centre: [-12, 9, -50],
    scale: 4.5,
    tilt: -0.2,
  },
  {
    name: 'Ursa Major',
    stars: [[-1.2, 0.3], [-0.8, 0.45], [-0.4, 0.4], [0, 0.25], [0.05, -0.2], [0.7, -0.25], [0.75, 0.25]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    centre: [14, -2, -72],
    scale: 6,
    tilt: 0.1,
  },
  {
    name: 'Cygnus',
    stars: [[0, 1], [0, 0.35], [0.05, -1], [-0.7, 0.15], [0.65, 0.55]],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4]],
    centre: [-13, 2, -92],
    scale: 6,
    tilt: -0.3,
  },
  {
    name: 'Lyra',
    stars: [[0, 0.8], [-0.15, 0.35], [0.2, 0.3], [-0.25, -0.3], [0.12, -0.35]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
    centre: [11, 7, -108],
    scale: 4,
    tilt: 0.2,
  },
  {
    name: 'Scorpius',
    stars: [
      [0.95, 1], [0.85, 0.7], [0.8, 0.45], [0.45, 0.45], [0.3, 0.2], [0.2, -0.15], [0.15, -0.5],
      [0, -0.85], [-0.3, -1], [-0.65, -0.95], [-0.85, -0.7], [-0.75, -0.5], [-0.55, -0.45],
    ],
    edges: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]],
    centre: [-10, -3, -124],
    scale: 6,
    tilt: 0.05,
  },
];

const FADE = new Vector4(2, 8, 45, 68);
// Below this share of full visibility a star is too faint to be fair game for the pointer.
const MIN_INTERACTIVE_FADE = 0.3;
const HOVER_RADIUS = 34;
const HINT_RADIUS = 140;
const HINT_GLOW = 0.35;
const GLOW_EASING = 0.12;
const EDGE_DRAW_SECONDS = 0.6;
const LINE_ALPHA = 0.5;
const LABEL_OFFSET = 0.35;
const LINE_COLOUR = new Vector3(0.62, 0.76, 1);

interface FigureState {
  firstEdge: number;
  completedAt: number | null;
  anchor: Vector3;
  label: HTMLElement;
}

function visibility(depth: number): number {
  return MathUtils.smoothstep(depth, FADE.x, FADE.y) * (1 - MathUtils.smoothstep(depth, FADE.z, FADE.w));
}

export function createConstellations(shared: SharedUniforms, labels: HTMLElement | null): Constellations {
  const starCount = FIGURES.reduce((sum, figure) => sum + figure.stars.length, 0);
  const edgeCount = FIGURES.reduce((sum, figure) => sum + figure.edges.length, 0);
  const world: Vector3[] = [];
  const edges: Point2[] = [];
  const figures: FigureState[] = [];
  const sizes = new Float32Array(starCount);

  for (const figure of FIGURES) {
    const cos = Math.cos(figure.tilt);
    const sin = Math.sin(figure.tilt);
    const [cx, cy, cz] = figure.centre;
    const place = ([x, y]: Point2): Vector3 =>
      new Vector3(cx + (x * cos - y * sin) * figure.scale, cy + (x * sin + y * cos) * figure.scale, cz);
    const firstStar = world.length;
    const firstEdge = edges.length;

    for (const star of figure.stars) {
      sizes[world.length] = Math.random() * 1.5;
      world.push(place(star));
    }
    for (const [a, b] of figure.edges) edges.push([firstStar + a, firstStar + b]);

    const lowest = Math.min(...figure.stars.map(([, y]) => y));
    const label = document.createElement('span');
    label.className = 'constellation-label';
    label.textContent = figure.name;
    labels?.append(label);
    figures.push({ firstEdge, completedAt: null, anchor: place([0, lowest - LABEL_OFFSET]), label });
  }

  const positions = new Float32Array(starCount * 3);
  world.forEach((star, i) => star.toArray(positions, i * 3));
  const glow = new BufferAttribute(new Float32Array(starCount), 1).setUsage(DynamicDrawUsage);
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  starGeometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  starGeometry.setAttribute('aRandom', new BufferAttribute(randoms(starCount), 1));
  starGeometry.setAttribute('aGlow', glow);

  const linePositions = new BufferAttribute(new Float32Array(edgeCount * 6), 3).setUsage(DynamicDrawUsage);
  const lineAlpha = new BufferAttribute(new Float32Array(edgeCount * 2), 1).setUsage(DynamicDrawUsage);
  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute('position', linePositions);
  lineGeometry.setAttribute('aAlpha', lineAlpha);

  const fade = { value: FADE };
  const stars = new Points(starGeometry, additiveMaterial(vertexShader, fragmentShader, { ...shared, uFade: fade }));
  const lines = new LineSegments(
    lineGeometry,
    additiveMaterial(lineVertex, lineFragment, {
      uFade: fade,
      uIntensity: shared.uIntensity,
      uColour: { value: LINE_COLOUR },
    }),
  );
  // Line ends move every frame, so a bounding sphere computed once would cull them wrongly.
  stars.frustumCulled = false;
  lines.frustumCulled = false;
  const group = new Group().add(lines, stars);

  const litAt = new Array<number | null>(starCount).fill(null);
  const progress = new Float32Array(edgeCount);
  const view = new Vector3();
  const projected = new Vector3();
  const from = new Vector3();
  let previous: number | null = null;

  const project = (point: Vector3, camera: PerspectiveCamera, width: number, height: number) => {
    const depth = -view.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
    projected.copy(point).project(camera);
    return { depth, x: ((projected.x + 1) / 2) * width, y: ((1 - projected.y) / 2) * height };
  };

  const update: Constellations['update'] = (camera, pointer, seconds, width, height) => {
    const delta = previous === null ? 0 : Math.min(0.1, seconds - previous);
    previous = seconds;

    world.forEach((star, i) => {
      const { depth, x, y } = project(star, camera, width, height);
      const reach = pointer ? Math.hypot(x - pointer.x, y - pointer.y) : Infinity;
      if (litAt[i] === null && reach < HOVER_RADIUS && visibility(depth) > MIN_INTERACTIVE_FADE) litAt[i] = seconds;
      const target = litAt[i] !== null ? 1 : Math.max(0, 1 - reach / HINT_RADIUS) * HINT_GLOW;
      glow.array[i] += (target - glow.array[i]) * GLOW_EASING;
    });

    edges.forEach(([a, b], i) => {
      const startA = litAt[a];
      const startB = litAt[b];
      if (startA !== null && startB !== null) progress[i] = Math.min(1, progress[i] + delta / EDGE_DRAW_SECONDS);
      const [start, end] = startB !== null && (startA === null || startB < startA) ? [b, a] : [a, b];
      const drawn = 1 - (1 - progress[i]) ** 3;
      from.copy(world[start]).toArray(linePositions.array, i * 6);
      from.lerp(world[end], drawn).toArray(linePositions.array, i * 6 + 3);
      lineAlpha.array[i * 2] = lineAlpha.array[i * 2 + 1] = progress[i] > 0 ? LINE_ALPHA : 0;
    });

    for (const [index, figure] of FIGURES.entries()) {
      const state = figures[index];
      const done = progress.subarray(state.firstEdge, state.firstEdge + figure.edges.length).every((value) => value === 1);
      if (done && state.completedAt === null) state.completedAt = seconds;
      if (state.completedAt === null) continue;

      const { depth, x, y } = project(state.anchor, camera, width, height);
      const shown = depth > 0 ? Math.min(1, (seconds - state.completedAt) / EDGE_DRAW_SECONDS) * visibility(depth) : 0;
      state.label.style.opacity = shown.toFixed(3);
      state.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
    }

    glow.needsUpdate = true;
    linePositions.needsUpdate = true;
    lineAlpha.needsUpdate = true;
  };

  return {
    group,
    update,
    dispose(): void {
      starGeometry.dispose();
      lineGeometry.dispose();
      stars.material.dispose();
      lines.material.dispose();
      for (const figure of figures) figure.label.remove();
    },
  };
}
