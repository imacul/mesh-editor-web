import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { GroupMeta } from "../state/types";
import { downloadBlob } from "./download";

function collectGroupTriangles(groupIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let tri = 0; tri < groupIds.length; tri += 1) {
    const groupId = groupIds[tri] ?? 0;
    const list = map.get(groupId);
    if (list) {
      list.push(tri);
    } else {
      map.set(groupId, [tri]);
    }
  }
  return map;
}

function geometryFromTriangles(
  sourceGeometry: THREE.BufferGeometry,
  triangles: number[],
  matrixWorld: THREE.Matrix4
): THREE.BufferGeometry {
  const sourcePos = sourceGeometry.getAttribute("position");
  const vertices = new Float32Array(triangles.length * 9);
  let out = 0;
  const world = new THREE.Vector3();

  for (const tri of triangles) {
    for (let v = 0; v < 3; v += 1) {
      const i = tri * 3 + v;
      world.set(sourcePos.getX(i), sourcePos.getY(i), sourcePos.getZ(i)).applyMatrix4(matrixWorld);
      vertices[out++] = world.x;
      vertices[out++] = world.y;
      vertices[out++] = world.z;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export interface ExportGroupSTLArgs {
  mesh: THREE.Mesh;
  groupIds: number[];
  groups: Record<number, GroupMeta>;
  baseName: string;
}

export function exportVisibleGroupsAsSTL({
  mesh,
  groupIds,
  groups,
  baseName,
}: ExportGroupSTLArgs): number {
  const exporter = new STLExporter();
  const perGroupTriangles = collectGroupTriangles(groupIds);
  let exported = 0;

  for (const [groupId, triangles] of perGroupTriangles.entries()) {
    const meta = groups[groupId];
    if (meta?.visible === false || triangles.length === 0) {
      continue;
    }
    const geometry = geometryFromTriangles(mesh.geometry, triangles, mesh.matrixWorld);
    const tempMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    const stlText = exporter.parse(tempMesh, { binary: false }) as string;
    const safeName = (meta?.name ?? `group-${groupId}`).replace(/[^\w-]+/g, "_");
    downloadBlob(new Blob([stlText], { type: "model/stl" }), `${baseName}-${safeName}.stl`);
    geometry.dispose();
    if (Array.isArray(tempMesh.material)) {
      tempMesh.material.forEach((item) => item.dispose());
    } else {
      tempMesh.material.dispose();
    }
    exported += 1;
  }

  return exported;
}
