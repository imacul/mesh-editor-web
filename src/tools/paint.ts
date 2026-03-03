import * as THREE from "three";

interface CollectTrianglesArgs {
  mesh: THREE.Mesh;
  centroids: Float32Array;
  centerWorld: THREE.Vector3;
  radius: number;
}

export function collectTrianglesInRadius({
  mesh,
  centroids,
  centerWorld,
  radius,
}: CollectTrianglesArgs): number[] {
  const radiusSq = radius * radius;
  const triangleCount = centroids.length / 3;
  const worldPoint = new THREE.Vector3();
  const indices: number[] = [];

  for (let tri = 0; tri < triangleCount; tri += 1) {
    worldPoint.set(centroids[tri * 3], centroids[tri * 3 + 1], centroids[tri * 3 + 2]);
    worldPoint.applyMatrix4(mesh.matrixWorld);
    if (worldPoint.distanceToSquared(centerWorld) <= radiusSq) {
      indices.push(tri);
    }
  }
  return indices;
}

