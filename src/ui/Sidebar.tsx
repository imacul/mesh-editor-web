import { useMemo } from "react";
import { useEditorStore } from "../state/editorStore";
import type { BrushMode } from "../state/types";
import { GroupsPanel } from "./GroupsPanel";
import { LandmarksPanel } from "./LandmarksPanel";
import { SessionPanel } from "./SessionPanel";

const MODE_OPTIONS: Array<{ mode: BrushMode; label: string }> = [
  { mode: "paint", label: "Paint" },
  { mode: "erase", label: "Erase" },
  { mode: "pick", label: "Pick" },
  { mode: "landmark", label: "Landmark" },
];

export function Sidebar() {
  const brushMode = useEditorStore((state) => state.brushMode);
  const setBrushMode = useEditorStore((state) => state.setBrushMode);
  const brushRadius = useEditorStore((state) => state.brushRadius);
  const setBrushRadius = useEditorStore((state) => state.setBrushRadius);
  const triangleCount = useEditorStore((state) => state.triangleCount);
  const groupIds = useEditorStore((state) => state.groupIds);

  const paintedFaces = useMemo(
    () => groupIds.reduce((count, value) => (value > 0 ? count + 1 : count), 0),
    [groupIds]
  );

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2>Tools</h2>
        <div className="panel-row">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              className={`btn ${brushMode === option.mode ? "active" : ""}`}
              onClick={() => setBrushMode(option.mode)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="panel-row">
          <label htmlFor="brush-radius">Brush Radius</label>
          <input
            id="brush-radius"
            min={0.01}
            max={5}
            step={0.01}
            type="number"
            value={brushRadius}
            onChange={(event) => setBrushRadius(Number(event.target.value))}
          />
        </div>
        <p className="hint">Shortcuts: `[` and `]` brush size, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo</p>
        <p className="hint">
          Triangles: {triangleCount} | Painted: {paintedFaces}
        </p>
      </section>

      <GroupsPanel />
      <LandmarksPanel />
      <SessionPanel />
    </aside>
  );
}

