import * as THREE from "three";

let runtimeSplintMesh: THREE.Mesh | null = null;

export function setRuntimeSplintMesh(mesh: THREE.Mesh | null): void {
  runtimeSplintMesh = mesh;
}

export function getRuntimeSplintMesh(): THREE.Mesh | null {
  return runtimeSplintMesh;
}
