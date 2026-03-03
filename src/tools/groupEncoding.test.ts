import { describe, expect, it } from "vitest";
import { decodeGroupIds, encodeGroupIds } from "./groupEncoding";

describe("group id encoding", () => {
  it("encodes and decodes a typical group array", () => {
    const source = [0, 1, 1, 4, 2, 0, 15, 255];
    const encoded = encodeGroupIds(source);
    const decoded = decodeGroupIds(encoded);
    expect(decoded).toEqual(source);
  });

  it("handles empty arrays", () => {
    const encoded = encodeGroupIds([]);
    const decoded = decodeGroupIds(encoded);
    expect(decoded).toEqual([]);
  });

  it("preserves larger group ids", () => {
    const source = [0, 1024, 65535, 17];
    const decoded = decodeGroupIds(encodeGroupIds(source));
    expect(decoded).toEqual(source);
  });
});

