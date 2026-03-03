import * as THREE from "three";
import {
  MeshBVH,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

let bvhExtensionsInstalled = false;

type GeometryWithBVH = THREE.BufferGeometry & {
  boundsTree?: MeshBVH;
  computeBoundsTree?: (options?: { lazyGeneration?: boolean }) => MeshBVH;
  disposeBoundsTree?: () => void;
};

type MeshWithAcceleratedRaycast = THREE.Mesh & {
  raycast: typeof acceleratedRaycast;
};

function asGeometryWithBVH(geometry: THREE.BufferGeometry): GeometryWithBVH {
  return geometry as GeometryWithBVH;
}

export function installBVHExtensions(): void {
  if (bvhExtensionsInstalled) {
    return;
  }

  const geometryPrototype = THREE.BufferGeometry.prototype as GeometryWithBVH;
  const meshPrototype = THREE.Mesh.prototype as MeshWithAcceleratedRaycast;

  geometryPrototype.computeBoundsTree = computeBoundsTree;
  geometryPrototype.disposeBoundsTree = disposeBoundsTree;
  meshPrototype.raycast = acceleratedRaycast;
  bvhExtensionsInstalled = true;
}

export function buildMeshBVH(geometry: THREE.BufferGeometry): boolean {
  try {
    installBVHExtensions();
    const withBVH = asGeometryWithBVH(geometry);
    if (typeof withBVH.computeBoundsTree !== "function") {
      return false;
    }
    withBVH.computeBoundsTree({ lazyGeneration: false });
    return Boolean(withBVH.boundsTree);
  } catch {
    return false;
  }
}

export function hasMeshBVH(geometry: THREE.BufferGeometry): boolean {
  return Boolean(asGeometryWithBVH(geometry).boundsTree);
}

export function getMeshBVH(geometry: THREE.BufferGeometry): MeshBVH | null {
  return asGeometryWithBVH(geometry).boundsTree ?? null;
}

export function disposeMeshBVH(geometry: THREE.BufferGeometry): void {
  const withBVH = asGeometryWithBVH(geometry);
  if (typeof withBVH.disposeBoundsTree === "function") {
    withBVH.disposeBoundsTree();
  }
}

