import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildTriangleAdjacency } from "./adjacency";

describe("triangle adjacency", () => {
  it("builds neighbors for two triangles sharing one edge", () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      // tri 0
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      // tri 1 (shares edge with tri 0)
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const adjacency = buildTriangleAdjacency(geometry);
    expect(adjacency).toHaveLength(2);
    expect(adjacency[0]).toEqual([1]);
    expect(adjacency[1]).toEqual([0]);
  });

  it("does not connect triangles touching only at a vertex", () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      // tri 0
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      // tri 1 (only shares vertex [1,0,0])
      1, 0, 0,
      2, 0, 0,
      2, 1, 0,
    ]);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const adjacency = buildTriangleAdjacency(geometry);
    expect(adjacency[0]).toEqual([]);
    expect(adjacency[1]).toEqual([]);
  });
});

