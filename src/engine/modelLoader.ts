import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
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

function loadOBJ(path: string): Promise<THREE.Object3D> {
  const loader = new OBJLoader();
  return new Promise((resolve, reject) => {
    loader.load(path, (obj) => resolve(obj), undefined, (err) => reject(err));
  });
}

function loadPLY(path: string): Promise<THREE.BufferGeometry> {
  const loader = new PLYLoader();
  return new Promise((resolve, reject) => {
    loader.load(path, (geometry) => resolve(geometry), undefined, (err) => reject(err));
  });
}

function loadSTL(path: string): Promise<THREE.BufferGeometry> {
  const loader = new STLLoader();
  return new Promise((resolve, reject) => {
    loader.load(path, (geometry) => resolve(geometry), undefined, (err) => reject(err));
  });
}

function extensionForSource(path: string, sourceName?: string): string {
  const candidate = sourceName ?? path;
  const name = candidate.split("?")[0];
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }
  return name.slice(dotIndex + 1).toLowerCase();
}

function toEditableMeshFromObject(root: THREE.Object3D): THREE.Mesh {
  root.updateWorldMatrix(true, true);
  const sourceMesh = firstMesh(root);
  if (!sourceMesh) {
    throw new Error("No mesh found in object");
  }
  const bakedGeometry = sourceMesh.geometry.clone();
  bakedGeometry.applyMatrix4(sourceMesh.matrixWorld);
  const editable = prepareEditableGeometry(bakedGeometry);
  return createMeshFromGeometry(editable, sourceMesh.name || "EditableMesh");
}

function toEditableMeshFromGeometry(
  geometry: THREE.BufferGeometry,
  name: string
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const editable = prepareEditableGeometry(geometry);
  return createMeshFromGeometry(editable, name);
}

export async function loadEditableModel(path: string, sourceName?: string): Promise<LoadedMesh> {
  try {
    const ext = extensionForSource(path, sourceName);
    let mesh: THREE.Mesh;

    if (ext === "gltf" || ext === "glb") {
      const scene = await loadGLTF(path);
      mesh = toEditableMeshFromObject(scene);
    } else if (ext === "obj") {
      const objRoot = await loadOBJ(path);
      mesh = toEditableMeshFromObject(objRoot);
    } else if (ext === "ply") {
      const geometry = await loadPLY(path);
      mesh = toEditableMeshFromGeometry(geometry, sourceName ?? "UploadedPLY");
    } else if (ext === "stl") {
      const geometry = await loadSTL(path);
      mesh = toEditableMeshFromGeometry(geometry, sourceName ?? "UploadedSTL");
    } else {
      throw new Error(`Unsupported file format: .${ext || "unknown"}`);
    }

    return { mesh, fallbackReason: null };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "Unknown model loading error, using mock box geometry";
    return { mesh: createFallbackMesh(), fallbackReason: reason };
  }
}
