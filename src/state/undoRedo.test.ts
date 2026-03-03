import { describe, expect, it } from "vitest";
import { createEditorStore } from "./editorStore";

describe("undo/redo paint operations", () => {
  it("reverts and reapplies triangle group changes", () => {
    const store = createEditorStore();
    store.getState().syncModel("/models/sample.glb", 6);

    store.getState().applyTriangleChanges([
      { triangleIndex: 0, prevGroupId: 0, nextGroupId: 1 },
      { triangleIndex: 2, prevGroupId: 0, nextGroupId: 2 },
    ]);

    expect(store.getState().groupIds).toEqual([1, 0, 2, 0, 0, 0]);
    expect(store.getState().undoStack).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().groupIds).toEqual([0, 0, 0, 0, 0, 0]);
    expect(store.getState().redoStack).toHaveLength(1);

    store.getState().redo();
    expect(store.getState().groupIds).toEqual([1, 0, 2, 0, 0, 0]);
    expect(store.getState().undoStack).toHaveLength(1);
  });

  it("clears redo stack when a new operation is made", () => {
    const store = createEditorStore();
    store.getState().syncModel("/models/sample.glb", 3);

    store.getState().applyTriangleChanges([
      { triangleIndex: 0, prevGroupId: 0, nextGroupId: 1 },
    ]);
    store.getState().undo();
    expect(store.getState().redoStack).toHaveLength(1);

    store.getState().applyTriangleChanges([
      { triangleIndex: 1, prevGroupId: 0, nextGroupId: 2 },
    ]);
    expect(store.getState().redoStack).toHaveLength(0);
  });
});

