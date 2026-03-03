import * as THREE from "three";

let currentMesh: THREE.Mesh | null = null;

export function setRuntimeMesh(mesh: THREE.Mesh | null): void {
  currentMesh = mesh;
}

export function getRuntimeMesh(): THREE.Mesh | null {
  return currentMesh;
}

