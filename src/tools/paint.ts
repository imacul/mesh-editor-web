import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { getMeshBVH } from "../engine/bvh";

interface CollectTrianglesNearSegmentArgs {
  mesh: THREE.Mesh;
  startWorld: THREE.Vector3;
  endWorld: THREE.Vector3;
  radius: number;
  seedTriangleIndex?: number;
}

const samplePointPool: THREE.Vector3[] = [];

function ensureSamplePointPool(count: number): void {
  while (samplePointPool.length < count) {
    samplePointPool.push(new THREE.Vector3());
  }
}

function sampleStrokePoints(
  startWorld: THREE.Vector3,
  endWorld: THREE.Vector3,
  radius: number
): THREE.Vector3[] {
  const strokeLength = startWorld.distanceTo(endWorld);
  const spacing = Math.max(radius * 0.3, 0.0005);
  const sampleCount = Math.max(1, Math.ceil(strokeLength / spacing));
  ensureSamplePointPool(sampleCount + 1);
  for (let i = 0; i <= sampleCount; i += 1) {
    samplePointPool[i].lerpVectors(startWorld, endWorld, i / sampleCount);
  }
  return samplePointPool.slice(0, sampleCount + 1);
}

function collectWithBVH(
  mesh: THREE.Mesh,
  bvh: MeshBVH,
  samples: THREE.Vector3[],
  radius: number,
  seedTriangleIndex?: number
): number[] {
  const radiusSq = radius * radius;
  const indices = new Set<number>();
  const queryBox = new THREE.Box3();
  const boxMin = new THREE.Vector3();
  const boxMax = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const workingTri = new THREE.Triangle();

  if (typeof seedTriangleIndex === "number" && seedTriangleIndex >= 0) {
    indices.add(seedTriangleIndex);
  }

  for (const sample of samples) {
    boxMin.set(sample.x - radius, sample.y - radius, sample.z - radius);
    boxMax.set(sample.x + radius, sample.y + radius, sample.z + radius);
    queryBox.min.copy(boxMin);
    queryBox.max.copy(boxMax);

    bvh.shapecast({
      intersectsBounds: (box) => queryBox.intersectsBox(box),
      intersectsTriangle: (triangle, triangleIndex) => {
        workingTri.copy(triangle);
        workingTri.a.applyMatrix4(mesh.matrixWorld);
        workingTri.b.applyMatrix4(mesh.matrixWorld);
        workingTri.c.applyMatrix4(mesh.matrixWorld);
        workingTri.closestPointToPoint(sample, closest);
        if (closest.distanceToSquared(sample) <= radiusSq) {
          indices.add(triangleIndex);
        }
        return false;
      },
    });
  }

  return Array.from(indices);
}

function collectWithoutBVH(
  mesh: THREE.Mesh,
  samples: THREE.Vector3[],
  radius: number,
  seedTriangleIndex?: number
): number[] {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const triangleCount = Math.floor(position.count / 3);
  const radiusSq = radius * radius;
  const indices = new Set<number>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const triangle = new THREE.Triangle();

  if (
    typeof seedTriangleIndex === "number" &&
    seedTriangleIndex >= 0 &&
    seedTriangleIndex < triangleCount
  ) {
    indices.add(seedTriangleIndex);
  }

  for (let tri = 0; tri < triangleCount; tri += 1) {
    if (indices.has(tri)) {
      continue;
    }
    a.fromBufferAttribute(position, tri * 3).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, tri * 3 + 1).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, tri * 3 + 2).applyMatrix4(mesh.matrixWorld);
    triangle.set(a, b, c);

    for (const sample of samples) {
      triangle.closestPointToPoint(sample, closest);
      if (closest.distanceToSquared(sample) <= radiusSq) {
        indices.add(tri);
        break;
      }
    }
  }

  return Array.from(indices);
}

export function collectTrianglesNearSegment({
  mesh,
  startWorld,
  endWorld,
  radius,
  seedTriangleIndex,
}: CollectTrianglesNearSegmentArgs): number[] {
  const samples = sampleStrokePoints(startWorld, endWorld, radius);
  const bvh = getMeshBVH(mesh.geometry);
  if (bvh) {
    return collectWithBVH(mesh, bvh, samples, radius, seedTriangleIndex);
  }
  return collectWithoutBVH(mesh, samples, radius, seedTriangleIndex);
}
