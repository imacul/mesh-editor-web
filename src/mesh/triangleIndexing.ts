import * as THREE from "three";
import { buildTriangleAdjacency } from "./adjacency";

export interface TriangleIndexingData {
  triangleCount: number;
  triangleOrderHash: string;
  centroids: Float32Array;
  adjacency: number[][];
}

function computeTriangleCentroids(geometry: THREE.BufferGeometry): Float32Array {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const centroids = new Float32Array(triangleCount * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const out = new THREE.Vector3();

  for (let tri = 0; tri < triangleCount; tri += 1) {
    a.fromBufferAttribute(position, tri * 3);
    b.fromBufferAttribute(position, tri * 3 + 1);
    c.fromBufferAttribute(position, tri * 3 + 2);
    out.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    centroids[tri * 3] = out.x;
    centroids[tri * 3 + 1] = out.y;
    centroids[tri * 3 + 2] = out.z;
  }

  return centroids;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function computeTriangleOrderHash(geometry: THREE.BufferGeometry): string {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const sampleTriangles = Math.min(triangleCount, 2048);
  let seed = `tri:${triangleCount};`;

  for (let tri = 0; tri < sampleTriangles; tri += 1) {
    const base = tri * 3;
    seed += `${position.getX(base).toFixed(6)},${position.getY(base).toFixed(6)},${position
      .getZ(base)
      .toFixed(6)};`;
  }

  return fnv1a(seed).toString(16).padStart(8, "0");
}

export function createTriangleIndexingData(geometry: THREE.BufferGeometry): TriangleIndexingData {
  const triangleCount = Math.floor(geometry.getAttribute("position").count / 3);
  return {
    triangleCount,
    triangleOrderHash: computeTriangleOrderHash(geometry),
    centroids: computeTriangleCentroids(geometry),
    adjacency: buildTriangleAdjacency(geometry),
  };
}

export function normalizeGroupIdsLength(groupIds: number[], triangleCount: number): number[] {
  if (groupIds.length === triangleCount) {
    return groupIds;
  }
  if (groupIds.length > triangleCount) {
    return groupIds.slice(0, triangleCount);
  }
  const padded = groupIds.slice();
  while (padded.length < triangleCount) {
    padded.push(0);
  }
  return padded;
}

