import * as THREE from "three";
import type { GroupMeta } from "../state/types";
import { paletteColorForGroup } from "../tools/palette";

const MAX_TRIANGLES_FOR_SUBDIVISION = 120000;
const MAX_SUBDIVIDED_TRIANGLES = 180000;

function pickSubdivisionLevels(triangleCount: number): number {
  if (triangleCount <= 0 || triangleCount > MAX_TRIANGLES_FOR_SUBDIVISION) {
    return 0;
  }

  let levels = 0;
  if (triangleCount <= 12000) {
    levels = 2;
  } else if (triangleCount <= 60000) {
    levels = 1;
  }

  while (levels > 0 && triangleCount * Math.pow(4, levels) > MAX_SUBDIVIDED_TRIANGLES) {
    levels -= 1;
  }
  return levels;
}

function subdivideTrianglePositions(positions: Float32Array): Float32Array {
  const triangleCount = Math.floor(positions.length / 9);
  const next = new Float32Array(triangleCount * 36);
  let out = 0;

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const i = tri * 9;
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const cx = positions[i + 6];
    const cy = positions[i + 7];
    const cz = positions[i + 8];

    const abx = (ax + bx) * 0.5;
    const aby = (ay + by) * 0.5;
    const abz = (az + bz) * 0.5;
    const bcx = (bx + cx) * 0.5;
    const bcy = (by + cy) * 0.5;
    const bcz = (bz + cz) * 0.5;
    const cax = (cx + ax) * 0.5;
    const cay = (cy + ay) * 0.5;
    const caz = (cz + az) * 0.5;

    // T1: A, AB, CA
    next[out++] = ax;
    next[out++] = ay;
    next[out++] = az;
    next[out++] = abx;
    next[out++] = aby;
    next[out++] = abz;
    next[out++] = cax;
    next[out++] = cay;
    next[out++] = caz;

    // T2: AB, B, BC
    next[out++] = abx;
    next[out++] = aby;
    next[out++] = abz;
    next[out++] = bx;
    next[out++] = by;
    next[out++] = bz;
    next[out++] = bcx;
    next[out++] = bcy;
    next[out++] = bcz;

    // T3: CA, BC, C
    next[out++] = cax;
    next[out++] = cay;
    next[out++] = caz;
    next[out++] = bcx;
    next[out++] = bcy;
    next[out++] = bcz;
    next[out++] = cx;
    next[out++] = cy;
    next[out++] = cz;

    // T4: AB, BC, CA
    next[out++] = abx;
    next[out++] = aby;
    next[out++] = abz;
    next[out++] = bcx;
    next[out++] = bcy;
    next[out++] = bcz;
    next[out++] = cax;
    next[out++] = cay;
    next[out++] = caz;
  }

  return next;
}

function subdivideForPaintResolution(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const levels = pickSubdivisionLevels(triangleCount);
  if (levels === 0) {
    return geometry;
  }

  let positions = new Float32Array(position.array as ArrayLike<number>);
  for (let level = 0; level < levels; level += 1) {
    positions = subdivideTrianglePositions(positions);
  }

  const subdivided = new THREE.BufferGeometry();
  subdivided.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return subdivided;
}

export function prepareEditableGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = source.clone();
  const baseGeometry = cloned.index ? cloned.toNonIndexed() ?? cloned : cloned;
  const geometry = subdivideForPaintResolution(baseGeometry);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (bounds) {
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const liftY = -bounds.min.y;
    geometry.translate(-centerX, liftY, -centerZ);
    geometry.computeBoundingBox();
  }
  return geometry;
}

export function computeTriangleCentroids(geometry: THREE.BufferGeometry): Float32Array {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const centroids = new Float32Array(triangleCount * 3);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let tri = 0; tri < triangleCount; tri += 1) {
    a.fromBufferAttribute(position, tri * 3);
    b.fromBufferAttribute(position, tri * 3 + 1);
    c.fromBufferAttribute(position, tri * 3 + 2);
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    centroids[tri * 3] = centroid.x;
    centroids[tri * 3 + 1] = centroid.y;
    centroids[tri * 3 + 2] = centroid.z;
  }

  return centroids;
}

function ensureColorAttribute(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const position = geometry.getAttribute("position");
  const existing = geometry.getAttribute("color");
  if (
    existing &&
    existing instanceof THREE.BufferAttribute &&
    existing.itemSize === 4 &&
    existing.count === position.count
  ) {
    return existing;
  }

  const colorAttribute = new THREE.BufferAttribute(new Float32Array(position.count * 4), 4);
  geometry.setAttribute("color", colorAttribute);
  return colorAttribute;
}

export function applyGroupFaceColors(
  geometry: THREE.BufferGeometry,
  groupIds: number[],
  groups: Record<number, GroupMeta>
): void {
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const colors = ensureColorAttribute(geometry);
  const color = new THREE.Color();

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const groupId = groupIds[tri] ?? 0;
    const meta = groups[groupId];
    color.set(meta?.color ?? paletteColorForGroup(groupId));
    const alpha = meta?.visible === false ? 0 : 1;
    for (let v = 0; v < 3; v += 1) {
      colors.setXYZW(tri * 3 + v, color.r, color.g, color.b, alpha);
    }
  }
  colors.needsUpdate = true;
}
