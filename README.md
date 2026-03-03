# Mesh Editor Web (Splint v1 Workflow)

Web-based 3D mesh editor for triangle-based segmentation and splint generation:

1. Load scan mesh  
2. Draw trim/seam curves on the surface  
3. Paint relief zones  
4. Extract region + generate splint  
5. Export printable STL/GLB

## Stack
- React + TypeScript + Vite
- Three.js
- three-mesh-bvh
- Zustand
- Vitest

## Scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run test`

## Setup
1. `npm install`
2. `npm run dev`

## Core Workflow
1. In **Session**, upload `.stl/.obj/.ply/.glb/.gltf`.
2. In **Tools**, choose `Trim Curve`.
3. In **Curves & Region**:
   - Create/select a `Trim` curve and click on mesh to place points.
   - Drag curve point markers to edit.
   - Toggle open/closed.
   - Create optional `Seam` curve(s).
4. Click **Pick Region Seed**, then click a triangle inside the trim loop.
5. Click **Compute Region**.
6. In **Groups**, mark any group as `relief` where extra clearance is needed.
7. In **Splint Generator**, set parameters and click **Generate Splint**.
8. In **Export**, download:
   - Segmentation exports: per-group STL / combined GLB
   - Splint exports: `Splint STL` / `Splint GLB`

## Tools Summary
- `Paint`: paint active group per triangle.
- `Erase`: paint group `0`.
- `Pick`: eyedropper group from clicked face.
- `Trim Curve`: place/edit surface curve points.
- `Landmark`: place annotation spheres.

## Splint Generation (MVP Algorithm)
- Extract selected region triangles.
- Build welded region topology.
- Offset inner surface with:
  - `baseClearance`
  - `+ reliefExtraClearance` on relief-labeled areas
- Create outer surface using `thickness`.
- Stitch boundary edges for closed shell.
- Remove shell triangles near seam curve (`seamCutWidth`).
- Smooth boundary with Laplacian iterations.

## Session JSON
Session export/import includes:
- model path + transform
- triangle mapping (`triangleCount`, `triangleOrderHash`, encoded group IDs)
- groups metadata (name/color/visibility/type)
- landmarks
- curves (trim/seam, points with triangle index + barycentric + world position)
- region seed + region mask
- splint settings

## Performance Notes
- BVH acceleration (`three-mesh-bvh`) is used for raycasting/brush neighborhood queries.
- Fallback path is retained when BVH is unavailable.
- Paint updates are batched and flushed once per animation frame.
- Optional perf HUD shows FPS/stroke time/triangle count/BVH status.

## Project Structure
```text
src/
  engine/   scene, loaders, runtime handles, BVH setup
  mesh/     adjacency, triangle indexing, region extraction
  curves/   surface curve projection/evaluation utilities
  tools/    painting, cleanup, encoding, palette
  splint/   splint generation pipeline
  export/   segmentation + splint STL/GLB exports
  state/    zustand store + session serialization
  ui/       viewport + sidebar panels
```

## Limitations
- Curve snapping is triangle-based and designed for MVP correctness over CAD-grade precision.
- Region extraction uses boundary-triangle blocking; very complex meshes may require radius/seed adjustments.
- Splint shell generation is heuristic and not yet medically validated.
- Per-group STL export is separate downloads (no zip bundle).
