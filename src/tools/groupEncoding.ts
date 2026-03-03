function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== "undefined") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  const nodeBuffer = (globalThis as { Buffer?: { from: (value: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (!nodeBuffer) {
    throw new Error("No base64 encoder available");
  }
  return nodeBuffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const nodeBuffer = (globalThis as {
    Buffer?: { from: (value: string, encoding: string) => ArrayLike<number> };
  }).Buffer;
  if (!nodeBuffer) {
    throw new Error("No base64 decoder available");
  }
  return new Uint8Array(nodeBuffer.from(value, "base64"));
}

export function encodeGroupIds(groupIds: number[]): string {
  const data = new Uint16Array(groupIds.length);
  for (let i = 0; i < groupIds.length; i += 1) {
    data[i] = groupIds[i];
  }
  return bytesToBase64(new Uint8Array(data.buffer));
}

export function decodeGroupIds(encoded: string): number[] {
  const bytes = base64ToBytes(encoded);
  if (bytes.byteLength % 2 !== 0) {
    throw new Error("Invalid encoded group id data");
  }
  const uint16 = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  return Array.from(uint16);
}
