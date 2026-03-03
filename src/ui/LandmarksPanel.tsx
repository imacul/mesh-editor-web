import { useEditorStore } from "../state/editorStore";

export function LandmarksPanel() {
  const landmarks = useEditorStore((state) => state.landmarks);
  const removeLandmark = useEditorStore((state) => state.removeLandmark);
  const focusLandmark = useEditorStore((state) => state.focusLandmark);

  return (
    <section className="panel">
      <h2>Landmarks</h2>
      <p className="hint">Select the Landmark tool and click the mesh to place points.</p>
      <div>
        {landmarks.length === 0 ? (
          <p className="hint">No landmarks yet.</p>
        ) : (
          landmarks.map((landmark) => (
            <div key={landmark.id} className="landmark-item">
              <div className="landmark-top">
                <strong>{landmark.name}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn" type="button" onClick={() => focusLandmark(landmark.id)}>
                    Focus
                  </button>
                  <button className="btn" type="button" onClick={() => removeLandmark(landmark.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <p className="landmark-meta">
                group #{landmark.groupId} | ({landmark.position.map((v) => v.toFixed(2)).join(", ")})
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

