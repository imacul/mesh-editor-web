import { describe, expect, it } from "vitest";
import { floodFillTriangles, removeSpecklesBySize } from "./cleanup";

describe("cleanup tools", () => {
  it("flood fills connected region from start triangle", () => {
    const groupIds = [1, 1, 2, 2, 2];
    const adjacency = [
      [1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3],
    ];

    const changed = floodFillTriangles(groupIds, adjacency, 1, 9, true);
    expect(changed.sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("removes speckles smaller than threshold", () => {
    const groupIds = [0, 2, 2, 0, 2];
    const adjacency = [
      [1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3],
    ];

    const next = removeSpecklesBySize(groupIds, adjacency, 3);
    expect(next).toEqual([0, 0, 0, 0, 0]);
  });
});

