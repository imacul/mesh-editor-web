import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { decodeGroupIds, encodeGroupIds } from "../tools/groupEncoding";
import { paletteColorForGroup } from "../tools/palette";
import type {
  BrushMode,
  EditorSession,
  GroupMeta,
  Landmark,
  PaintOperation,
  TriangleChange,
} from "./types";

export interface EditorStoreState {
  modelPath: string;
  modelFile: File | null;
  triangleCount: number;
  groupIds: number[];
  groups: Record<number, GroupMeta>;
  activeGroupId: number;
  brushMode: BrushMode;
  brushRadius: number;
  loadingModel: boolean;
  modelError: string | null;
  landmarks: Landmark[];
  focusLandmarkId: string | null;
  focusRequestNonce: number;
  undoStack: PaintOperation[];
  redoStack: PaintOperation[];
  setModelPath: (path: string) => void;
  setModelFile: (file: File) => void;
  syncModel: (modelPath: string, triangleCount: number) => void;
  setLoadingModel: (loading: boolean) => void;
  setModelError: (value: string | null) => void;
  setBrushMode: (mode: BrushMode) => void;
  setBrushRadius: (radius: number) => void;
  setActiveGroupId: (groupId: number) => void;
  createGroup: () => number;
  renameGroup: (groupId: number, name: string) => void;
  setGroupColor: (groupId: number, color: string) => void;
  setGroupVisibility: (groupId: number, visible: boolean) => void;
  applyTriangleChanges: (changes: TriangleChange[], pushHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  addLandmark: (
    landmark: Omit<Landmark, "id"> & {
      id?: string;
    }
  ) => void;
  removeLandmark: (id: string) => void;
  focusLandmark: (id: string) => void;
  toSession: () => EditorSession;
  loadSession: (session: EditorSession) => void;
}

function defaultGroups(): Record<number, GroupMeta> {
  return {
    0: { id: 0, name: "Unassigned", color: paletteColorForGroup(0), visible: true },
    1: { id: 1, name: "Group 1", color: paletteColorForGroup(1), visible: true },
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

const createInitialData = (): Omit<
  EditorStoreState,
  | "setModelPath"
  | "setModelFile"
  | "syncModel"
  | "setLoadingModel"
  | "setModelError"
  | "setBrushMode"
  | "setBrushRadius"
  | "setActiveGroupId"
  | "createGroup"
  | "renameGroup"
  | "setGroupColor"
  | "setGroupVisibility"
  | "applyTriangleChanges"
  | "undo"
  | "redo"
  | "addLandmark"
  | "removeLandmark"
  | "focusLandmark"
  | "toSession"
  | "loadSession"
> => ({
  modelPath: "/models/sample.glb",
  modelFile: null,
  triangleCount: 0,
  groupIds: [],
  groups: defaultGroups(),
  activeGroupId: 1,
  brushMode: "paint",
  brushRadius: 0.25,
  loadingModel: false,
  modelError: null,
  landmarks: [],
  focusLandmarkId: null,
  focusRequestNonce: 0,
  undoStack: [],
  redoStack: [],
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
    syncModel: (modelPath, triangleCount) => {
      set((state) => {
        const canReuseSession =
          state.modelPath === modelPath && state.groupIds.length === triangleCount;
        return {
          modelPath,
          triangleCount,
          groupIds: canReuseSession ? state.groupIds : new Array(triangleCount).fill(0),
          undoStack: canReuseSession ? state.undoStack : [],
          redoStack: canReuseSession ? state.redoStack : [],
        };
      });
    },
    setLoadingModel: (loadingModel) => set({ loadingModel }),
    setModelError: (modelError) => set({ modelError }),
    setBrushMode: (brushMode) => set({ brushMode }),
    setBrushRadius: (brushRadius) =>
      set({
        brushRadius: Math.max(0.01, Number(brushRadius.toFixed(3))),
      }),
    setActiveGroupId: (activeGroupId) =>
      set((state) => ({
        activeGroupId,
        groups: ensureGroup(state.groups, activeGroupId),
      })),
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
            }),
            visible,
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
    toSession: () => {
      const state = get();
      return {
        version: 1,
        modelPath: state.modelPath,
        triangleCount: state.triangleCount,
        groupIdsEncoded: encodeGroupIds(state.groupIds),
        groups: Object.values(state.groups).sort((a, b) => a.id - b.id),
        landmarks: state.landmarks,
        activeGroupId: state.activeGroupId,
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
        nextGroups[group.id] = group;
      }
      set({
        modelPath: session.modelPath,
        modelFile: null,
        triangleCount: session.triangleCount,
        groupIds: decoded,
        groups: nextGroups,
        landmarks: session.landmarks,
        activeGroupId: session.activeGroupId,
        undoStack: [],
        redoStack: [],
      });
    },
  }));

export const editorStoreApi = createEditorStore();

export const useEditorStore = <T,>(selector: (state: EditorStoreState) => T) =>
  useStore(editorStoreApi, selector);
