# Mesh Editor Web (v1-ready)

Web-based 3D mesh editor focused on face-group painting (segmentation) and landmarks.

## Stack
- React + TypeScript + Vite
- Three.js
- three-mesh-bvh
- Zustand for app state
- Vitest for unit tests

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Build production bundle:
   ```bash
   npm run build
   ```
4. Preview production build:
   ```bash
   npm run preview
   ```
5. Run lint and tests:
   ```bash
   npm run lint
   npm run test
   ```

## Usage
1. Open the app and upload a local mesh in the Session panel (`.stl`, `.obj`, `.ply`, `.glb`, `.gltf`).
2. You can still load by URL/path using the model path input if needed.
3. Choose a tool:
   - `Paint`: assign active group to faces.
   - `Erase`: set faces to group `0`.
   - `Pick`: eyedropper, sets active group from clicked face.
   - `Landmark`: click to place a landmark.
4. Adjust brush radius with the slider (log-scale for fine tiny values), or use `[` / `]`.
5. Use `Ctrl/Cmd+Z` for undo and `Shift+Ctrl/Cmd+Z` for redo.
6. Manage group names/colors/visibility in the Groups panel.
7. Use the Transform panel to move/center/scale. Click `Rotate` to show the viewport gizmo, and click again to hide it.
8. Use Cleanup tools:
   - Flood Fill from picked triangle (same-source constrained or unconstrained).
   - Smooth boundary (majority vote, N iterations).
   - Remove speckles (small connected components by size threshold).
   - Grow/Shrink active group by 1-3 adjacency steps.
9. Export:
   - Per-group STL (one download per visible group).
   - Combined GLB with group colors encoded as vertex colors.
10. Export/Import full session JSON in the Session panel.

If loading fails, a fallback mock box is loaded so the editor remains usable.
If you import a session created from a local upload, re-upload that mesh file to restore the original geometry.

## Session JSON contents
- `modelPath`
- `modelTransform` (position + rotation + scale)
- `triangleCount`
- `triangleOrderHash`
- `groupIdsEncoded` (base64-encoded uint16 group IDs per triangle)
- `groups` metadata (name/color/visibility)
- `landmarks` (id, name, position, normal, group at placement)
- `activeGroupId`

## Performance notes
- BVH acceleration is enabled via `three-mesh-bvh` for raycasting and brush neighborhood queries.
- Fallback path is kept: if BVH is unavailable, painting uses geometric triangle-distance checks.
- Paint updates are batched and flushed once per animation frame.
- Perf HUD (toggle in Tools) shows:
  - Triangle count
  - Last stroke time (ms)
  - Approx FPS
  - BVH status

## Cleanup internals
- Triangle adjacency is precomputed from shared triangle edges after each model load.
- Adjacency cache is invalidated/rebuilt when loaded geometry changes (including subdivision changes).
- Triangle indexing source of truth is centralized in `src/mesh/triangleIndexing.ts`.

## Project structure
```text
src/
  engine/   Three.js scene setup, model loading, BVH/runtime helpers
  mesh/     Triangle indexing + adjacency building
  tools/    Painting, cleanup ops, palette, group encoding
  export/   STL / GLB export helpers
  state/    Zustand store, undo/redo, session serialization
  ui/       Sidebar panels + viewport
```

## Limitations
- Per-group STL export is multi-file download (no zip bundling yet).
- Session restore expects matching triangle order/hash for exact group mapping.
- Very high-poly meshes can still require larger brush radius or stronger cleanup smoothing.
