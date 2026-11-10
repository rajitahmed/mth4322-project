/** A unit icosahedron, turned and seen from the front (+z), with its hidden edges marked. */

type Vec3 = readonly [number, number, number];
export type Point = readonly [number, number];

export interface ViewEdge {
  from: Point;
  to: Point;
  /** Both faces of the edge point away from the viewer, so it is drawn dotted. */
  hidden: boolean;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const RADIUS = Math.hypot(1, PHI);
/** A fixed lean towards the viewer, so the solid never sits edge-on. */
const TILT = 0.45;

const corners: Vec3[] = [];
for (const a of [-1, 1]) for (const b of [-PHI, PHI]) corners.push([0, a, b], [a, b, 0], [b, 0, a]);

export const VERTICES: readonly Vec3[] = corners.map(([x, y, z]) => [x / RADIUS, y / RADIUS, z / RADIUS]);

/** Two corners are joined by an edge when they are 2 apart (the edge length before scaling). */
const adjacent = (a: number, b: number) =>
  Math.abs(Math.hypot(...([0, 1, 2] as const).map((i) => corners[a]![i] - corners[b]![i])) - 2) < 1e-9;

const pairs: [number, number][] = [];
for (let a = 0; a < corners.length; a++) for (let b = a + 1; b < corners.length; b++) if (adjacent(a, b)) pairs.push([a, b]);
export const EDGES: readonly (readonly [number, number])[] = pairs;

const triples: [number, number, number][] = [];
for (const [a, b] of pairs) for (let c = b + 1; c < corners.length; c++) if (adjacent(a, c) && adjacent(b, c)) triples.push([a, b, c]);
export const FACES: readonly (readonly [number, number, number])[] = triples;

/** For each edge, the two faces that share it. */
const edgeFaces = EDGES.map(([a, b]) => FACES.flatMap((f, i) => (f.includes(a) && f.includes(b) ? [i] : [])));

function turn([x, y, z]: Vec3, angle: number): Vec3 {
  const [cy, sy, ct, st] = [Math.cos(angle), Math.sin(angle), Math.cos(TILT), Math.sin(TILT)];
  const [x1, z1] = [x * cy + z * sy, -x * sy + z * cy];
  return [x1, y * ct - z1 * st, y * st + z1 * ct];
}

/** Every edge after turning the solid by `angle` around its upright axis, projected straight onto the screen. */
export function viewEdges(angle: number): ViewEdge[] {
  const turned = VERTICES.map((v) => turn(v, angle));
  // A face of a convex solid centred on the origin faces the viewer when its centre is in front.
  const facing = FACES.map((f) => f.reduce((z, v) => z + turned[v]![2], 0) > 0);
  return EDGES.map(([a, b], i) => ({
    from: [turned[a]![0], turned[a]![1]],
    to: [turned[b]![0], turned[b]![1]],
    hidden: edgeFaces[i]!.every((f) => !facing[f]),
  }));
}
