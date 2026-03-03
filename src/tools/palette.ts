const PALETTE = [
  "#7f8c8d",
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f1c40f",
  "#9b59b6",
  "#e67e22",
  "#1abc9c",
  "#c0392b",
  "#2980b9",
];

export function paletteColorForGroup(groupId: number): string {
  if (groupId === 0) {
    return PALETTE[0];
  }
  return PALETTE[groupId % PALETTE.length];
}

