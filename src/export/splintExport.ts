import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { downloadBlob } from "./download";

export function exportSplintAsSTL(mesh: THREE.Mesh, filename: string): void {
  const exporter = new STLExporter();
  const stlText = exporter.parse(mesh, { binary: false }) as string;
  downloadBlob(new Blob([stlText], { type: "model/stl" }), filename);
}

export async function exportSplintAsGLB(mesh: THREE.Mesh, filename: string): Promise<void> {
  const scene = new THREE.Scene();
  const cloned = mesh.clone();
  scene.add(cloned);

  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (output) => {
        if (output instanceof ArrayBuffer) {
          resolve(output);
        } else {
          reject(new Error("Expected binary GLB output"));
        }
      },
      (error) => reject(error),
      { binary: true }
    );
  });

  downloadBlob(new Blob([result], { type: "model/gltf-binary" }), filename);
}
