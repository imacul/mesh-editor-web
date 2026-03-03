import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createScene, type SceneContext } from "../engine/scene";
import { applyGroupFaceColors, computeTriangleCentroids } from "../engine/meshUtils";
import { loadEditableModel } from "../engine/modelLoader";
import { editorStoreApi, useEditorStore } from "../state/editorStore";
import type { TriangleChange } from "../state/types";
import { collectTrianglesInRadius } from "../tools/paint";

export function Viewport() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneContext | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const landmarksGroupRef = useRef<THREE.Group | null>(null);
  const centroidsRef = useRef<Float32Array>(new Float32Array());
  const isPaintingRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  const modelPath = useEditorStore((state) => state.modelPath);
  const groupIds = useEditorStore((state) => state.groupIds);
  const groups = useEditorStore((state) => state.groups);
  const landmarks = useEditorStore((state) => state.landmarks);
  const loadingModel = useEditorStore((state) => state.loadingModel);
  const modelError = useEditorStore((state) => state.modelError);
  const focusRequestNonce = useEditorStore((state) => state.focusRequestNonce);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const context = createScene(containerRef.current);
    sceneRef.current = context;

    const landmarksGroup = new THREE.Group();
    landmarksGroup.name = "Landmarks";
    context.scene.add(landmarksGroup);
    landmarksGroupRef.current = landmarksGroup;

    const canvas = context.renderer.domElement;

    const pickIntersection = (event: PointerEvent): THREE.Intersection | null => {
      if (!meshRef.current) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

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

    const applyToolAtIntersection = (hit: THREE.Intersection) => {
      if (!meshRef.current) {
        return;
      }
      const triangleIndex = hit.faceIndex ?? -1;
      if (triangleIndex < 0) {
        return;
      }

      const state = editorStoreApi.getState();

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

      const targetGroupId = state.brushMode === "erase" ? 0 : state.activeGroupId;
      const affectedTriangles = collectTrianglesInRadius({
        mesh: meshRef.current,
        centroids: centroidsRef.current,
        centerWorld: hit.point,
        radius: state.brushRadius,
      });

      const changes: TriangleChange[] = [];
      for (const tri of affectedTriangles) {
        const currentGroup = state.groupIds[tri] ?? 0;
        const visible = state.groups[currentGroup]?.visible ?? true;
        if (!visible) {
          continue;
        }
        if (currentGroup !== targetGroupId) {
          changes.push({
            triangleIndex: tri,
            prevGroupId: currentGroup,
            nextGroupId: targetGroupId,
          });
        }
      }

      if (changes.length > 0) {
        state.applyTriangleChanges(changes, true);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      const state = editorStoreApi.getState();
      if (state.brushMode === "paint" || state.brushMode === "erase") {
        isPaintingRef.current = true;
      }
      const hit = pickIntersection(event);
      if (hit) {
        applyToolAtIntersection(hit);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isPaintingRef.current) {
        return;
      }
      const state = editorStoreApi.getState();
      if (state.brushMode !== "paint" && state.brushMode !== "erase") {
        return;
      }
      const hit = pickIntersection(event);
      if (hit) {
        applyToolAtIntersection(hit);
      }
    };

    const onPointerUp = () => {
      isPaintingRef.current = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      context.scene.remove(landmarksGroup);
      context.dispose();
      sceneRef.current = null;
      landmarksGroupRef.current = null;
      meshRef.current = null;
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
      editorStoreApi.getState().setLoadingModel(true);
      editorStoreApi.getState().setModelError(null);
      const loaded = await loadEditableModel(modelPath);
      if (cancelled) {
        disposeMesh(loaded.mesh);
        return;
      }

      if (meshRef.current) {
        context.scene.remove(meshRef.current);
        disposeMesh(meshRef.current);
      }

      meshRef.current = loaded.mesh;
      context.scene.add(loaded.mesh);
      centroidsRef.current = computeTriangleCentroids(loaded.mesh.geometry);
      editorStoreApi.getState().syncModel(modelPath, centroidsRef.current.length / 3);
      editorStoreApi.getState().setLoadingModel(false);

      if (loaded.fallbackReason) {
        editorStoreApi
          .getState()
          .setModelError(`Could not load ${modelPath}. Using fallback box. ${loaded.fallbackReason}`);
      }
    };

    load().catch((error) => {
      editorStoreApi.getState().setLoadingModel(false);
      editorStoreApi
        .getState()
        .setModelError(error instanceof Error ? error.message : "Model loading failed");
    });

    return () => {
      cancelled = true;
    };
  }, [modelPath]);

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }
    applyGroupFaceColors(meshRef.current.geometry, groupIds, groups);
  }, [groupIds, groups]);

  useEffect(() => {
    const landmarksGroup = landmarksGroupRef.current;
    const mesh = meshRef.current;
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
  }, [landmarks]);

  useEffect(() => {
    if (!focusRequestNonce) {
      return;
    }
    const context = sceneRef.current;
    const landmarkId = editorStoreApi.getState().focusLandmarkId;
    const target = editorStoreApi
      .getState()
      .landmarks.find((landmark) => landmark.id === landmarkId);
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

  return (
    <section className="viewport">
      <div ref={containerRef} className="viewport-canvas" />
      {loadingModel ? <div className="viewport-overlay">Loading model...</div> : null}
      {modelError ? <div className="viewport-overlay">{modelError}</div> : null}
    </section>
  );
}

