# Mesh Editor Web (MVP)

Web-based 3D mesh editor focused on face-group painting (segmentation) and landmarks.

## Stack
- React + TypeScript + Vite
- Three.js
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
1. Put your sample model at `public/models/sample.glb`.
2. Open the app and use the default model path `/models/sample.glb`.
3. Choose a tool:
   - `Paint`: assign active group to faces.
   - `Erase`: set faces to group `0`.
   - `Pick`: eyedropper, sets active group from clicked face.
   - `Landmark`: click to place a landmark.
4. Adjust brush radius in world units (or use `[` / `]`).
5. Use `Ctrl/Cmd+Z` for undo and `Shift+Ctrl/Cmd+Z` for redo.
6. Manage group names/colors/visibility in the Groups panel.
7. Export/Import full session JSON in the Session panel.

If `/models/sample.glb` is missing or fails to load, a fallback mock box is loaded so the editor remains usable.

## Session JSON contents
- `modelPath`
- `triangleCount`
- `groupIdsEncoded` (base64-encoded uint16 group IDs per triangle)
- `groups` metadata (name/color/visibility)
- `landmarks` (id, name, position, normal, group at placement)
- `activeGroupId`

## Project structure
```text
src/
  engine/   Three.js scene setup + model loading + geometry helpers
  state/    Zustand store, undo/redo, session serialization
  tools/    Painting math, palette, group encoding
  ui/       Sidebar panels + viewport component
```

