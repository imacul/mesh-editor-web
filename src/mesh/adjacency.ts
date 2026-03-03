import * as THREE from "three";

function vertexKey(x: number, y: number, z: number): string {
  return `${x.toFixed(8)}|${y.toFixed(8)}|${z.toFixed(8)}`;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function buildTriangleAdjacency(geometry: THREE.BufferGeometry): number[][] {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const adjacency = Array.from({ length: triangleCount }, () => new Set<number>());
  const edgeToTriangles = new Map<string, number[]>();

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const ax = position.getX(tri * 3);
    const ay = position.getY(tri * 3);
    const az = position.getZ(tri * 3);
    const bx = position.getX(tri * 3 + 1);
    const by = position.getY(tri * 3 + 1);
    const bz = position.getZ(tri * 3 + 1);
    const cx = position.getX(tri * 3 + 2);
    const cy = position.getY(tri * 3 + 2);
    const cz = position.getZ(tri * 3 + 2);

    const va = vertexKey(ax, ay, az);
    const vb = vertexKey(bx, by, bz);
    const vc = vertexKey(cx, cy, cz);

    const edges = [edgeKey(va, vb), edgeKey(vb, vc), edgeKey(vc, va)];
    for (const key of edges) {
      const entries = edgeToTriangles.get(key);
      if (entries) {
        entries.push(tri);
      } else {
        edgeToTriangles.set(key, [tri]);
      }
    }
  }

  for (const triangles of edgeToTriangles.values()) {
    if (triangles.length < 2) {
      continue;
    }
    for (let i = 0; i < triangles.length; i += 1) {
      for (let j = i + 1; j < triangles.length; j += 1) {
        const a = triangles[i];
        const b = triangles[j];
        adjacency[a].add(b);
        adjacency[b].add(a);
      }
    }
  }

  return adjacency.map((neighbors) => Array.from(neighbors).sort((a, b) => a - b));
}

