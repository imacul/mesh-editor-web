import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { prepareEditableGeometry } from "./meshUtils";

export interface LoadedMesh {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  fallbackReason: string | null;
}

function createMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.8,
    metalness: 0.1,
  });
}

function createMeshFromGeometry(
  geometry: THREE.BufferGeometry,
  name: string
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(geometry, createMaterial());
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createFallbackMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const editable = prepareEditableGeometry(geometry);
  return createMeshFromGeometry(editable, "MockBox");
}

function firstMesh(root: THREE.Object3D): THREE.Mesh | null {
  let selected: THREE.Mesh | null = null;
  root.traverse((node) => {
    if (!selected && (node as THREE.Mesh).isMesh) {
      selected = node as THREE.Mesh;
    }
  });
  return selected;
}

function loadGLTF(path: string): Promise<THREE.Object3D> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err)
    );
  });
}

export async function loadEditableModel(path: string): Promise<LoadedMesh> {
  try {
    const scene = await loadGLTF(path);
    scene.updateWorldMatrix(true, true);

    const sourceMesh = firstMesh(scene);
    if (!sourceMesh) {
      throw new Error("No mesh found in GLTF/GLB");
    }

    const bakedGeometry = sourceMesh.geometry.clone();
    bakedGeometry.applyMatrix4(sourceMesh.matrixWorld);
    const editable = prepareEditableGeometry(bakedGeometry);
    const mesh = createMeshFromGeometry(editable, sourceMesh.name || "EditableMesh");
    return { mesh, fallbackReason: null };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Unknown model loading error, using mock box geometry";
    return { mesh: createFallbackMesh(), fallbackReason: reason };
  }
}

