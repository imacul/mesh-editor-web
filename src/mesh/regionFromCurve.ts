import * as THREE from "three";
import { collectTrianglesNearSegment } from "../tools/paint";

export function buildBoundaryTriangleSet(
  mesh: THREE.Mesh,
  points: THREE.Vector3[],
  closed: boolean,
  radius: number
): Set<number> {
  const boundary = new Set<number>();
  if (points.length === 0) {
    return boundary;
  }

  const segmentCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    if (!start || !end) {
      continue;
    }

    const tris = collectTrianglesNearSegment({
      mesh,
      startWorld: start,
      endWorld: end,
      radius,
    });
    for (const tri of tris) {
      boundary.add(tri);
    }
  }

  return boundary;
}

export interface ExtractRegionArgs {
  triangleCount: number;
  adjacency: number[][];
  seedTriangleIndex: number;
  blockedTriangles: Set<number>;
}

export function extractRegionFromBoundary({
  triangleCount,
  adjacency,
  seedTriangleIndex,
  blockedTriangles,
}: ExtractRegionArgs): boolean[] {
  const inRegion = new Array<boolean>(triangleCount).fill(false);
  if (seedTriangleIndex < 0 || seedTriangleIndex >= triangleCount || blockedTriangles.has(seedTriangleIndex)) {
    return inRegion;
  }

  const queue = [seedTriangleIndex];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    if (inRegion[current] || blockedTriangles.has(current)) {
      continue;
    }
    inRegion[current] = true;

    const neighbors = adjacency[current] ?? [];
    for (const neighbor of neighbors) {
      if (!inRegion[neighbor] && !blockedTriangles.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return inRegion;
}

export function countRegionTriangles(region: boolean[]): number {
  let count = 0;
  for (const flag of region) {
    if (flag) {
      count += 1;
    }
  }
  return count;
}
