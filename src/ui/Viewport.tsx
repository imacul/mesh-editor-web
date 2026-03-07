import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { buildMeshBVH } from "../engine/bvh";
import { applyGroupFaceColors } from "../engine/meshUtils";
import { loadEditableModel } from "../engine/modelLoader";
import { getRuntimeMesh, setRuntimeMesh } from "../engine/runtimeMesh";
import { setRuntimeSplintMesh } from "../engine/runtimeSplint";
import { createScene, type SceneContext } from "../engine/scene";
import {
  createCurvePointFromIntersection,
  evaluateCurvePointOnMesh,
  evaluateCurveWorldPoints,
} from "../curves/surfaceCurve";
import { buildBoundaryTriangleSet, countRegionTriangles, extractRegionFromBoundary } from "../mesh/regionFromCurve";
import { createTriangleIndexingData } from "../mesh/triangleIndexing";
import { generateSplintMesh } from "../splint/generator";
import { editorStoreApi, useEditorStore } from "../state/editorStore";
import type { CurveKind, SurfaceCurvePoint, TriangleChange } from "../state/types";
import { collectTrianglesNearSegment } from "../tools/paint";

interface DraggedCurvePoint {
  curveId: string;
  pointId: string;
}

function clampObjectAboveGrid(object: THREE.Object3D): void {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (!Number.isFinite(bounds.min.y)) {
    return;
  }
  if (bounds.min.y < 0) {
    object.position.y += -bounds.min.y;
    object.updateWorldMatrix(true, true);
  }
}

function disposeObjectTree(object: THREE.Object3D): void {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
      return;
    }

    const line = node as THREE.Line;
    if (line.isLine) {
      line.geometry.dispose();
      if (Array.isArray(line.material)) {
        line.material.forEach((material) => material.dispose());
      } else {
        line.material.dispose();
      }
    }
  });
}

function curveColor(kind: CurveKind, active: boolean): string {
  if (kind === "seam") {
    return active ? "#f97316" : "#fb923c";
  }
  return active ? "#22d3ee" : "#38bdf8";
}

function defaultSplintMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: "#22d3ee",
    roughness: 0.5,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
}

export function Viewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const splintMeshRef = useRef<THREE.Mesh | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
  const curvesGroupRef = useRef<THREE.Group | null>(null);
  const isPaintingRef = useRef(false);
  const draggedCurvePointRef = useRef<DraggedCurvePoint | null>(null);
  const lastPaintPointRef = useRef<THREE.Vector3 | null>(null);
  const gizmoDraggingRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const pendingPaintChangesRef = useRef<Map<number, TriangleChange>>(new Map());
  const strokeHistoryRef = useRef<Map<number, TriangleChange>>(new Map());
  const pendingFlushFrameRef = useRef<number | null>(null);
  const strokeStartTimeRef = useRef<number | null>(null);
  const fpsLoopFrameRef = useRef<number | null>(null);

  const [bvhEnabled, setBVHEnabled] = useState(false);

  const modelPath = useEditorStore((state) => state.modelPath);
  const modelFile = useEditorStore((state) => state.modelFile);
  const modelTransform = useEditorStore((state) => state.modelTransform);
  const showRotateGizmo = useEditorStore((state) => state.showRotateGizmo);
  const groupIds = useEditorStore((state) => state.groupIds);
  const groups = useEditorStore((state) => state.groups);
  const landmarks = useEditorStore((state) => state.landmarks);
  const loadingModel = useEditorStore((state) => state.loadingModel);
  const modelError = useEditorStore((state) => state.modelError);
  const focusRequestNonce = useEditorStore((state) => state.focusRequestNonce);
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
  const perfStats = useEditorStore((state) => state.perfStats);
  const curves = useEditorStore((state) => state.curves);
  const activeCurveId = useEditorStore((state) => state.activeCurveId);
  const selectedCurvePointId = useEditorStore((state) => state.selectedCurvePointId);
  const regionComputeNonce = useEditorStore((state) => state.regionComputeNonce);
  const inRegion = useEditorStore((state) => state.inRegion);
  const regionBoundaryTriangles = useEditorStore((state) => state.regionBoundaryTriangles);
  const splintGenerateNonce = useEditorStore((state) => state.splintGenerateNonce);
  const splintReady = useEditorStore((state) => state.splintReady);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const context = createScene(containerRef.current);
    sceneRef.current = context;
    const pendingPaintChanges = pendingPaintChangesRef.current;
    const strokeHistory = strokeHistoryRef.current;

    const landmarksGroup = new THREE.Group();
    landmarksGroup.name = "Landmarks";
    context.scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    const curvesGroup = new THREE.Group();
    curvesGroup.name = "Curves";
    context.scene.add(curvesGroup);
    curvesGroupRef.current = curvesGroup;

    const transformControls = new TransformControls(context.camera, context.renderer.domElement);
    transformControls.setMode("rotate");
    transformControls.setSpace("local");
    transformControls.size = 0.85;
    transformControls.visible = false;
    transformControls.enabled = false;
    context.scene.add(transformControls);
    transformControlsRef.current = transformControls;

    const flushPendingPaintChanges = () => {
      if (!pendingPaintChangesRef.current.size) {
        return;
      }
      const state = editorStoreApi.getState();
      const changes = Array.from(pendingPaintChangesRef.current.values());
      pendingPaintChanges.clear();
      state.applyTriangleChanges(changes, false);
      state.setPerfStats({ strokeTriangles: changes.length });
    };

    const schedulePaintFlush = () => {
      if (pendingFlushFrameRef.current != null) {
        return;
      }
      pendingFlushFrameRef.current = requestAnimationFrame(() => {
        pendingFlushFrameRef.current = null;
        flushPendingPaintChanges();
      });
    };

    const enqueuePaintChange = (triangleIndex: number, nextGroupId: number) => {
      const state = editorStoreApi.getState();
      if (triangleIndex < 0 || triangleIndex >= state.groupIds.length) {
        return;
      }

      const pending = pendingPaintChanges;
      const existing = pending.get(triangleIndex);
      const currentGroupId = existing ? existing.nextGroupId : state.groupIds[triangleIndex] ?? 0;
      if (currentGroupId === nextGroupId) {
        return;
      }

      if (existing) {
        existing.nextGroupId = nextGroupId;
        if (existing.prevGroupId === existing.nextGroupId) {
          pending.delete(triangleIndex);
        }
      } else {
        pending.set(triangleIndex, {
          triangleIndex,
          prevGroupId: currentGroupId,
          nextGroupId,
        });
      }

      const strokeExisting = strokeHistory.get(triangleIndex);
      if (strokeExisting) {
        strokeExisting.nextGroupId = nextGroupId;
        if (strokeExisting.prevGroupId === strokeExisting.nextGroupId) {
          strokeHistory.delete(triangleIndex);
        }
      } else {
        strokeHistory.set(triangleIndex, {
          triangleIndex,
          prevGroupId: state.groupIds[triangleIndex] ?? 0,
          nextGroupId,
        });
      }

      schedulePaintFlush();
    };

    const onTransformDraggingChanged = (event: { value: boolean }) => {
      gizmoDraggingRef.current = Boolean(event.value);
      context.controls.enabled = !gizmoDraggingRef.current;
      if (gizmoDraggingRef.current) {
        isPaintingRef.current = false;
        draggedCurvePointRef.current = null;
      }
    };

    const onTransformObjectChange = () => {
      const editedObject = transformControls.object;
      if (!editedObject || editedObject !== meshRef.current) {
        return;
      }
      clampObjectAboveGrid(editedObject);

      const nextPosition: [number, number, number] = [
        Number(editedObject.position.x.toFixed(4)),
        Number(editedObject.position.y.toFixed(4)),
        Number(editedObject.position.z.toFixed(4)),
      ];
      const nextRotation: [number, number, number] = [
        Number(THREE.MathUtils.radToDeg(editedObject.rotation.x).toFixed(4)),
        Number(THREE.MathUtils.radToDeg(editedObject.rotation.y).toFixed(4)),
        Number(THREE.MathUtils.radToDeg(editedObject.rotation.z).toFixed(4)),
      ];
      const state = editorStoreApi.getState();
      state.setModelPosition(nextPosition);
      state.setModelRotation(nextRotation);
    };

    transformControls.addEventListener("dragging-changed", onTransformDraggingChanged);
    transformControls.addEventListener("objectChange", onTransformObjectChange);

    const canvas = context.renderer.domElement;

    const pickIntersection = (event: PointerEvent, robust = false): THREE.Intersection | null => {
      if (!meshRef.current) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const findAtPoint = (clientX: number, clientY: number): THREE.Intersection | null => {
        pointerRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointerRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(pointerRef.current, context.camera);
        const intersections = raycasterRef.current.intersectObject(meshRef.current, false);
        if (!intersections.length) {
          return null;
        }

        const state = editorStoreApi.getState();
        for (const hit of intersections) {
          const triangleIndex = hit.faceIndex ?? -1;
          if (triangleIndex < 0) {
            continue;
          }
          const groupId = state.groupIds[triangleIndex] ?? 0;
          const visible = state.groups[groupId]?.visible ?? true;
          if (!visible) {
            continue;
          }
          return hit;
        }
        return null;
      };

      const centerHit = findAtPoint(event.clientX, event.clientY);
      if (centerHit || !robust) {
        return centerHit;
      }

      const searchRadii = [2, 4, 6];
      const directions: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0.707, 0.707],
        [0.707, -0.707],
        [-0.707, 0.707],
        [-0.707, -0.707],
      ];
      for (const radius of searchRadii) {
        for (const [dx, dy] of directions) {
          const hit = findAtPoint(event.clientX + dx * radius, event.clientY + dy * radius);
          if (hit) {
            return hit;
          }
        }
      }
      return null;
    };

    const pickCurvePointMarker = (event: PointerEvent): DraggedCurvePoint | null => {
      if (!curvesGroupRef.current || !curvesGroupRef.current.children.length) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, context.camera);
      const hits = raycasterRef.current.intersectObjects(curvesGroupRef.current.children, true);
      for (const hit of hits) {
        const curveId = hit.object.userData.curveId as string | undefined;
        const pointId = hit.object.userData.pointId as string | undefined;
        if (curveId && pointId) {
          return { curveId, pointId };
        }
      }
      return null;
    };

    const updateCurvePointFromHit = (drag: DraggedCurvePoint, hit: THREE.Intersection) => {
      if (!meshRef.current) {
        return;
      }
      const next = createCurvePointFromIntersection(meshRef.current, hit);
      if (!next) {
        return;
      }
      const state = editorStoreApi.getState();
      const currentCurve = state.curves.find((curve) => curve.id === drag.curveId);
      const currentPoint = currentCurve?.points.find((point) => point.id === drag.pointId);
      if (!currentPoint) {
        return;
      }
      state.updateCurvePoint(drag.curveId, drag.pointId, {
        ...next,
        id: drag.pointId,
      });
    };

    const applyToolAtIntersection = (hit: THREE.Intersection) => {
      if (!meshRef.current) {
        return;
      }
      const triangleIndex = hit.faceIndex ?? -1;
      if (triangleIndex < 0) {
        return;
      }

      const state = editorStoreApi.getState();
      state.setLastPickedTriangleIndex(triangleIndex);

      if (state.pickingRegionSeed) {
        state.setRegionSeedTriangleIndex(triangleIndex);
        state.setPickingRegionSeed(false);
        return;
      }

      if (state.brushMode === "pick") {
        const pickedGroup = state.groupIds[triangleIndex] ?? 0;
        state.setActiveGroupId(pickedGroup);
        return;
      }

      if (state.brushMode === "landmark") {
        const localNormal = hit.face?.normal.clone() ?? new THREE.Vector3(0, 1, 0);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(meshRef.current.matrixWorld);
        localNormal.applyMatrix3(normalMatrix).normalize();
        const groupId = state.groupIds[triangleIndex] ?? 0;
        state.addLandmark({
          name: `LM ${state.landmarks.length + 1}`,
          position: [hit.point.x, hit.point.y, hit.point.z],
          normal: [localNormal.x, localNormal.y, localNormal.z],
          groupId,
        });
        return;
      }

      if (state.brushMode === "trimCurve") {
        const point = createCurvePointFromIntersection(meshRef.current, hit);
        if (!point) {
          return;
        }
        state.addPointToActiveCurve(point);
        state.setSelectedCurvePointId(point.id);
        return;
      }

      const targetGroupId = state.brushMode === "erase" ? 0 : state.activeGroupId;
      const currentPoint = hit.point.clone();
      const previousCandidate = lastPaintPointRef.current;
      const maxBridgeDistance = Math.max(state.brushRadius * 80, 0.05);
      const previousPoint =
        previousCandidate && previousCandidate.distanceTo(currentPoint) <= maxBridgeDistance
          ? previousCandidate
          : currentPoint;

      const affectedTriangles = collectTrianglesNearSegment({
        mesh: meshRef.current,
        startWorld: previousPoint,
        endWorld: currentPoint,
        radius: state.brushRadius,
        seedTriangleIndex: triangleIndex,
      });
      lastPaintPointRef.current = currentPoint;

      for (const tri of affectedTriangles) {
        const pending = pendingPaintChangesRef.current.get(tri);
        const currentGroup = pending ? pending.nextGroupId : state.groupIds[tri] ?? 0;
        const visible = state.groups[currentGroup]?.visible ?? true;
        if (!visible || currentGroup === targetGroupId) {
          continue;
        }
        enqueuePaintChange(tri, targetGroupId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      if (gizmoDraggingRef.current) {
        return;
      }
      const gizmo = transformControlsRef.current as (TransformControls & { axis?: string | null }) | null;
      if (editorStoreApi.getState().showRotateGizmo && gizmo?.axis) {
        return;
      }

      const state = editorStoreApi.getState();

      if (state.brushMode === "trimCurve") {
        const markerHit = pickCurvePointMarker(event);
        if (markerHit) {
          draggedCurvePointRef.current = markerHit;
          state.setSelectedCurvePointId(markerHit.pointId);
          context.controls.enabled = false;
          return;
        }
      }

      const centerHit = pickIntersection(event);

      if (state.pickingRegionSeed) {
        const robustHit = centerHit ?? pickIntersection(event, true);
        if (robustHit) {
          applyToolAtIntersection(robustHit);
        }
        return;
      }

      if (state.brushMode === "paint" || state.brushMode === "erase") {
        const robustHit = centerHit ?? pickIntersection(event, true);
        if (!robustHit) {
          lastPaintPointRef.current = null;
          return;
        }
        isPaintingRef.current = true;
        strokeStartTimeRef.current = performance.now();
        strokeHistory.clear();
        pendingPaintChanges.clear();
        context.controls.enabled = false;
        applyToolAtIntersection(robustHit);
        return;
      }

      if (centerHit) {
        applyToolAtIntersection(centerHit);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (draggedCurvePointRef.current) {
        const hit = pickIntersection(event, true);
        if (hit) {
          updateCurvePointFromHit(draggedCurvePointRef.current, hit);
        }
        return;
      }

      if (!isPaintingRef.current || gizmoDraggingRef.current) {
        return;
      }
      const state = editorStoreApi.getState();
      if (state.brushMode !== "paint" && state.brushMode !== "erase") {
        return;
      }
      const hit = pickIntersection(event, true);
      if (hit) {
        applyToolAtIntersection(hit);
      }
    };

    const onPointerUp = () => {
      if (draggedCurvePointRef.current) {
        draggedCurvePointRef.current = null;
        context.controls.enabled = !gizmoDraggingRef.current;
      }

      if (isPaintingRef.current) {
        flushPendingPaintChanges();
        const history = Array.from(strokeHistory.values());
        if (history.length) {
          editorStoreApi.getState().pushHistoryOperation(history);
        }
        const strokeStart = strokeStartTimeRef.current;
        if (strokeStart != null) {
          const strokeMs = Number((performance.now() - strokeStart).toFixed(2));
          editorStoreApi.getState().setPerfStats({ strokeMs, strokeTriangles: history.length });
        }
      }
      isPaintingRef.current = false;
      strokeStartTimeRef.current = null;
      strokeHistory.clear();
      pendingPaintChanges.clear();
      lastPaintPointRef.current = null;
      context.controls.enabled = !gizmoDraggingRef.current;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    let frameCount = 0;
    let lastFpsSample = performance.now();
    const fpsLoop = () => {
      frameCount += 1;
      const now = performance.now();
      if (now - lastFpsSample >= 500) {
        const fps = (frameCount * 1000) / (now - lastFpsSample);
        editorStoreApi.getState().setPerfStats({ fps: Number(fps.toFixed(1)) });
        frameCount = 0;
        lastFpsSample = now;
      }
      fpsLoopFrameRef.current = requestAnimationFrame(fpsLoop);
    };
    fpsLoopFrameRef.current = requestAnimationFrame(fpsLoop);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      transformControls.removeEventListener("dragging-changed", onTransformDraggingChanged);
      transformControls.removeEventListener("objectChange", onTransformObjectChange);
      transformControls.detach();
      context.scene.remove(transformControls);
      transformControls.dispose();
      context.scene.remove(landmarksGroup);
      disposeObjectTree(curvesGroup);
      context.scene.remove(curvesGroup);

      if (splintMeshRef.current) {
        context.scene.remove(splintMeshRef.current);
        disposeObjectTree(splintMeshRef.current);
        splintMeshRef.current = null;
      }
      setRuntimeSplintMesh(null);

      if (pendingFlushFrameRef.current != null) {
        cancelAnimationFrame(pendingFlushFrameRef.current);
        pendingFlushFrameRef.current = null;
      }
      if (fpsLoopFrameRef.current != null) {
        cancelAnimationFrame(fpsLoopFrameRef.current);
        fpsLoopFrameRef.current = null;
      }
      context.dispose();
      sceneRef.current = null;
      transformControlsRef.current = null;
      landmarksGroupRef.current = null;
      curvesGroupRef.current = null;
      meshRef.current = null;
      setRuntimeMesh(null);
      isPaintingRef.current = false;
      draggedCurvePointRef.current = null;
      lastPaintPointRef.current = null;
      pendingPaintChanges.clear();
      strokeHistory.clear();
      gizmoDraggingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const context = sceneRef.current;
    if (!context) {
      return;
    }
    let cancelled = false;

    const disposeMesh = (mesh: THREE.Mesh) => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((item) => item.dispose());
      } else {
        mesh.material.dispose();
      }
    };

    const load = async () => {
      if (!modelFile && !modelPath) {
        return;
      }
      editorStoreApi.getState().setLoadingModel(true);
      editorStoreApi.getState().setModelError(null);
      editorStoreApi.getState().clearSplint();
      if (!modelFile && modelPath.startsWith("uploaded:")) {
        editorStoreApi.getState().setLoadingModel(false);
        editorStoreApi
          .getState()
          .setModelError("This session references a local upload. Re-upload the mesh file to restore it.");
        return;
      }

      const sourceUrl = modelFile ? URL.createObjectURL(modelFile) : modelPath;
      const sourceName = modelFile?.name;
      try {
        const loaded = await loadEditableModel(sourceUrl, sourceName);
        if (cancelled) {
          disposeMesh(loaded.mesh);
          return;
        }

        if (meshRef.current) {
          const gizmo = transformControlsRef.current;
          if (gizmo?.object === meshRef.current) {
            gizmo.detach();
            gizmo.visible = false;
          }
          context.scene.remove(meshRef.current);
          disposeMesh(meshRef.current);
          setRuntimeMesh(null);
        }

        if (splintMeshRef.current) {
          context.scene.remove(splintMeshRef.current);
          disposeMesh(splintMeshRef.current);
          splintMeshRef.current = null;
          setRuntimeSplintMesh(null);
        }

        meshRef.current = loaded.mesh;
        setRuntimeMesh(loaded.mesh);

        const currentTransform = editorStoreApi.getState().modelTransform;
        loaded.mesh.position.set(
          currentTransform.position[0],
          currentTransform.position[1],
          currentTransform.position[2]
        );
        loaded.mesh.rotation.set(
          THREE.MathUtils.degToRad(currentTransform.rotation[0]),
          THREE.MathUtils.degToRad(currentTransform.rotation[1]),
          THREE.MathUtils.degToRad(currentTransform.rotation[2])
        );
        loaded.mesh.scale.setScalar(currentTransform.scale);
        loaded.mesh.updateMatrixWorld(true);
        clampObjectAboveGrid(loaded.mesh);
        context.scene.add(loaded.mesh);

        const indexing = createTriangleIndexingData(loaded.mesh.geometry);
        editorStoreApi.getState().syncModel(modelPath, indexing.triangleCount, indexing.triangleOrderHash);
        editorStoreApi.getState().setTriangleAdjacency(indexing.adjacency);

        const hasBVH = buildMeshBVH(loaded.mesh.geometry);
        setBVHEnabled(hasBVH);

        if (transformControlsRef.current) {
          const shouldShowGizmo = editorStoreApi.getState().showRotateGizmo;
          transformControlsRef.current.attach(loaded.mesh);
          transformControlsRef.current.visible = shouldShowGizmo;
          transformControlsRef.current.enabled = shouldShowGizmo;
        }

        editorStoreApi.getState().setLoadingModel(false);
        if (loaded.fallbackReason) {
          const sourceLabel = modelFile?.name ?? modelPath;
          editorStoreApi
            .getState()
            .setModelError(`Could not load ${sourceLabel}. Using fallback box. ${loaded.fallbackReason}`);
        }
      } finally {
        if (modelFile) {
          URL.revokeObjectURL(sourceUrl);
        }
      }
    };

    load().catch((error) => {
      editorStoreApi.getState().setLoadingModel(false);
      editorStoreApi.getState().setModelError(error instanceof Error ? error.message : "Model loading failed");
    });

    return () => {
      cancelled = true;
    };
  }, [modelPath, modelFile]);

  useEffect(() => {
    const gizmo = transformControlsRef.current;
    const context = sceneRef.current;
    if (!gizmo) {
      return;
    }
    const hasMesh = Boolean(meshRef.current);
    gizmo.visible = showRotateGizmo && hasMesh;
    gizmo.enabled = showRotateGizmo && hasMesh;
    if (!showRotateGizmo) {
      gizmoDraggingRef.current = false;
      if (context) {
        context.controls.enabled = true;
      }
    }
  }, [showRotateGizmo]);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }
    meshRef.current.position.set(
      modelTransform.position[0],
      modelTransform.position[1],
      modelTransform.position[2]
    );
    meshRef.current.rotation.set(
      THREE.MathUtils.degToRad(modelTransform.rotation[0]),
      THREE.MathUtils.degToRad(modelTransform.rotation[1]),
      THREE.MathUtils.degToRad(modelTransform.rotation[2])
    );
    meshRef.current.scale.setScalar(modelTransform.scale);
    meshRef.current.updateMatrixWorld(true);
    clampObjectAboveGrid(meshRef.current);
  }, [modelTransform]);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }
    applyGroupFaceColors(meshRef.current.geometry, groupIds, groups, {
      inRegion,
      boundaryTriangles: regionBoundaryTriangles,
    });
  }, [groupIds, groups, inRegion, regionBoundaryTriangles]);

  useEffect(() => {
    const landmarksGroup = landmarksGroupRef.current;
    const mesh = getRuntimeMesh();
    if (!landmarksGroup || !mesh) {
      return;
    }

    const removeChildren = () => {
      for (const child of landmarksGroup.children) {
        if ((child as THREE.Mesh).isMesh) {
          const marker = child as THREE.Mesh;
          marker.geometry.dispose();
          if (Array.isArray(marker.material)) {
            marker.material.forEach((material) => material.dispose());
          } else {
            marker.material.dispose();
          }
        }
      }
      landmarksGroup.clear();
    };

    removeChildren();
    mesh.geometry.computeBoundingSphere();
    const markerRadius = (mesh.geometry.boundingSphere?.radius ?? 1) * 0.02;

    landmarks.forEach((landmark) => {
      const material = new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        emissive: "#f97316",
        emissiveIntensity: 0.2,
      });
      const geometry = new THREE.SphereGeometry(markerRadius, 16, 16);
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(landmark.position[0], landmark.position[1], landmark.position[2]);
      marker.userData.landmarkId = landmark.id;
      landmarksGroup.add(marker);
    });

    return () => {
      removeChildren();
    };
  }, [landmarks, modelPath]);

  useEffect(() => {
    const curvesGroup = curvesGroupRef.current;
    const mesh = meshRef.current;
    if (!curvesGroup || !mesh) {
      return;
    }

    while (curvesGroup.children.length) {
      const child = curvesGroup.children.pop();
      if (!child) {
        continue;
      }
      disposeObjectTree(child);
    }

    mesh.geometry.computeBoundingSphere();
    const markerRadius = Math.max((mesh.geometry.boundingSphere?.radius ?? 1) * 0.008, 0.002);
    const lineOffset = markerRadius * 0.35;

    for (const curve of curves) {
      const evaluatedPoints = curve.points
        .map((point) => ({
          source: point,
          evaluated: evaluateCurvePointOnMesh(mesh, point),
        }))
        .filter((item) => Boolean(item.evaluated)) as Array<{
        source: SurfaceCurvePoint;
        evaluated: NonNullable<ReturnType<typeof evaluateCurvePointOnMesh>>;
      }>;

      if (!evaluatedPoints.length) {
        continue;
      }

      const active = curve.id === activeCurveId;
      const lineColor = curveColor(curve.kind, active);

      const lineVertices: number[] = [];
      for (const item of evaluatedPoints) {
        const p = item.evaluated.worldPosition.clone().addScaledVector(item.evaluated.worldNormal, lineOffset);
        lineVertices.push(p.x, p.y, p.z);
      }
      if (curve.closed && evaluatedPoints.length >= 3) {
        const first = evaluatedPoints[0].evaluated;
        const p = first.worldPosition.clone().addScaledVector(first.worldNormal, lineOffset);
        lineVertices.push(p.x, p.y, p.z);
      }

      if (lineVertices.length >= 6) {
        const lineGeometry = new THREE.BufferGeometry();
        lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(lineVertices, 3));
        const lineMaterial = new THREE.LineBasicMaterial({ color: lineColor });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.userData.curveId = curve.id;
        curvesGroup.add(line);
      }

      for (const item of evaluatedPoints) {
        const markerGeometry = new THREE.SphereGeometry(markerRadius, 12, 12);
        const markerMaterial = new THREE.MeshStandardMaterial({
          color: item.source.id === selectedCurvePointId ? "#f8fafc" : lineColor,
          emissive: item.source.id === selectedCurvePointId ? "#38bdf8" : "#0f172a",
          emissiveIntensity: item.source.id === selectedCurvePointId ? 0.45 : 0.2,
          roughness: 0.35,
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position
          .copy(item.evaluated.worldPosition)
          .addScaledVector(item.evaluated.worldNormal, lineOffset * 1.6);
        marker.userData.curveId = curve.id;
        marker.userData.pointId = item.source.id;
        curvesGroup.add(marker);
      }
    }
  }, [curves, activeCurveId, selectedCurvePointId, modelTransform, modelPath]);

  useEffect(() => {
    if (!focusRequestNonce) {
      return;
    }
    const context = sceneRef.current;
    const landmarkId = editorStoreApi.getState().focusLandmarkId;
    const target = editorStoreApi.getState().landmarks.find((landmark) => landmark.id === landmarkId);
    if (!context || !target) {
      return;
    }

    const targetPoint = new THREE.Vector3(target.position[0], target.position[1], target.position[2]);
    const normal = new THREE.Vector3(target.normal[0], target.normal[1], target.normal[2]).normalize();
    if (normal.lengthSq() === 0) {
      normal.set(0.5, 0.8, 0.5).normalize();
    }

    const offsetDistance = 0.7;
    context.camera.position.copy(targetPoint.clone().add(normal.multiplyScalar(offsetDistance)));
    context.controls.target.copy(targetPoint);
    context.controls.update();
  }, [focusRequestNonce]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !regionComputeNonce) {
      return;
    }

    const state = editorStoreApi.getState();
    if (!state.triangleAdjacency.length || !state.triangleCount) {
      state.setSplintStatus("No adjacency available for region extraction.");
      return;
    }

    const activeTrimCurve =
      state.curves.find((curve) => curve.id === state.activeCurveId && curve.kind === "trim") ??
      state.curves.find((curve) => curve.kind === "trim" && curve.closed);

    if (!activeTrimCurve) {
      state.setSplintStatus("Create and select a trim curve first.");
      return;
    }

    if (!activeTrimCurve.closed || activeTrimCurve.points.length < 3) {
      state.setSplintStatus("Trim curve must be closed and have at least 3 points.");
      return;
    }

    if (state.regionSeedTriangleIndex == null) {
      state.setSplintStatus("Pick a region seed triangle first.");
      return;
    }

    const worldPoints = evaluateCurveWorldPoints(mesh, activeTrimCurve.points, 0);
    if (worldPoints.length < 3) {
      state.setSplintStatus("Trim curve points are not valid on the current mesh.");
      return;
    }

    mesh.geometry.computeBoundingSphere();
    const radius = Math.max((mesh.geometry.boundingSphere?.radius ?? 1) * 0.004, 0.0005);
    const boundary = buildBoundaryTriangleSet(mesh, worldPoints, true, radius);
    const region = extractRegionFromBoundary({
      triangleCount: state.triangleCount,
      adjacency: state.triangleAdjacency,
      seedTriangleIndex: state.regionSeedTriangleIndex,
      blockedTriangles: boundary,
    });

    state.setRegionResult(region, Array.from(boundary));
    state.setSplintStatus(`Region extracted: ${countRegionTriangles(region)} triangles.`);
  }, [regionComputeNonce]);

  useEffect(() => {
    const context = sceneRef.current;
    const mesh = meshRef.current;
    if (!context || !mesh || !splintGenerateNonce) {
      return;
    }

    const state = editorStoreApi.getState();
    const regionCount = countRegionTriangles(state.inRegion);
    if (regionCount === 0) {
      state.setSplintStatus("Region is empty. Run region extraction before generating splint.");
      return;
    }

    const seamCurves = state.curves
      .filter((curve) => curve.kind === "seam" && curve.points.length >= 2)
      .map((curve) => ({
        points: evaluateCurveWorldPoints(mesh, curve.points, 0),
        closed: curve.closed,
      }))
      .filter((curve) => curve.points.length >= 2);

    const reliefGroupIds = new Set<number>();
    for (const group of Object.values(state.groups)) {
      if (group.type === "relief") {
        reliefGroupIds.add(group.id);
      }
    }

    try {
      const result = generateSplintMesh({
        mesh,
        inRegion: state.inRegion,
        groupIds: state.groupIds,
        reliefGroupIds,
        seamCurves,
        params: state.splintSettings,
      });

      if (splintMeshRef.current) {
        context.scene.remove(splintMeshRef.current);
        disposeObjectTree(splintMeshRef.current);
        splintMeshRef.current = null;
      }

      const material = defaultSplintMaterial();
      const splintMesh = new THREE.Mesh(result.geometry, material);
      splintMesh.name = "GeneratedSplint";
      context.scene.add(splintMesh);
      splintMeshRef.current = splintMesh;
      setRuntimeSplintMesh(splintMesh);

      state.setSplintReady(true);
      state.setSplintStatus(
        `Splint generated (${result.splintTriangles} tris) from ${result.sourceRegionTriangles} region tris.`
      );
    } catch (error) {
      state.setSplintReady(false);
      state.setSplintStatus(error instanceof Error ? error.message : "Splint generation failed.");
    }
  }, [splintGenerateNonce]);

  useEffect(() => {
    if (splintReady) {
      return;
    }
    const context = sceneRef.current;
    if (!context || !splintMeshRef.current) {
      return;
    }
    context.scene.remove(splintMeshRef.current);
    disposeObjectTree(splintMeshRef.current);
    splintMeshRef.current = null;
    setRuntimeSplintMesh(null);
  }, [splintReady]);

  return (
    <section className="viewport">
      <div ref={containerRef} className="viewport-canvas" />
      {loadingModel ? <div className="viewport-overlay">Loading model...</div> : null}
      {modelError ? <div className="viewport-overlay">{modelError}</div> : null}
      {showPerfHud ? (
        <div className="viewport-overlay" style={{ top: modelError || loadingModel ? 52 : 10 }}>
          FPS: {perfStats.fps.toFixed(1)} | Stroke: {perfStats.strokeMs.toFixed(2)}ms | Stroke tris:{" "}
          {perfStats.strokeTriangles} | Mesh tris: {groupIds.length} | BVH: {bvhEnabled ? "ON" : "OFF"}
        </div>
      ) : null}
    </section>
  );
}
