import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { normalizeGroupIdsLength } from "../mesh/triangleIndexing";
import {
  floodFillTriangles,
  growGroupIds,
  removeSpecklesBySize,
  shrinkGroupIds,
  smoothBoundaryGroups,
} from "../tools/cleanup";
import { decodeGroupIds, encodeGroupIds } from "../tools/groupEncoding";
import { paletteColorForGroup } from "../tools/palette";
import type {
  BrushMode,
  CurveKind,
  EditorSession,
  GroupMeta,
  GroupType,
  Landmark,
  ModelTransform,
  PaintOperation,
  PerfStats,
  SplintSettings,
  SurfaceCurve,
  SurfaceCurvePoint,
  TriangleChange,
  Vec3,
} from "./types";

export interface EditorStoreState {
  modelPath: string;
  modelFile: File | null;
  modelTransform: ModelTransform;
  triangleCount: number;
  triangleOrderHash: string;
  triangleAdjacency: number[][];
  groupIds: number[];
  groups: Record<number, GroupMeta>;
  activeGroupId: number;
  brushMode: BrushMode;
  brushRadius: number;
  showRotateGizmo: boolean;
  showPerfHud: boolean;
  perfStats: PerfStats;
  loadingModel: boolean;
  modelError: string | null;
  landmarks: Landmark[];
  lastPickedTriangleIndex: number | null;
  focusLandmarkId: string | null;
  focusRequestNonce: number;
  undoStack: PaintOperation[];
  redoStack: PaintOperation[];

  curves: SurfaceCurve[];
  activeCurveId: string | null;
  selectedCurvePointId: string | null;
  pickingRegionSeed: boolean;
  regionSeedTriangleIndex: number | null;
  inRegion: boolean[];
  regionBoundaryTriangles: number[];
  regionComputeNonce: number;

  splintSettings: SplintSettings;
  splintGenerateNonce: number;
  splintStatus: string | null;
  splintReady: boolean;

  setModelPath: (path: string) => void;
  setModelFile: (file: File) => void;
  setModelPosition: (position: Vec3) => void;
  translateModel: (delta: Vec3) => void;
  setModelRotation: (rotation: Vec3) => void;
  rotateModel: (delta: Vec3) => void;
  setModelScale: (scale: number) => void;
  centerModel: () => void;
  resetModelTransform: () => void;
  syncModel: (modelPath: string, triangleCount: number, triangleOrderHash: string) => void;
  setTriangleAdjacency: (adjacency: number[][]) => void;
  setLoadingModel: (loading: boolean) => void;
  setModelError: (value: string | null) => void;
  setBrushMode: (mode: BrushMode) => void;
  setBrushRadius: (radius: number) => void;
  setShowRotateGizmo: (value: boolean) => void;
  setShowPerfHud: (value: boolean) => void;
  setPerfStats: (stats: Partial<PerfStats>) => void;
  setActiveGroupId: (groupId: number) => void;
  setLastPickedTriangleIndex: (triangleIndex: number | null) => void;
  createGroup: () => number;
  renameGroup: (groupId: number, name: string) => void;
  setGroupColor: (groupId: number, color: string) => void;
  setGroupVisibility: (groupId: number, visible: boolean) => void;
  setGroupType: (groupId: number, type: GroupType) => void;
  applyTriangleChanges: (changes: TriangleChange[], pushHistory?: boolean) => void;
  pushHistoryOperation: (changes: TriangleChange[]) => void;
  floodFillFromPicked: (constrainToSourceGroup: boolean) => void;
  smoothBoundaries: (iterations: number) => void;
  removeSpeckles: (threshold: number) => void;
  growActiveGroup: (steps: number) => void;
  shrinkActiveGroup: (steps: number) => void;
  undo: () => void;
  redo: () => void;
  addLandmark: (
    landmark: Omit<Landmark, "id"> & {
      id?: string;
    }
  ) => void;
  removeLandmark: (id: string) => void;
  focusLandmark: (id: string) => void;

  createCurve: (kind: CurveKind) => string;
  renameCurve: (curveId: string, name: string) => void;
  setCurveKind: (curveId: string, kind: CurveKind) => void;
  setActiveCurveId: (curveId: string | null) => void;
  toggleCurveClosed: (curveId: string) => void;
  deleteCurve: (curveId: string) => void;
  addPointToActiveCurve: (point: SurfaceCurvePoint) => void;
  updateCurvePoint: (curveId: string, pointId: string, point: SurfaceCurvePoint) => void;
  deleteCurvePoint: (curveId: string, pointId: string) => void;
  setSelectedCurvePointId: (pointId: string | null) => void;

  setPickingRegionSeed: (value: boolean) => void;
  setRegionSeedTriangleIndex: (triangleIndex: number | null) => void;
  requestRegionCompute: () => void;
  setRegionResult: (inRegion: boolean[], boundaryTriangles: number[]) => void;
  clearRegion: () => void;

  setSplintSettings: (partial: Partial<SplintSettings>) => void;
  requestSplintGeneration: () => void;
  setSplintStatus: (value: string | null) => void;
  setSplintReady: (value: boolean) => void;
  clearSplint: () => void;

  toSession: () => EditorSession;
  loadSession: (session: EditorSession) => void;
}

function defaultGroups(): Record<number, GroupMeta> {
  return {
    0: {
      id: 0,
      name: "Unassigned",
      color: paletteColorForGroup(0),
      visible: true,
      type: "default",
    },
    1: {
      id: 1,
      name: "Group 1",
      color: paletteColorForGroup(1),
      visible: true,
      type: "default",
    },
  };
}

function ensureGroup(
  groups: Record<number, GroupMeta>,
  groupId: number
): Record<number, GroupMeta> {
  if (groups[groupId]) {
    return groups;
  }
  return {
    ...groups,
    [groupId]: {
      id: groupId,
      name: groupId === 0 ? "Unassigned" : `Group ${groupId}`,
      color: paletteColorForGroup(groupId),
      visible: true,
      type: "default",
    },
  };
}

function operationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function landmarkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lm-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function curveId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cv-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function sanitizeScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0.001, Number(value.toFixed(4)));
}

function sanitizeVec3(value: Vec3): Vec3 {
  return [
    Number.isFinite(value[0]) ? Number(value[0].toFixed(4)) : 0,
    Number.isFinite(value[1]) ? Number(value[1].toFixed(4)) : 0,
    Number.isFinite(value[2]) ? Number(value[2].toFixed(4)) : 0,
  ];
}

const DEFAULT_MODEL_TRANSFORM: ModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

const DEFAULT_SPLINT_SETTINGS: SplintSettings = {
  baseClearance: 0.8,
  reliefExtraClearance: 0.7,
  thickness: 2,
  seamCutWidth: 1.5,
  borderSmoothIterations: 2,
};

function normalizeModelTransform(input?: Partial<ModelTransform> | null): ModelTransform {
  const rawPosition = input?.position;
  const rawRotation = input?.rotation;
  const position: Vec3 = Array.isArray(rawPosition)
    ? [
        Number(rawPosition[0] ?? 0),
        Number(rawPosition[1] ?? 0),
        Number(rawPosition[2] ?? 0),
      ]
    : [0, 0, 0];
  const rotation: Vec3 = Array.isArray(rawRotation)
    ? [
        Number(rawRotation[0] ?? 0),
        Number(rawRotation[1] ?? 0),
        Number(rawRotation[2] ?? 0),
      ]
    : [0, 0, 0];

  return {
    position: sanitizeVec3(position),
    rotation: sanitizeVec3(rotation),
    scale: sanitizeScale(input?.scale ?? 1),
  };
}

function normalizeSplintSettings(input?: Partial<SplintSettings> | null): SplintSettings {
  return {
    baseClearance: Math.max(0, Number(input?.baseClearance ?? DEFAULT_SPLINT_SETTINGS.baseClearance)),
    reliefExtraClearance: Math.max(
      0,
      Number(input?.reliefExtraClearance ?? DEFAULT_SPLINT_SETTINGS.reliefExtraClearance)
    ),
    thickness: Math.max(0.1, Number(input?.thickness ?? DEFAULT_SPLINT_SETTINGS.thickness)),
    seamCutWidth: Math.max(0, Number(input?.seamCutWidth ?? DEFAULT_SPLINT_SETTINGS.seamCutWidth)),
    borderSmoothIterations: Math.max(
      0,
      Math.floor(Number(input?.borderSmoothIterations ?? DEFAULT_SPLINT_SETTINGS.borderSmoothIterations))
    ),
  };
}

function computeTriangleDiff(prev: number[], next: number[]): TriangleChange[] {
  const changes: TriangleChange[] = [];
  const count = Math.min(prev.length, next.length);
  for (let i = 0; i < count; i += 1) {
    if (prev[i] !== next[i]) {
      changes.push({
        triangleIndex: i,
        prevGroupId: prev[i],
        nextGroupId: next[i],
      });
    }
  }
  return changes;
}

function sanitizeCurvePoint(point: SurfaceCurvePoint): SurfaceCurvePoint {
  return {
    id: point.id,
    triangleIndex: Math.max(0, Math.floor(point.triangleIndex)),
    barycentricCoords: [
      Number(point.barycentricCoords[0] ?? 0),
      Number(point.barycentricCoords[1] ?? 0),
      Number(point.barycentricCoords[2] ?? 0),
    ],
    worldPosition: sanitizeVec3(point.worldPosition),
  };
}

function normalizeCurves(curves?: SurfaceCurve[]): SurfaceCurve[] {
  if (!curves?.length) {
    return [];
  }
  return curves.map((curve, index) => ({
    id: curve.id || `curve-${index + 1}`,
    name: curve.name?.trim() || `Curve ${index + 1}`,
    kind: curve.kind === "seam" ? "seam" : "trim",
    closed: Boolean(curve.closed),
    points: (curve.points ?? []).map(sanitizeCurvePoint),
  }));
}

const createInitialData = (): Omit<
  EditorStoreState,
  | "setModelPath"
  | "setModelFile"
  | "setModelPosition"
  | "translateModel"
  | "setModelRotation"
  | "rotateModel"
  | "setModelScale"
  | "centerModel"
  | "resetModelTransform"
  | "syncModel"
  | "setTriangleAdjacency"
  | "setLoadingModel"
  | "setModelError"
  | "setBrushMode"
  | "setBrushRadius"
  | "setShowRotateGizmo"
  | "setShowPerfHud"
  | "setPerfStats"
  | "setActiveGroupId"
  | "setLastPickedTriangleIndex"
  | "createGroup"
  | "renameGroup"
  | "setGroupColor"
  | "setGroupVisibility"
  | "setGroupType"
  | "applyTriangleChanges"
  | "pushHistoryOperation"
  | "floodFillFromPicked"
  | "smoothBoundaries"
  | "removeSpeckles"
  | "growActiveGroup"
  | "shrinkActiveGroup"
  | "undo"
  | "redo"
  | "addLandmark"
  | "removeLandmark"
  | "focusLandmark"
  | "createCurve"
  | "renameCurve"
  | "setCurveKind"
  | "setActiveCurveId"
  | "toggleCurveClosed"
  | "deleteCurve"
  | "addPointToActiveCurve"
  | "updateCurvePoint"
  | "deleteCurvePoint"
  | "setSelectedCurvePointId"
  | "setPickingRegionSeed"
  | "setRegionSeedTriangleIndex"
  | "requestRegionCompute"
  | "setRegionResult"
  | "clearRegion"
  | "setSplintSettings"
  | "requestSplintGeneration"
  | "setSplintStatus"
  | "setSplintReady"
  | "clearSplint"
  | "toSession"
  | "loadSession"
> => ({
  modelPath: "",
  modelFile: null,
  modelTransform: { ...DEFAULT_MODEL_TRANSFORM },
  triangleCount: 0,
  triangleOrderHash: "",
  triangleAdjacency: [],
  groupIds: [],
  groups: defaultGroups(),
  activeGroupId: 1,
  brushMode: "paint",
  brushRadius: 0.25,
  showRotateGizmo: false,
  showPerfHud: false,
  perfStats: {
    fps: 0,
    strokeMs: 0,
    strokeTriangles: 0,
  },
  loadingModel: false,
  modelError: null,
  landmarks: [],
  lastPickedTriangleIndex: null,
  focusLandmarkId: null,
  focusRequestNonce: 0,
  undoStack: [],
  redoStack: [],

  curves: [],
  activeCurveId: null,
  selectedCurvePointId: null,
  pickingRegionSeed: false,
  regionSeedTriangleIndex: null,
  inRegion: [],
  regionBoundaryTriangles: [],
  regionComputeNonce: 0,

  splintSettings: { ...DEFAULT_SPLINT_SETTINGS },
  splintGenerateNonce: 0,
  splintStatus: null,
  splintReady: false,
});

export const createEditorStore = () =>
  createStore<EditorStoreState>((set, get) => ({
    ...createInitialData(),
    setModelPath: (path) => {
      set({ modelPath: path, modelFile: null });
    },
    setModelFile: (file) => {
      const uploadedIdentifier = `uploaded:${file.name}:${file.size}:${file.lastModified}`;
      set({
        modelPath: uploadedIdentifier,
        modelFile: file,
      });
    },
    setModelPosition: (position) =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          position: sanitizeVec3(position),
        },
      })),
    translateModel: (delta) =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          position: sanitizeVec3([
            state.modelTransform.position[0] + delta[0],
            state.modelTransform.position[1] + delta[1],
            state.modelTransform.position[2] + delta[2],
          ]),
        },
      })),
    setModelRotation: (rotation) =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          rotation: sanitizeVec3(rotation),
        },
      })),
    rotateModel: (delta) =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          rotation: sanitizeVec3([
            state.modelTransform.rotation[0] + delta[0],
            state.modelTransform.rotation[1] + delta[1],
            state.modelTransform.rotation[2] + delta[2],
          ]),
        },
      })),
    setModelScale: (scale) =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          scale: sanitizeScale(scale),
        },
      })),
    centerModel: () =>
      set((state) => ({
        modelTransform: {
          ...state.modelTransform,
          position: [0, 0, 0],
        },
      })),
    resetModelTransform: () =>
      set({
        modelTransform: { ...DEFAULT_MODEL_TRANSFORM },
      }),
    syncModel: (modelPath, triangleCount, triangleOrderHash) => {
      set((state) => {
        const canReuseSession =
          state.modelPath === modelPath &&
          state.groupIds.length === triangleCount &&
          state.triangleOrderHash === triangleOrderHash;

        return {
          modelPath,
          triangleCount,
          triangleOrderHash,
          groupIds: canReuseSession
            ? normalizeGroupIdsLength(state.groupIds, triangleCount)
            : new Array(triangleCount).fill(0),
          triangleAdjacency: canReuseSession ? state.triangleAdjacency : [],
          curves: canReuseSession ? state.curves : [],
          activeCurveId: canReuseSession ? state.activeCurveId : null,
          selectedCurvePointId: null,
          pickingRegionSeed: false,
          regionSeedTriangleIndex: canReuseSession ? state.regionSeedTriangleIndex : null,
          inRegion: canReuseSession
            ? normalizeGroupIdsLength(
                state.inRegion.map((value) => (value ? 1 : 0)),
                triangleCount
              ).map((value) => value === 1)
            : new Array(triangleCount).fill(false),
          regionBoundaryTriangles: canReuseSession ? state.regionBoundaryTriangles : [],
          lastPickedTriangleIndex: null,
          undoStack: canReuseSession ? state.undoStack : [],
          redoStack: canReuseSession ? state.redoStack : [],
          splintReady: false,
          splintStatus: null,
        };
      });
    },
    setTriangleAdjacency: (triangleAdjacency) => {
      set({ triangleAdjacency });
    },
    setLoadingModel: (loadingModel) => set({ loadingModel }),
    setModelError: (modelError) => set({ modelError }),
    setBrushMode: (brushMode) => set({ brushMode }),
    setBrushRadius: (brushRadius) =>
      set({
        brushRadius: Math.max(0.0001, Number(brushRadius.toFixed(5))),
      }),
    setShowRotateGizmo: (showRotateGizmo) => set({ showRotateGizmo }),
    setShowPerfHud: (showPerfHud) => set({ showPerfHud }),
    setPerfStats: (stats) =>
      set((state) => ({
        perfStats: {
          ...state.perfStats,
          ...stats,
        },
      })),
    setActiveGroupId: (activeGroupId) =>
      set((state) => ({
        activeGroupId,
        groups: ensureGroup(state.groups, activeGroupId),
      })),
    setLastPickedTriangleIndex: (lastPickedTriangleIndex) => set({ lastPickedTriangleIndex }),
    createGroup: () => {
      const state = get();
      const allIds = Object.keys(state.groups).map(Number);
      const nextId = (allIds.length ? Math.max(...allIds) : 0) + 1;
      set((current) => ({
        groups: ensureGroup(current.groups, nextId),
        activeGroupId: nextId,
      }));
      return nextId;
    },
    renameGroup: (groupId, name) =>
      set((state) => ({
        groups: {
          ...state.groups,
          [groupId]: {
            ...(state.groups[groupId] ?? {
              id: groupId,
              color: paletteColorForGroup(groupId),
              visible: true,
              type: "default",
            }),
            name: name.trim() || (groupId === 0 ? "Unassigned" : `Group ${groupId}`),
          },
        },
      })),
    setGroupColor: (groupId, color) =>
      set((state) => ({
        groups: {
          ...state.groups,
          [groupId]: {
            ...(state.groups[groupId] ?? {
              id: groupId,
              name: groupId === 0 ? "Unassigned" : `Group ${groupId}`,
              visible: true,
              type: "default",
            }),
            color,
          },
        },
      })),
    setGroupVisibility: (groupId, visible) =>
      set((state) => ({
        groups: {
          ...state.groups,
          [groupId]: {
            ...(state.groups[groupId] ?? {
              id: groupId,
              name: groupId === 0 ? "Unassigned" : `Group ${groupId}`,
              color: paletteColorForGroup(groupId),
              type: "default",
            }),
            visible,
          },
        },
      })),
    setGroupType: (groupId, type) =>
      set((state) => ({
        groups: {
          ...state.groups,
          [groupId]: {
            ...(state.groups[groupId] ?? {
              id: groupId,
              name: groupId === 0 ? "Unassigned" : `Group ${groupId}`,
              color: paletteColorForGroup(groupId),
              visible: true,
            }),
            type,
          },
        },
      })),
    applyTriangleChanges: (changes, pushHistory = true) => {
      if (!changes.length) {
        return;
      }
      set((state) => {
        if (!state.groupIds.length) {
          return {};
        }

        const nextGroupIds = state.groupIds.slice();
        let groups = state.groups;
        const effectiveChanges: TriangleChange[] = [];

        for (const change of changes) {
          if (change.triangleIndex < 0 || change.triangleIndex >= nextGroupIds.length) {
            continue;
          }
          const currentValue = nextGroupIds[change.triangleIndex];
          if (currentValue === change.nextGroupId) {
            continue;
          }
          effectiveChanges.push({
            triangleIndex: change.triangleIndex,
            prevGroupId: currentValue,
            nextGroupId: change.nextGroupId,
          });
          nextGroupIds[change.triangleIndex] = change.nextGroupId;
          groups = ensureGroup(groups, currentValue);
          groups = ensureGroup(groups, change.nextGroupId);
        }

        if (!effectiveChanges.length) {
          return {};
        }

        return {
          groupIds: nextGroupIds,
          groups,
          undoStack: pushHistory
            ? [...state.undoStack, { id: operationId(), changes: effectiveChanges }]
            : state.undoStack,
          redoStack: pushHistory ? [] : state.redoStack,
        };
      });
    },
    pushHistoryOperation: (changes) => {
      if (!changes.length) {
        return;
      }
      set((state) => ({
        undoStack: [...state.undoStack, { id: operationId(), changes }],
        redoStack: [],
      }));
    },
    floodFillFromPicked: (constrainToSourceGroup) => {
      const state = get();
      const startTriangle = state.lastPickedTriangleIndex;
      if (
        startTriangle == null ||
        startTriangle < 0 ||
        startTriangle >= state.groupIds.length ||
        !state.triangleAdjacency.length
      ) {
        return;
      }
      const indices = floodFillTriangles(
        state.groupIds,
        state.triangleAdjacency,
        startTriangle,
        state.activeGroupId,
        constrainToSourceGroup
      );
      const changes = indices.map((triangleIndex) => ({
        triangleIndex,
        prevGroupId: state.groupIds[triangleIndex] ?? 0,
        nextGroupId: state.activeGroupId,
      }));
      state.applyTriangleChanges(changes, true);
    },
    smoothBoundaries: (iterations) => {
      const state = get();
      if (!state.groupIds.length || !state.triangleAdjacency.length) {
        return;
      }
      const next = smoothBoundaryGroups(state.groupIds, state.triangleAdjacency, iterations);
      const changes = computeTriangleDiff(state.groupIds, next);
      state.applyTriangleChanges(changes, true);
    },
    removeSpeckles: (threshold) => {
      const state = get();
      if (!state.groupIds.length || !state.triangleAdjacency.length) {
        return;
      }
      const next = removeSpecklesBySize(state.groupIds, state.triangleAdjacency, threshold);
      const changes = computeTriangleDiff(state.groupIds, next);
      state.applyTriangleChanges(changes, true);
    },
    growActiveGroup: (steps) => {
      const state = get();
      if (!state.groupIds.length || !state.triangleAdjacency.length) {
        return;
      }
      const next = growGroupIds(state.groupIds, state.triangleAdjacency, state.activeGroupId, steps);
      const changes = computeTriangleDiff(state.groupIds, next);
      state.applyTriangleChanges(changes, true);
    },
    shrinkActiveGroup: (steps) => {
      const state = get();
      if (!state.groupIds.length || !state.triangleAdjacency.length) {
        return;
      }
      const next = shrinkGroupIds(state.groupIds, state.triangleAdjacency, state.activeGroupId, steps);
      const changes = computeTriangleDiff(state.groupIds, next);
      state.applyTriangleChanges(changes, true);
    },
    undo: () =>
      set((state) => {
        if (!state.undoStack.length) {
          return {};
        }
        const operation = state.undoStack[state.undoStack.length - 1];
        const nextGroupIds = state.groupIds.slice();
        let groups = state.groups;
        for (const change of operation.changes) {
          nextGroupIds[change.triangleIndex] = change.prevGroupId;
          groups = ensureGroup(groups, change.prevGroupId);
        }
        return {
          groupIds: nextGroupIds,
          groups,
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, operation],
        };
      }),
    redo: () =>
      set((state) => {
        if (!state.redoStack.length) {
          return {};
        }
        const operation = state.redoStack[state.redoStack.length - 1];
        const nextGroupIds = state.groupIds.slice();
        let groups = state.groups;
        for (const change of operation.changes) {
          nextGroupIds[change.triangleIndex] = change.nextGroupId;
          groups = ensureGroup(groups, change.nextGroupId);
        }
        return {
          groupIds: nextGroupIds,
          groups,
          undoStack: [...state.undoStack, operation],
          redoStack: state.redoStack.slice(0, -1),
        };
      }),
    addLandmark: (landmark) =>
      set((state) => ({
        landmarks: [
          ...state.landmarks,
          {
            id: landmark.id ?? landmarkId(),
            name: landmark.name,
            groupId: landmark.groupId,
            normal: landmark.normal,
            position: landmark.position,
          },
        ],
      })),
    removeLandmark: (id) =>
      set((state) => ({
        landmarks: state.landmarks.filter((item) => item.id !== id),
      })),
    focusLandmark: (id) =>
      set((state) => ({
        focusLandmarkId: id,
        focusRequestNonce: state.focusRequestNonce + 1,
      })),

    createCurve: (kind) => {
      const id = curveId();
      set((state) => ({
        curves: [
          ...state.curves,
          {
            id,
            name: kind === "trim" ? `Trim ${state.curves.filter((c) => c.kind === "trim").length + 1}` : `Seam ${state.curves.filter((c) => c.kind === "seam").length + 1}`,
            kind,
            closed: false,
            points: [],
          },
        ],
        activeCurveId: id,
        selectedCurvePointId: null,
      }));
      return id;
    },
    renameCurve: (curveIdValue, name) =>
      set((state) => ({
        curves: state.curves.map((curve) =>
          curve.id === curveIdValue ? { ...curve, name: name.trim() || curve.name } : curve
        ),
      })),
    setCurveKind: (curveIdValue, kind) =>
      set((state) => ({
        curves: state.curves.map((curve) => (curve.id === curveIdValue ? { ...curve, kind } : curve)),
      })),
    setActiveCurveId: (activeCurveId) => set({ activeCurveId, selectedCurvePointId: null }),
    toggleCurveClosed: (curveIdValue) =>
      set((state) => ({
        curves: state.curves.map((curve) =>
          curve.id === curveIdValue ? { ...curve, closed: !curve.closed } : curve
        ),
      })),
    deleteCurve: (curveIdValue) =>
      set((state) => {
        const nextCurves = state.curves.filter((curve) => curve.id !== curveIdValue);
        const nextActive = state.activeCurveId === curveIdValue ? nextCurves[0]?.id ?? null : state.activeCurveId;
        return {
          curves: nextCurves,
          activeCurveId: nextActive,
          selectedCurvePointId: null,
        };
      }),
    addPointToActiveCurve: (point) =>
      set((state) => {
        let activeId = state.activeCurveId;
        let curves = state.curves;
        if (!activeId) {
          activeId = curveId();
          curves = [
            ...curves,
            {
              id: activeId,
              name: `Trim ${state.curves.filter((curve) => curve.kind === "trim").length + 1}`,
              kind: "trim",
              closed: false,
              points: [],
            },
          ];
        }

        return {
          curves: curves.map((curve) =>
            curve.id === activeId
              ? {
                  ...curve,
                  points: [...curve.points, sanitizeCurvePoint(point)],
                }
              : curve
          ),
          activeCurveId: activeId,
          selectedCurvePointId: point.id,
        };
      }),
    updateCurvePoint: (curveIdValue, pointId, point) =>
      set((state) => ({
        curves: state.curves.map((curve) =>
          curve.id === curveIdValue
            ? {
                ...curve,
                points: curve.points.map((item) =>
                  item.id === pointId ? sanitizeCurvePoint({ ...point, id: pointId }) : item
                ),
              }
            : curve
        ),
      })),
    deleteCurvePoint: (curveIdValue, pointId) =>
      set((state) => ({
        curves: state.curves.map((curve) =>
          curve.id === curveIdValue
            ? {
                ...curve,
                points: curve.points.filter((point) => point.id !== pointId),
              }
            : curve
        ),
        selectedCurvePointId: state.selectedCurvePointId === pointId ? null : state.selectedCurvePointId,
      })),
    setSelectedCurvePointId: (selectedCurvePointId) => set({ selectedCurvePointId }),

    setPickingRegionSeed: (pickingRegionSeed) => set({ pickingRegionSeed }),
    setRegionSeedTriangleIndex: (regionSeedTriangleIndex) => set({ regionSeedTriangleIndex }),
    requestRegionCompute: () =>
      set((state) => ({
        regionComputeNonce: state.regionComputeNonce + 1,
      })),
    setRegionResult: (inRegion, boundaryTriangles) =>
      set((state) => ({
        inRegion: normalizeGroupIdsLength(
          inRegion.map((item) => (item ? 1 : 0)),
          state.triangleCount
        ).map((item) => item === 1),
        regionBoundaryTriangles: boundaryTriangles,
      })),
    clearRegion: () =>
      set((state) => ({
        inRegion: new Array(state.triangleCount).fill(false),
        regionBoundaryTriangles: [],
      })),

    setSplintSettings: (partial) =>
      set((state) => ({
        splintSettings: normalizeSplintSettings({ ...state.splintSettings, ...partial }),
      })),
    requestSplintGeneration: () =>
      set((state) => ({
        splintGenerateNonce: state.splintGenerateNonce + 1,
        splintStatus: null,
      })),
    setSplintStatus: (splintStatus) => set({ splintStatus }),
    setSplintReady: (splintReady) => set({ splintReady }),
    clearSplint: () => set({ splintReady: false, splintStatus: null }),

    toSession: () => {
      const state = get();
      return {
        version: 1,
        modelPath: state.modelPath,
        modelTransform: state.modelTransform,
        triangleCount: state.triangleCount,
        triangleOrderHash: state.triangleOrderHash,
        groupIdsEncoded: encodeGroupIds(state.groupIds),
        groups: Object.values(state.groups).sort((a, b) => a.id - b.id),
        landmarks: state.landmarks,
        activeGroupId: state.activeGroupId,
        curves: state.curves,
        activeCurveId: state.activeCurveId,
        regionSeedTriangleIndex: state.regionSeedTriangleIndex,
        inRegion: state.inRegion,
        splintSettings: state.splintSettings,
      };
    },
    loadSession: (session) => {
      if (session.version !== 1) {
        throw new Error(`Unsupported session version: ${session.version}`);
      }
      const decoded = decodeGroupIds(session.groupIdsEncoded);
      if (decoded.length !== session.triangleCount) {
        throw new Error(
          `Session triangle count mismatch: declared ${session.triangleCount}, decoded ${decoded.length}`
        );
      }
      const nextGroups = defaultGroups();
      for (const group of session.groups) {
        nextGroups[group.id] = {
          ...group,
          type: group.type === "relief" ? "relief" : "default",
        };
      }

      const normalizedCurves = normalizeCurves(session.curves);
      const normalizedRegion = normalizeGroupIdsLength(
        (session.inRegion ?? []).map((item) => (item ? 1 : 0)),
        session.triangleCount
      ).map((item) => item === 1);

      set({
        modelPath: session.modelPath,
        modelFile: null,
        modelTransform: normalizeModelTransform(session.modelTransform),
        showRotateGizmo: false,
        showPerfHud: false,
        triangleCount: session.triangleCount,
        triangleOrderHash: session.triangleOrderHash ?? "",
        triangleAdjacency: [],
        groupIds: normalizeGroupIdsLength(decoded, session.triangleCount),
        groups: nextGroups,
        landmarks: session.landmarks,
        lastPickedTriangleIndex: null,
        activeGroupId: session.activeGroupId,
        undoStack: [],
        redoStack: [],
        curves: normalizedCurves,
        activeCurveId:
          normalizedCurves.find((curve) => curve.id === session.activeCurveId)?.id ??
          normalizedCurves[0]?.id ??
          null,
        selectedCurvePointId: null,
        pickingRegionSeed: false,
        regionSeedTriangleIndex: session.regionSeedTriangleIndex ?? null,
        inRegion: normalizedRegion,
        regionBoundaryTriangles: [],
        splintSettings: normalizeSplintSettings(session.splintSettings),
        splintReady: false,
        splintStatus: null,
      });
    },
  }));

export const editorStoreApi = createEditorStore();

export const useEditorStore = <T,>(selector: (state: EditorStoreState) => T) =>
  useStore(editorStoreApi, selector);
