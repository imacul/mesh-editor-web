import { useEditorStore } from "../state/editorStore";
import type { Vec3 } from "../state/types";

type Axis = 0 | 1 | 2;

const AXIS_LABELS: Record<Axis, string> = {
  0: "X",
  1: "Y",
  2: "Z",
};

export function TransformPanel() {
  const modelTransform = useEditorStore((state) => state.modelTransform);
  const showRotateGizmo = useEditorStore((state) => state.showRotateGizmo);
  const setModelPosition = useEditorStore((state) => state.setModelPosition);
  const translateModel = useEditorStore((state) => state.translateModel);
  const setModelScale = useEditorStore((state) => state.setModelScale);
  const setShowRotateGizmo = useEditorStore((state) => state.setShowRotateGizmo);
  const centerModel = useEditorStore((state) => state.centerModel);
  const resetModelTransform = useEditorStore((state) => state.resetModelTransform);

  const setPositionAxis = (axis: Axis, value: number) => {
    const next: Vec3 = [...modelTransform.position] as Vec3;
    next[axis] = Number.isFinite(value) ? value : 0;
    setModelPosition(next);
  };

  const nudge = (axis: Axis, delta: number) => {
    const deltaVec: Vec3 = [0, 0, 0];
    deltaVec[axis] = delta;
    translateModel(deltaVec);
  };

  return (
    <section className="panel">
      <h2>Transform</h2>
      <div className="panel-row">
        <label htmlFor="model-scale-slider">Scale</label>
        <input
          id="model-scale-slider"
          type="range"
          min={0.01}
          max={20}
          step={0.01}
          value={modelTransform.scale}
          onChange={(event) => setModelScale(Number(event.target.value))}
        />
        <span className="hint">x{modelTransform.scale.toFixed(2)}</span>
      </div>
      <div className="panel-row">
        <button className="btn" type="button" onClick={() => setModelScale(modelTransform.scale * 1.1)}>
          Scale +10%
        </button>
        <button className="btn" type="button" onClick={() => setModelScale(modelTransform.scale / 1.1)}>
          Scale -10%
        </button>
      </div>

      {[0, 1, 2].map((axis) => {
        const typedAxis = axis as Axis;
        return (
          <div className="panel-row" key={typedAxis}>
            <label htmlFor={`position-${typedAxis}`}>{AXIS_LABELS[typedAxis]}</label>
            <input
              id={`position-${typedAxis}`}
              type="number"
              step={0.05}
              value={modelTransform.position[typedAxis]}
              onChange={(event) => setPositionAxis(typedAxis, Number(event.target.value))}
            />
            <button className="btn transform-nudge" type="button" onClick={() => nudge(typedAxis, -0.1)}>
              -
            </button>
            <button className="btn transform-nudge" type="button" onClick={() => nudge(typedAxis, 0.1)}>
              +
            </button>
          </div>
        );
      })}

      <div className="panel-row">
        <button
          className={`btn ${showRotateGizmo ? "active" : ""}`}
          type="button"
          onClick={() => setShowRotateGizmo(!showRotateGizmo)}
        >
          {showRotateGizmo ? "Hide Rotate Gizmo" : "Rotate"}
        </button>
        <button className="btn" type="button" onClick={centerModel}>
          Center
        </button>
        <button className="btn" type="button" onClick={resetModelTransform}>
          Reset
        </button>
      </div>
      <p className="hint">Gizmo is visible only after clicking Rotate. Reset also returns scale/rotation.</p>
    </section>
  );
}
