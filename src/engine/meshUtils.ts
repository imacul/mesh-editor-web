import * as THREE from "three";
import type { GroupMeta } from "../state/types";
import { paletteColorForGroup } from "../tools/palette";

export function prepareEditableGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = source.clone();
  const geometry = cloned.index ? cloned.toNonIndexed() ?? cloned : cloned;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.center();
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

