import * as THREE from "three";
import type { SurfaceCurvePoint, Vec3 } from "../state/types";

const TEMP_A = new THREE.Vector3();
const TEMP_B = new THREE.Vector3();
const TEMP_C = new THREE.Vector3();
const TEMP_P = new THREE.Vector3();
const TEMP_V0 = new THREE.Vector3();
const TEMP_V1 = new THREE.Vector3();
const TEMP_V2 = new THREE.Vector3();
const TEMP_NORMAL = new THREE.Vector3();

export interface EvaluatedCurvePoint {
  worldPosition: THREE.Vector3;
  worldNormal: THREE.Vector3;
}

export function triangleCountForMesh(mesh: THREE.Mesh): number {
  const position = mesh.geometry.getAttribute("position");
  return Math.floor(position.count / 3);
}

export function isValidTriangleIndex(mesh: THREE.Mesh, triangleIndex: number): boolean {
  return triangleIndex >= 0 && triangleIndex < triangleCountForMesh(mesh);
}

function readTriangleWorld(
  mesh: THREE.Mesh,
  triangleIndex: number,
  outA: THREE.Vector3,
  outB: THREE.Vector3,
  outC: THREE.Vector3
): boolean {
  if (!isValidTriangleIndex(mesh, triangleIndex)) {
    return false;
  }
  const position = mesh.geometry.getAttribute("position");
  outA
    .set(position.getX(triangleIndex * 3), position.getY(triangleIndex * 3), position.getZ(triangleIndex * 3))
    .applyMatrix4(mesh.matrixWorld);
  outB
    .set(
      position.getX(triangleIndex * 3 + 1),
      position.getY(triangleIndex * 3 + 1),
      position.getZ(triangleIndex * 3 + 1)
    )
    .applyMatrix4(mesh.matrixWorld);
  outC
    .set(
      position.getX(triangleIndex * 3 + 2),
      position.getY(triangleIndex * 3 + 2),
      position.getZ(triangleIndex * 3 + 2)
    )
    .applyMatrix4(mesh.matrixWorld);
  return true;
}

export function barycentricFromWorldPoint(
  point: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): [number, number, number] {
  TEMP_V0.copy(b).sub(a);
  TEMP_V1.copy(c).sub(a);
  TEMP_V2.copy(point).sub(a);

  const d00 = TEMP_V0.dot(TEMP_V0);
  const d01 = TEMP_V0.dot(TEMP_V1);
  const d11 = TEMP_V1.dot(TEMP_V1);
  const d20 = TEMP_V2.dot(TEMP_V0);
  const d21 = TEMP_V2.dot(TEMP_V1);
  const denom = d00 * d11 - d01 * d01;

  if (Math.abs(denom) < 1e-12) {
    return [1, 0, 0];
  }

  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;

  return [u, v, w];
}

function barycentricToWorldPoint(
  barycentric: [number, number, number],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  target: THREE.Vector3
): THREE.Vector3 {
  return target
    .copy(a)
    .multiplyScalar(barycentric[0])
    .addScaledVector(b, barycentric[1])
    .addScaledVector(c, barycentric[2]);
}

export function createCurvePointFromIntersection(
  mesh: THREE.Mesh,
  hit: THREE.Intersection
): SurfaceCurvePoint | null {
  const triangleIndex = hit.faceIndex ?? -1;
  if (!isValidTriangleIndex(mesh, triangleIndex)) {
    return null;
  }

  if (!readTriangleWorld(mesh, triangleIndex, TEMP_A, TEMP_B, TEMP_C)) {
    return null;
  }
  const worldPoint = hit.point.clone();
  const barycentricCoords = barycentricFromWorldPoint(worldPoint, TEMP_A, TEMP_B, TEMP_C);

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cp-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    triangleIndex,
    barycentricCoords,
    worldPosition: [worldPoint.x, worldPoint.y, worldPoint.z],
  };
}

export function evaluateCurvePointOnMesh(
  mesh: THREE.Mesh,
  point: SurfaceCurvePoint
): EvaluatedCurvePoint | null {
  if (!readTriangleWorld(mesh, point.triangleIndex, TEMP_A, TEMP_B, TEMP_C)) {
    return null;
  }

  barycentricToWorldPoint(point.barycentricCoords, TEMP_A, TEMP_B, TEMP_C, TEMP_P);
  TEMP_NORMAL.copy(TEMP_B).sub(TEMP_A).cross(TEMP_C.clone().sub(TEMP_A));
  if (TEMP_NORMAL.lengthSq() < 1e-10) {
    TEMP_NORMAL.set(0, 1, 0);
  } else {
    TEMP_NORMAL.normalize();
  }

  return {
    worldPosition: TEMP_P.clone(),
    worldNormal: TEMP_NORMAL.clone(),
  };
}

export function asVec3(vector: THREE.Vector3): Vec3 {
  return [vector.x, vector.y, vector.z];
}

export function evaluateCurveWorldPoints(
  mesh: THREE.Mesh,
  points: SurfaceCurvePoint[],
  surfaceOffset = 0
): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (const point of points) {
    const evaluated = evaluateCurvePointOnMesh(mesh, point);
    if (!evaluated) {
      continue;
    }
    if (surfaceOffset !== 0) {
      evaluated.worldPosition.addScaledVector(evaluated.worldNormal, surfaceOffset);
    }
    result.push(evaluated.worldPosition);
  }
  return result;
}

export function sanitizeBarycentric(value: [number, number, number]): [number, number, number] {
  const sum = value[0] + value[1] + value[2];
  if (!Number.isFinite(sum) || Math.abs(sum) < 1e-8) {
    return [1, 0, 0];
  }
  const normalized: [number, number, number] = [value[0] / sum, value[1] / sum, value[2] / sum];
  return [
    Number(normalized[0].toFixed(6)),
    Number(normalized[1].toFixed(6)),
    Number(normalized[2].toFixed(6)),
  ];
}
