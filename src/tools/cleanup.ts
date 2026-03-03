export function floodFillTriangles(
  groupIds: number[],
  adjacency: number[][],
  startTriangle: number,
  activeGroupId: number,
  constrainToSourceGroup: boolean
): number[] {
  if (startTriangle < 0 || startTriangle >= groupIds.length) {
    return [];
  }

  const sourceGroup = groupIds[startTriangle] ?? 0;
  const queue = [startTriangle];
  const visited = new Set<number>();
  const changed: number[] = [];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const currentGroup = groupIds[current] ?? 0;
    if (constrainToSourceGroup && currentGroup !== sourceGroup) {
      continue;
    }
    if (currentGroup !== activeGroupId) {
      changed.push(current);
    }

    for (const neighbor of adjacency[current] ?? []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return changed;
}

export function smoothBoundaryGroups(
  groupIds: number[],
  adjacency: number[][],
  iterations: number
): number[] {
  const next = groupIds.slice();
  const rounds = Math.max(1, Math.floor(iterations));

  for (let i = 0; i < rounds; i += 1) {
    const current = next.slice();
    for (let tri = 0; tri < current.length; tri += 1) {
      const counts = new Map<number, number>();
      const own = current[tri] ?? 0;
      counts.set(own, (counts.get(own) ?? 0) + 1);
      for (const neighbor of adjacency[tri] ?? []) {
        const value = current[neighbor] ?? 0;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      let bestGroup = own;
      let bestCount = counts.get(own) ?? 0;
      for (const [groupId, count] of counts.entries()) {
        if (count > bestCount) {
          bestCount = count;
          bestGroup = groupId;
        }
      }
      next[tri] = bestGroup;
    }
  }

  return next;
}

function connectedComponentsForGroup(
  groupIds: number[],
  adjacency: number[][],
  groupId: number
): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (let tri = 0; tri < groupIds.length; tri += 1) {
    if ((groupIds[tri] ?? 0) !== groupId || visited.has(tri)) {
      continue;
    }
    const component: number[] = [];
    const queue = [tri];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current) || (groupIds[current] ?? 0) !== groupId) {
        continue;
      }
      visited.add(current);
      component.push(current);
      for (const neighbor of adjacency[current] ?? []) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    if (component.length > 0) {
      components.push(component);
    }
  }

  return components;
}

function dominantNeighborGroup(
  groupIds: number[],
  adjacency: number[][],
  triangles: number[]
): number {
  const counts = new Map<number, number>();
  const inComponent = new Set<number>(triangles);
  for (const tri of triangles) {
    for (const neighbor of adjacency[tri] ?? []) {
      if (inComponent.has(neighbor)) {
        continue;
      }
      const value = groupIds[neighbor] ?? 0;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  let best = 0;
  let count = -1;
  for (const [groupId, groupCount] of counts.entries()) {
    if (groupCount > count) {
      count = groupCount;
      best = groupId;
    }
  }
  return best;
}

export function removeSpecklesBySize(
  groupIds: number[],
  adjacency: number[][],
  minSize: number
): number[] {
  const threshold = Math.max(1, Math.floor(minSize));
  const next = groupIds.slice();
  const uniqueGroups = new Set(groupIds);

  for (const groupId of uniqueGroups) {
    if (groupId === 0) {
      continue;
    }
    const components = connectedComponentsForGroup(next, adjacency, groupId);
    for (const component of components) {
      if (component.length >= threshold) {
        continue;
      }
      const replacement = dominantNeighborGroup(next, adjacency, component);
      for (const tri of component) {
        next[tri] = replacement;
      }
    }
  }

  return next;
}

export function growGroupIds(
  groupIds: number[],
  adjacency: number[][],
  targetGroupId: number,
  steps: number
): number[] {
  const next = groupIds.slice();
  const rounds = Math.max(1, Math.floor(steps));

  for (let i = 0; i < rounds; i += 1) {
    const current = next.slice();
    const toPaint: number[] = [];
    for (let tri = 0; tri < current.length; tri += 1) {
      if ((current[tri] ?? 0) === targetGroupId) {
        continue;
      }
      for (const neighbor of adjacency[tri] ?? []) {
        if ((current[neighbor] ?? 0) === targetGroupId) {
          toPaint.push(tri);
          break;
        }
      }
    }
    for (const tri of toPaint) {
      next[tri] = targetGroupId;
    }
  }

  return next;
}

export function shrinkGroupIds(
  groupIds: number[],
  adjacency: number[][],
  targetGroupId: number,
  steps: number
): number[] {
  const next = groupIds.slice();
  const rounds = Math.max(1, Math.floor(steps));

  for (let i = 0; i < rounds; i += 1) {
    const current = next.slice();
    const toClear: number[] = [];
    for (let tri = 0; tri < current.length; tri += 1) {
      if ((current[tri] ?? 0) !== targetGroupId) {
        continue;
      }
      const neighbors = adjacency[tri] ?? [];
      const isBoundary = neighbors.some((neighbor) => (current[neighbor] ?? 0) !== targetGroupId);
      if (isBoundary) {
        toClear.push(tri);
      }
    }
    for (const tri of toClear) {
      next[tri] = 0;
    }
  }

  return next;
}
