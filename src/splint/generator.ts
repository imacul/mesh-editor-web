import * as THREE from "three";

export interface SplintGenerationParams {
  baseClearance: number;
  reliefExtraClearance: number;
  thickness: number;
  seamCutWidth: number;
  borderSmoothIterations: number;
}

export interface CurvePolyline {
  points: THREE.Vector3[];
  closed: boolean;
}

export interface GenerateSplintArgs {
  mesh: THREE.Mesh;
  inRegion: boolean[];
  groupIds: number[];
  reliefGroupIds: Set<number>;
  seamCurves: CurvePolyline[];
  params: SplintGenerationParams;
}

export interface SplintGenerationResult {
  geometry: THREE.BufferGeometry;
  sourceRegionTriangles: number;
  splintTriangles: number;
}

interface RegionTopology {
  vertices: THREE.Vector3[];
  triangles: Array<[number, number, number]>;
  vertexNormals: THREE.Vector3[];
  vertexRelief: boolean[];
  boundaryEdges: Array<[number, number]>;
  boundaryNeighbors: Map<number, number[]>;
}

interface EdgeRecord {
  a: number;
  b: number;
  count: number;
}

function keyForVertex(v: THREE.Vector3): string {
  return `${v.x.toFixed(6)}|${v.y.toFixed(6)}|${v.z.toFixed(6)}`;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildRegionTopology(
  mesh: THREE.Mesh,
  inRegion: boolean[],
  groupIds: number[],
  reliefGroupIds: Set<number>
): RegionTopology {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);

  const vertices: THREE.Vector3[] = [];
  const vertexRelief: boolean[] = [];
  const triangles: Array<[number, number, number]> = [];
  const vertexLookup = new Map<string, number>();

  const worldVertex = new THREE.Vector3();

  const toWorldVertex = (triangleIndex: number, corner: 0 | 1 | 2): THREE.Vector3 => {
    const idx = triangleIndex * 3 + corner;
    return worldVertex
      .set(position.getX(idx), position.getY(idx), position.getZ(idx))
      .applyMatrix4(mesh.matrixWorld)
      .clone();
  };

  const addVertex = (vertex: THREE.Vector3, relief: boolean): number => {
    const key = keyForVertex(vertex);
    const existing = vertexLookup.get(key);
    if (existing != null) {
      if (relief) {
        vertexRelief[existing] = true;
      }
      return existing;
    }
    const index = vertices.length;
    vertices.push(vertex.clone());
    vertexRelief.push(relief);
    vertexLookup.set(key, index);
    return index;
  };

  for (let tri = 0; tri < triangleCount; tri += 1) {
    if (!inRegion[tri]) {
      continue;
    }
    const groupId = groupIds[tri] ?? 0;
    const relief = reliefGroupIds.has(groupId);
    const a = addVertex(toWorldVertex(tri, 0), relief);
    const b = addVertex(toWorldVertex(tri, 1), relief);
    const c = addVertex(toWorldVertex(tri, 2), relief);
    triangles.push([a, b, c]);
  }

  if (!triangles.length) {
    throw new Error("Region is empty. Compute a region from a closed trim curve first.");
  }

  const vertexNormals = Array.from({ length: vertices.length }, () => new THREE.Vector3());
  const triNormal = new THREE.Vector3();
  const edgeAB = new THREE.Vector3();
  const edgeAC = new THREE.Vector3();

  for (const [a, b, c] of triangles) {
    edgeAB.copy(vertices[b]).sub(vertices[a]);
    edgeAC.copy(vertices[c]).sub(vertices[a]);
    triNormal.copy(edgeAB).cross(edgeAC);
    if (triNormal.lengthSq() < 1e-14) {
      continue;
    }
    vertexNormals[a].add(triNormal);
    vertexNormals[b].add(triNormal);
    vertexNormals[c].add(triNormal);
  }

  for (const normal of vertexNormals) {
    if (normal.lengthSq() < 1e-10) {
      normal.set(0, 1, 0);
    } else {
      normal.normalize();
    }
  }

  const edges = new Map<string, EdgeRecord>();
  for (const [a, b, c] of triangles) {
    const triEdges: Array<[number, number]> = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of triEdges) {
      const key = edgeKey(u, v);
      const record = edges.get(key);
      if (record) {
        record.count += 1;
      } else {
        edges.set(key, { a: u, b: v, count: 1 });
      }
    }
  }

  const boundaryEdges: Array<[number, number]> = [];
  const boundaryNeighborSets = new Map<number, Set<number>>();
  for (const edge of edges.values()) {
    if (edge.count !== 1) {
      continue;
    }
    boundaryEdges.push([edge.a, edge.b]);

    const neighborsA = boundaryNeighborSets.get(edge.a) ?? new Set<number>();
    neighborsA.add(edge.b);
    boundaryNeighborSets.set(edge.a, neighborsA);

    const neighborsB = boundaryNeighborSets.get(edge.b) ?? new Set<number>();
    neighborsB.add(edge.a);
    boundaryNeighborSets.set(edge.b, neighborsB);
  }

  const boundaryNeighbors = new Map<number, number[]>();
  for (const [vertexIndex, neighbors] of boundaryNeighborSets.entries()) {
    boundaryNeighbors.set(vertexIndex, Array.from(neighbors));
  }

  return {
    vertices,
    triangles,
    vertexNormals,
    vertexRelief,
    boundaryEdges,
    boundaryNeighbors,
  };
}

function smoothBoundaryPositions(
  positions: THREE.Vector3[],
  boundaryNeighbors: Map<number, number[]>,
  iterations: number
): void {
  const rounds = Math.max(0, Math.floor(iterations));
  if (rounds === 0 || boundaryNeighbors.size === 0) {
    return;
  }

  for (let i = 0; i < rounds; i += 1) {
    const next = positions.map((item) => item.clone());
    const avg = new THREE.Vector3();

    for (const [index, neighbors] of boundaryNeighbors.entries()) {
      if (!neighbors.length) {
        continue;
      }
      avg.set(0, 0, 0);
      for (const neighbor of neighbors) {
        avg.add(positions[neighbor]);
      }
      avg.multiplyScalar(1 / neighbors.length);
      next[index].lerp(avg, 0.35);
    }

    for (let p = 0; p < positions.length; p += 1) {
      positions[p].copy(next[p]);
    }
  }
}

function distanceToSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const segment = new THREE.Vector3().copy(b).sub(a);
  const toPoint = new THREE.Vector3().copy(point).sub(a);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 1e-12) {
    return point.distanceTo(a);
  }
  const t = THREE.MathUtils.clamp(toPoint.dot(segment) / lengthSq, 0, 1);
  const projection = new THREE.Vector3().copy(a).addScaledVector(segment, t);
  return point.distanceTo(projection);
}

function isTriangleNearSeam(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  seamCurves: CurvePolyline[],
  seamCutWidth: number
): boolean {
  if (seamCutWidth <= 0 || seamCurves.length === 0) {
    return false;
  }

  const centroid = new THREE.Vector3().copy(a).add(b).add(c).multiplyScalar(1 / 3);
  for (const curve of seamCurves) {
    const points = curve.points;
    if (points.length < 2) {
      continue;
    }
    const segmentCount = curve.closed ? points.length : points.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      const start = points[i];
      const end = points[(i + 1) % points.length];
      if (distanceToSegment(centroid, start, end) <= seamCutWidth) {
        return true;
      }
    }
  }

  return false;
}

export function generateSplintMesh({
  mesh,
  inRegion,
  groupIds,
  reliefGroupIds,
  seamCurves,
  params,
}: GenerateSplintArgs): SplintGenerationResult {
  const topology = buildRegionTopology(mesh, inRegion, groupIds, reliefGroupIds);
  const { vertices, triangles, vertexNormals, vertexRelief, boundaryEdges, boundaryNeighbors } = topology;

  const inner = vertices.map((vertex, index) => {
    const reliefExtra = vertexRelief[index] ? params.reliefExtraClearance : 0;
    const offset = Math.max(0, params.baseClearance + reliefExtra);
    return vertex.clone().addScaledVector(vertexNormals[index], offset);
  });

  smoothBoundaryPositions(inner, boundaryNeighbors, params.borderSmoothIterations);

  const outer = inner.map((vertex, index) =>
    vertex.clone().addScaledVector(vertexNormals[index], Math.max(0.001, params.thickness))
  );

  smoothBoundaryPositions(outer, boundaryNeighbors, params.borderSmoothIterations);

  const shellVertices = [...inner, ...outer];
  const outerOffset = inner.length;

  const shellTriangles: Array<[number, number, number]> = [];

  for (const [a, b, c] of triangles) {
    shellTriangles.push([a, c, b]);
    shellTriangles.push([a + outerOffset, b + outerOffset, c + outerOffset]);
  }

  for (const [a, b] of boundaryEdges) {
    const ai = a;
    const bi = b;
    const ao = a + outerOffset;
    const bo = b + outerOffset;
    shellTriangles.push([ai, bi, bo]);
    shellTriangles.push([ai, bo, ao]);
  }

  const keptTriangles: Array<[number, number, number]> = [];
  for (const tri of shellTriangles) {
    const a = shellVertices[tri[0]];
    const b = shellVertices[tri[1]];
    const c = shellVertices[tri[2]];
    if (!isTriangleNearSeam(a, b, c, seamCurves, params.seamCutWidth)) {
      keptTriangles.push(tri);
    }
  }

  if (!keptTriangles.length) {
    throw new Error("Seam opening removed all splint triangles. Reduce seam cut width.");
  }

  const out = new Float32Array(keptTriangles.length * 9);
  let cursor = 0;
  for (const [a, b, c] of keptTriangles) {
    const av = shellVertices[a];
    const bv = shellVertices[b];
    const cv = shellVertices[c];
    out[cursor++] = av.x;
    out[cursor++] = av.y;
    out[cursor++] = av.z;
    out[cursor++] = bv.x;
    out[cursor++] = bv.y;
    out[cursor++] = bv.z;
    out[cursor++] = cv.x;
    out[cursor++] = cv.y;
    out[cursor++] = cv.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    geometry,
    sourceRegionTriangles: triangles.length,
    splintTriangles: keptTriangles.length,
  };
}
