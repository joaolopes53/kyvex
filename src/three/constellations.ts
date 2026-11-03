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
  stars: readonly Point2[];
  edges: readonly Point2[];
  centre: readonly [number, number, number];
  scale: number;
  tilt: number;
}

// Shapes are traced from the real asterisms, in local units of roughly -1 to 1. Depths are spaced along the flight.
const FIGURES: readonly Figure[] = [
  // Orion
  {
    stars: [[-0.6, 0.9], [0.5, 0.8], [0, 1.25], [-0.15, 0], [0, 0.05], [0.15, 0.1], [-0.45, -0.9], [0.6, -0.8]],
    edges: [[2, 0], [2, 1], [0, 3], [1, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
    centre: [12, 3, -32],
    scale: 5,
    tilt: 0.15,
  },
  // Crux
  {
    stars: [[0, 1], [0.1, -1], [-0.65, 0.1], [0.6, 0.3], [0.25, -0.25]],
    edges: [[0, 1], [2, 3]],
    centre: [19, -12, -41],
    scale: 3.5,
    tilt: -0.15,
  },
  // Cassiopeia
  {
    stars: [[-1, 0.3], [-0.5, -0.3], [0, 0.1], [0.5, -0.4], [1, 0.2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    centre: [-12, 9, -50],
    scale: 4.5,
    tilt: -0.2,
  },
  // Leo
  {
    stars: [[0.9, -0.45], [0.8, 0.05], [0.6, 0.4], [0.7, 0.75], [1, 0.9], [1.15, 0.65], [-0.4, 0.35], [-1.1, -0.1], [-0.45, -0.3]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [7, 8], [8, 0]],
    centre: [13, 9, -61],
    scale: 5.5,
    tilt: 0.1,
  },
  // Ursa Major
  {
    stars: [[-1.2, 0.3], [-0.8, 0.45], [-0.4, 0.4], [0, 0.25], [0.05, -0.2], [0.7, -0.25], [0.75, 0.25]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
    centre: [14, -2, -72],
    scale: 6,
    tilt: 0.1,
  },
  // Gemini
  {
    stars: [[-0.4, 1], [0.2, 1], [-0.55, 0.3], [-0.7, -0.5], [-0.8, -1], [0.15, 0.3], [0.25, -0.4], [0.35, -1]],
    edges: [[0, 1], [0, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7]],
    centre: [-14, -7, -81],
    scale: 5,
    tilt: -0.2,
  },
  // Cygnus
  {
    stars: [[0, 1], [0, 0.35], [0.05, -1], [-0.7, 0.15], [0.65, 0.55]],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4]],
    centre: [-13, 2, -92],
    scale: 6,
    tilt: -0.3,
  },
  // Pegasus
  {
    stars: [[-0.7, 0.7], [0.7, 0.7], [0.7, -0.6], [-0.7, -0.6], [-1, -0.85], [-1.45, -1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5]],
    centre: [13, -7, -99],
    scale: 5,
    tilt: 0.12,
  },
  // Lyra
  {
    stars: [[0, 0.8], [-0.15, 0.35], [0.2, 0.3], [-0.25, -0.3], [0.12, -0.35]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]],
    centre: [11, 7, -108],
    scale: 4,
    tilt: 0.2,
  },
  // Aquila
  {
    stars: [[0, 0], [-0.2, 0.3], [0.2, -0.3], [-0.6, -0.6], [-0.9, 0.9], [0.9, -0.9]],
    edges: [[1, 0], [0, 2], [0, 3], [1, 4], [2, 5]],
    centre: [-7, 10, -116],
    scale: 4.5,
    tilt: 0.25,
  },
  // Scorpius
  {
    stars: [
      [0.95, 1], [0.85, 0.7], [0.8, 0.45], [0.45, 0.45], [0.3, 0.2], [0.2, -0.15], [0.15, -0.5],
      [0, -0.85], [-0.3, -1], [-0.65, -0.95], [-0.85, -0.7], [-0.75, -0.5], [-0.55, -0.45],
    ],
    edges: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12]],
    centre: [-10, -3, -124],
    scale: 6,
    tilt: 0.05,
  },
  // Perseus
  {
    stars: [[0.2, 1], [0, 0.5], [-0.1, 0], [-0.5, -0.3], [-0.8, -0.8], [0.3, -0.2], [0.6, -0.7]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
    centre: [14, 5, -131],
    scale: 5,
    tilt: -0.1,
  },
];

const FADE = new Vector4(2, 8, 45, 68);
// Below this share of full visibility a star is too faint to be fair game for the pointer.
const MIN_INTERACTIVE_FADE = 0.3;
const HOVER_RADIUS = 48;
const HINT_RADIUS = 220;
const HINT_GLOW = 0.35;
// Share of the remaining glow eased per 60 Hz frame; scaled by real frame time.
const GLOW_EASING = 0.12;
const EDGE_DRAW_SECONDS = 0.6;
const LINE_ALPHA = 0.5;
// Undrawn edges stay faintly visible so each figure can be found; they strengthen as the pointer nears.
const GHOST_ALPHA = 0.1;
const HINT_LINE_ALPHA = 0.14;
// Applied to every figure's placement scale.
const FIGURE_SCALE = 1.25;
const LINE_COLOUR = new Vector3(0.62, 0.76, 1);

function visibility(depth: number): number {
  return MathUtils.smoothstep(depth, FADE.x, FADE.y) * (1 - MathUtils.smoothstep(depth, FADE.z, FADE.w));
}

export function createConstellations(shared: SharedUniforms): Constellations {
  const starCount = FIGURES.reduce((sum, figure) => sum + figure.stars.length, 0);
  const edgeCount = FIGURES.reduce((sum, figure) => sum + figure.edges.length, 0);
  const world: Vector3[] = [];
  const edges: Point2[] = [];
  const starFigure: number[] = [];
  const edgeFigure: number[] = [];
  const sizes = new Float32Array(starCount);

  for (const [index, figure] of FIGURES.entries()) {
    const cos = Math.cos(figure.tilt);
    const sin = Math.sin(figure.tilt);
    const [cx, cy, cz] = figure.centre;
    const scale = figure.scale * FIGURE_SCALE;
    const place = ([x, y]: Point2): Vector3 =>
      new Vector3(cx + (x * cos - y * sin) * scale, cy + (x * sin + y * cos) * scale, cz);
    const firstStar = world.length;

    for (const star of figure.stars) {
      sizes[world.length] = Math.random() * 1.5;
      world.push(place(star));
      starFigure.push(index);
    }
    for (const [a, b] of figure.edges) {
      edges.push([firstStar + a, firstStar + b]);
      edgeFigure.push(index);
    }
  }

  const positions = new Float32Array(starCount * 3);
  world.forEach((star, i) => star.toArray(positions, i * 3));
  const glow = new BufferAttribute(new Float32Array(starCount), 1).setUsage(DynamicDrawUsage);
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  starGeometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  starGeometry.setAttribute('aRandom', new BufferAttribute(randoms(starCount), 1));
  starGeometry.setAttribute('aGlow', glow);

  // Each edge is two segments: the drawn part from the first lit star, and the ghost remainder.
  const linePositions = new BufferAttribute(new Float32Array(edgeCount * 12), 3).setUsage(DynamicDrawUsage);
  const lineAlpha = new BufferAttribute(new Float32Array(edgeCount * 4), 1).setUsage(DynamicDrawUsage);
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
  const figureHint = new Float32Array(FIGURES.length);
  const nearest = new Float32Array(FIGURES.length);
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
    const easing = 1 - (1 - GLOW_EASING) ** (delta * 60);
    nearest.fill(0);

    world.forEach((star, i) => {
      const { depth, x, y } = project(star, camera, width, height);
      const reach = pointer ? Math.hypot(x - pointer.x, y - pointer.y) : Infinity;
      const closeness = Math.max(0, 1 - reach / HINT_RADIUS);
      if (litAt[i] === null && reach < HOVER_RADIUS && visibility(depth) > MIN_INTERACTIVE_FADE) litAt[i] = seconds;
      nearest[starFigure[i]] = Math.max(nearest[starFigure[i]], closeness);
      const target = litAt[i] !== null ? 1 : closeness * HINT_GLOW;
      glow.array[i] += (target - glow.array[i]) * easing;
    });
    figureHint.forEach((hint, f) => (figureHint[f] = hint + (nearest[f] - hint) * easing));

    edges.forEach(([a, b], i) => {
      const startA = litAt[a];
      const startB = litAt[b];
      if (startA !== null && startB !== null) progress[i] = Math.min(1, progress[i] + delta / EDGE_DRAW_SECONDS);
      const [start, end] = startB !== null && (startA === null || startB < startA) ? [b, a] : [a, b];
      const drawn = 1 - (1 - progress[i]) ** 3;
      from.copy(world[start]).toArray(linePositions.array, i * 12);
      from.lerp(world[end], drawn).toArray(linePositions.array, i * 12 + 3);
      from.toArray(linePositions.array, i * 12 + 6);
      world[end].toArray(linePositions.array, i * 12 + 9);
      lineAlpha.array.fill(progress[i] > 0 ? LINE_ALPHA : 0, i * 4, i * 4 + 2);
      lineAlpha.array.fill(GHOST_ALPHA + figureHint[edgeFigure[i]] * HINT_LINE_ALPHA, i * 4 + 2, i * 4 + 4);
    });

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
    },
  };
}
