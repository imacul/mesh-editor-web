import { useMemo } from "react";
import { useEditorStore } from "../state/editorStore";

export function CurvesPanel() {
  const curves = useEditorStore((state) => state.curves);
  const activeCurveId = useEditorStore((state) => state.activeCurveId);
  const selectedCurvePointId = useEditorStore((state) => state.selectedCurvePointId);
  const pickingRegionSeed = useEditorStore((state) => state.pickingRegionSeed);
  const regionSeedTriangleIndex = useEditorStore((state) => state.regionSeedTriangleIndex);
  const inRegion = useEditorStore((state) => state.inRegion);
  const createCurve = useEditorStore((state) => state.createCurve);
  const renameCurve = useEditorStore((state) => state.renameCurve);
  const setCurveKind = useEditorStore((state) => state.setCurveKind);
  const setActiveCurveId = useEditorStore((state) => state.setActiveCurveId);
  const toggleCurveClosed = useEditorStore((state) => state.toggleCurveClosed);
  const deleteCurve = useEditorStore((state) => state.deleteCurve);
  const deleteCurvePoint = useEditorStore((state) => state.deleteCurvePoint);
  const setSelectedCurvePointId = useEditorStore((state) => state.setSelectedCurvePointId);
  const setPickingRegionSeed = useEditorStore((state) => state.setPickingRegionSeed);
  const requestRegionCompute = useEditorStore((state) => state.requestRegionCompute);
  const clearRegion = useEditorStore((state) => state.clearRegion);

  const activeCurve = curves.find((curve) => curve.id === activeCurveId) ?? null;
  const regionCount = useMemo(
    () => inRegion.reduce((total, flag) => (flag ? total + 1 : total), 0),
    [inRegion]
  );

  return (
    <section className="panel">
      <h2>Curves & Region</h2>
      <div className="panel-row">
        <button className="btn" type="button" onClick={() => createCurve("trim")}>
          New Trim
        </button>
        <button className="btn" type="button" onClick={() => createCurve("seam")}>
          New Seam
        </button>
      </div>

      <div>
        {curves.length === 0 ? (
          <p className="hint">No curves yet. Select Trim Curve tool and click on mesh.</p>
        ) : (
          curves.map((curve) => (
            <div key={curve.id} className={`group-item ${curve.id === activeCurveId ? "active" : ""}`}>
              <div className="group-top">
                <button className="btn" type="button" onClick={() => setActiveCurveId(curve.id)}>
                  Use
                </button>
                <select
                  value={curve.kind}
                  onChange={(event) => setCurveKind(curve.id, event.target.value === "seam" ? "seam" : "trim")}
                >
                  <option value="trim">Trim</option>
                  <option value="seam">Seam</option>
                </select>
                <button className="btn" type="button" onClick={() => toggleCurveClosed(curve.id)}>
                  {curve.closed ? "Closed" : "Open"}
                </button>
                <button className="btn" type="button" onClick={() => deleteCurve(curve.id)}>
                  Delete
                </button>
              </div>
              <div className="panel-row" style={{ marginTop: 8, marginBottom: 0 }}>
                <input
                  className="group-name-input"
                  type="text"
                  value={curve.name}
                  onChange={(event) => renameCurve(curve.id, event.target.value)}
                />
                <span className="hint">{curve.points.length} pts</span>
              </div>
            </div>
          ))
        )}
      </div>

      {activeCurve ? (
        <>
          <div className="panel-row">
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (!selectedCurvePointId) {
                  return;
                }
                deleteCurvePoint(activeCurve.id, selectedCurvePointId);
                setSelectedCurvePointId(null);
              }}
              disabled={!selectedCurvePointId}
            >
              Delete Selected Point
            </button>
          </div>
          <p className="hint">Selected point: {selectedCurvePointId ?? "none"}</p>
          <p className="hint">Drag a curve point marker to edit. Click mesh to append points.</p>
        </>
      ) : null}

      <div className="panel-row" style={{ marginTop: 8 }}>
        <button
          className={`btn ${pickingRegionSeed ? "active" : ""}`}
          type="button"
          onClick={() => setPickingRegionSeed(!pickingRegionSeed)}
        >
          {pickingRegionSeed ? "Picking Seed..." : "Pick Region Seed"}
        </button>
        <button className="btn" type="button" onClick={() => requestRegionCompute()}>
          Compute Region
        </button>
        <button className="btn" type="button" onClick={() => clearRegion()}>
          Clear Region
        </button>
      </div>
      <p className="hint">Seed triangle: {regionSeedTriangleIndex ?? "none"}</p>
      <p className="hint">Region triangles: {regionCount}</p>
    </section>
  );
}
