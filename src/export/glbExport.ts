import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { GroupMeta } from "../state/types";
import { paletteColorForGroup } from "../tools/palette";
import { downloadBlob } from "./download";

function buildExportGeometry(
  sourceGeometry: THREE.BufferGeometry,
  groupIds: number[],
  groups: Record<number, GroupMeta>,
  matrixWorld: THREE.Matrix4
): THREE.BufferGeometry {
  const sourcePos = sourceGeometry.getAttribute("position");
  const vertices: number[] = [];
  const colors: number[] = [];
  const world = new THREE.Vector3();
  const color = new THREE.Color();

  for (let tri = 0; tri < groupIds.length; tri += 1) {
    const groupId = groupIds[tri] ?? 0;
    const meta = groups[groupId];
    if (meta?.visible === false) {
      continue;
    }
    color.set(meta?.color ?? paletteColorForGroup(groupId));

    for (let v = 0; v < 3; v += 1) {
      const i = tri * 3 + v;
      world.set(sourcePos.getX(i), sourcePos.getY(i), sourcePos.getZ(i)).applyMatrix4(matrixWorld);
      vertices.push(world.x, world.y, world.z);
      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface ExportGLBArgs {
  mesh: THREE.Mesh;
  groupIds: number[];
  groups: Record<number, GroupMeta>;
  filename: string;
}

export async function exportCombinedGLBWithGroupColors({
  mesh,
  groupIds,
  groups,
  filename,
}: ExportGLBArgs): Promise<void> {
  const geometry = buildExportGeometry(mesh.geometry, groupIds, groups, mesh.matrixWorld);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const exportMesh = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene();
  scene.add(exportMesh);

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
  geometry.dispose();
  material.dispose();
}

