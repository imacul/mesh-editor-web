import { ChangeEvent, useState } from "react";
import { saveCase } from "../api/client";
import { editorStoreApi, useEditorStore } from "../state/editorStore";

export function SessionPanel() {
  const modelFile = useEditorStore((state) => state.modelFile);
  const setModelFile = useEditorStore((state) => state.setModelFile);

  const [caseName, setCaseName] = useState("");
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const uploadMesh = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setModelFile(file);
    setImportError(null);
    event.target.value = "";
  };

  const handleSaveCase = async () => {
    const name = caseName.trim();
    if (!name) {
      setSaveStatus("Enter a case name first");
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      const session = editorStoreApi.getState().toSession();
      const sessionJson = JSON.stringify(session);
      const file = editorStoreApi.getState().modelFile;
      const id = await saveCase(name, sessionJson, file, currentCaseId ?? undefined);
      setCurrentCaseId(id);
      setSaveStatus(currentCaseId ? "Case updated!" : "Case saved!");
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <section className="panel">
      <h2>Session</h2>

      {/* ── Mesh upload ── */}
      <div className="panel-row">
        <label htmlFor="mesh-upload">Upload Mesh</label>
        <input
          id="mesh-upload"
          className="import-input"
          type="file"
          accept=".stl,.obj,.ply,.glb,.gltf"
          onChange={uploadMesh}
        />
      </div>
      <p className="hint">Supported: STL, OBJ, PLY, GLB, GLTF</p>
      {modelFile ? <p className="hint">Loaded: {modelFile.name}</p> : null}

      {/* ── Save to Supabase ── */}
      <hr style={{ border: "none", borderTop: "1px solid #1f2d44", margin: "10px 0" }} />
      <div className="panel-row">
        <label htmlFor="case-name">Case Name</label>
        <input
          id="case-name"
          type="text"
          placeholder="My patient case…"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSaveCase(); }}
        />
      </div>
      {currentCaseId && (
        <p className="hint" style={{ marginBottom: 6 }}>
          ID: <code style={{ fontSize: 10, color: "#94a3b8" }}>{currentCaseId}</code>
          {" "}
          <button
            className="btn"
            style={{ fontSize: 10, padding: "1px 5px" }}
            type="button"
            onClick={() => { setCurrentCaseId(null); }}
            title="Save as new case instead of updating"
          >
            New
          </button>
        </p>
      )}
      <div className="panel-row">
        <button
          className="btn"
          type="button"
          onClick={() => void handleSaveCase()}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? "Saving…" : currentCaseId ? "Update Case" : "Save Case"}
        </button>
      </div>
      {saveStatus && (
        <p
          className="hint"
          style={{ color: saveStatus.includes("!") ? "#86efac" : "#fda4af" }}
        >
          {saveStatus}
        </p>
      )}
    </section>
  );
}
