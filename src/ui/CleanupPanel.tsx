import { useState } from "react";
import { useEditorStore } from "../state/editorStore";

export function CleanupPanel() {
  const lastTriangle = useEditorStore((state) => state.lastPickedTriangleIndex);
  const floodFillFromPicked = useEditorStore((state) => state.floodFillFromPicked);
  const smoothBoundaries = useEditorStore((state) => state.smoothBoundaries);
  const removeSpeckles = useEditorStore((state) => state.removeSpeckles);
  const growActiveGroup = useEditorStore((state) => state.growActiveGroup);
  const shrinkActiveGroup = useEditorStore((state) => state.shrinkActiveGroup);

  const [constrainFill, setConstrainFill] = useState(true);
  const [smoothIterations, setSmoothIterations] = useState(1);
  const [speckleThreshold, setSpeckleThreshold] = useState(6);
  const [growShrinkSteps, setGrowShrinkSteps] = useState(1);

  return (
    <section className="panel">
      <h2>Cleanup</h2>
      <p className="hint">Picked triangle: {lastTriangle ?? "none"}</p>
      <div className="panel-row">
        <label style={{ minWidth: 140 }}>
          <input
            type="checkbox"
            checked={constrainFill}
            onChange={(event) => setConstrainFill(event.target.checked)}
          />{" "}
          Fill source group only
        </label>
        <button className="btn" type="button" onClick={() => floodFillFromPicked(constrainFill)}>
          Flood Fill
        </button>
      </div>

      <div className="panel-row">
        <label htmlFor="smooth-iterations">Smooth Iter.</label>
        <input
          id="smooth-iterations"
          type="number"
          min={1}
          max={10}
          value={smoothIterations}
          onChange={(event) => setSmoothIterations(Number(event.target.value))}
        />
        <button className="btn" type="button" onClick={() => smoothBoundaries(smoothIterations)}>
          Smooth
        </button>
      </div>

      <div className="panel-row">
        <label htmlFor="speckle-threshold">Min Island</label>
        <input
          id="speckle-threshold"
          type="number"
          min={1}
          max={1000}
          value={speckleThreshold}
          onChange={(event) => setSpeckleThreshold(Number(event.target.value))}
        />
        <button className="btn" type="button" onClick={() => removeSpeckles(speckleThreshold)}>
          Remove Speckles
        </button>
      </div>

      <div className="panel-row">
        <label htmlFor="grow-shrink-steps">Steps</label>
        <input
          id="grow-shrink-steps"
          type="number"
          min={1}
          max={3}
          value={growShrinkSteps}
          onChange={(event) => setGrowShrinkSteps(Number(event.target.value))}
        />
        <button className="btn" type="button" onClick={() => growActiveGroup(growShrinkSteps)}>
          Grow
        </button>
        <button className="btn" type="button" onClick={() => shrinkActiveGroup(growShrinkSteps)}>
          Shrink
        </button>
      </div>
    </section>
  );
}

