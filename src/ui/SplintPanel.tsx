import { useEditorStore } from "../state/editorStore";

export function SplintPanel() {
  const splintSettings = useEditorStore((state) => state.splintSettings);
  const splintStatus = useEditorStore((state) => state.splintStatus);
  const splintReady = useEditorStore((state) => state.splintReady);
  const setSplintSettings = useEditorStore((state) => state.setSplintSettings);
  const requestSplintGeneration = useEditorStore((state) => state.requestSplintGeneration);
  const clearSplint = useEditorStore((state) => state.clearSplint);

  return (
    <section className="panel">
      <h2>Splint Generator</h2>
      <div className="panel-row">
        <label htmlFor="base-clearance">Base Clear</label>
        <input
          id="base-clearance"
          type="number"
          min={0}
          step={0.1}
          value={splintSettings.baseClearance}
          onChange={(event) => setSplintSettings({ baseClearance: Number(event.target.value) })}
        />
      </div>
      <div className="panel-row">
        <label htmlFor="relief-extra">Relief +</label>
        <input
          id="relief-extra"
          type="number"
          min={0}
          step={0.1}
          value={splintSettings.reliefExtraClearance}
          onChange={(event) => setSplintSettings({ reliefExtraClearance: Number(event.target.value) })}
        />
      </div>
      <div className="panel-row">
        <label htmlFor="splint-thickness">Thickness</label>
        <input
          id="splint-thickness"
          type="number"
          min={0.1}
          step={0.1}
          value={splintSettings.thickness}
          onChange={(event) => setSplintSettings({ thickness: Number(event.target.value) })}
        />
      </div>
      <div className="panel-row">
        <label htmlFor="seam-cut">Seam Cut</label>
        <input
          id="seam-cut"
          type="number"
          min={0}
          step={0.1}
          value={splintSettings.seamCutWidth}
          onChange={(event) => setSplintSettings({ seamCutWidth: Number(event.target.value) })}
        />
      </div>
      <div className="panel-row">
        <label htmlFor="border-smooth">Border Smooth</label>
        <input
          id="border-smooth"
          type="number"
          min={0}
          max={20}
          step={1}
          value={splintSettings.borderSmoothIterations}
          onChange={(event) =>
            setSplintSettings({ borderSmoothIterations: Number.parseInt(event.target.value, 10) || 0 })
          }
        />
      </div>

      <div className="panel-row">
        <button className="btn" type="button" onClick={() => requestSplintGeneration()}>
          Generate Splint
        </button>
        <button className="btn" type="button" onClick={() => clearSplint()}>
          Clear Result
        </button>
      </div>
      <p className="hint">Relief groups add clearance where painted triangles belong to `relief` type.</p>
      <p className="hint">Splint ready: {splintReady ? "Yes" : "No"}</p>
      {splintStatus ? <p className="hint">{splintStatus}</p> : null}
    </section>
  );
}
