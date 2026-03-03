import { useMemo } from "react";
import { useEditorStore } from "../state/editorStore";
import type { BrushMode } from "../state/types";
import { CleanupPanel } from "./CleanupPanel";
import { CurvesPanel } from "./CurvesPanel";
import { ExportPanel } from "./ExportPanel";
import { GroupsPanel } from "./GroupsPanel";
import { LandmarksPanel } from "./LandmarksPanel";
import { SessionPanel } from "./SessionPanel";
import { SplintPanel } from "./SplintPanel";
import { TransformPanel } from "./TransformPanel";

const BRUSH_RADIUS_MIN = 0.0001;
const BRUSH_RADIUS_MAX = 5;
const BRUSH_SLIDER_STEPS = 1000;

function radiusToSliderValue(radius: number): number {
  const clamped = Math.min(BRUSH_RADIUS_MAX, Math.max(BRUSH_RADIUS_MIN, radius));
  const ratio = Math.log(clamped / BRUSH_RADIUS_MIN) / Math.log(BRUSH_RADIUS_MAX / BRUSH_RADIUS_MIN);
  return Math.round(ratio * BRUSH_SLIDER_STEPS);
}

function sliderValueToRadius(value: number): number {
  const ratio = Math.min(1, Math.max(0, value / BRUSH_SLIDER_STEPS));
  return BRUSH_RADIUS_MIN * Math.pow(BRUSH_RADIUS_MAX / BRUSH_RADIUS_MIN, ratio);
}

const MODE_OPTIONS: Array<{ mode: BrushMode; label: string }> = [
  { mode: "paint", label: "Paint" },
  { mode: "erase", label: "Erase" },
  { mode: "pick", label: "Pick" },
  { mode: "trimCurve", label: "Trim Curve" },
  { mode: "landmark", label: "Landmark" },
];

export function Sidebar() {
  const brushMode = useEditorStore((state) => state.brushMode);
  const setBrushMode = useEditorStore((state) => state.setBrushMode);
  const brushRadius = useEditorStore((state) => state.brushRadius);
  const setBrushRadius = useEditorStore((state) => state.setBrushRadius);
  const triangleCount = useEditorStore((state) => state.triangleCount);
  const groupIds = useEditorStore((state) => state.groupIds);
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
  const setShowPerfHud = useEditorStore((state) => state.setShowPerfHud);

  const brushSliderValue = useMemo(() => radiusToSliderValue(brushRadius), [brushRadius]);
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
            min={0}
            max={BRUSH_SLIDER_STEPS}
            step={1}
            type="range"
            value={brushSliderValue}
            onChange={(event) => setBrushRadius(sliderValueToRadius(Number(event.target.value)))}
          />
        </div>
        <div className="panel-row">
          <button
            className={`btn ${showPerfHud ? "active" : ""}`}
            onClick={() => setShowPerfHud(!showPerfHud)}
            type="button"
          >
            {showPerfHud ? "Hide Perf HUD" : "Show Perf HUD"}
          </button>
        </div>
        <p className="hint">Radius: {brushRadius.toFixed(4)}</p>
        <p className="hint">Shortcuts: `[` and `]` brush size, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo</p>
        <p className="hint">
          Triangles: {triangleCount} | Painted: {paintedFaces}
        </p>
      </section>

      <TransformPanel />
      <CurvesPanel />
      <SplintPanel />
      <CleanupPanel />
      <GroupsPanel />
      <LandmarksPanel />
      <ExportPanel />
      <SessionPanel />
    </aside>
  );
}
