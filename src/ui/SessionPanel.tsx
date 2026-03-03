import { ChangeEvent, useState } from "react";
import { editorStoreApi, useEditorStore } from "../state/editorStore";
import type { EditorSession } from "../state/types";

export function SessionPanel() {
  const modelPath = useEditorStore((state) => state.modelPath);
  const modelFile = useEditorStore((state) => state.modelFile);
  const setModelPath = useEditorStore((state) => state.setModelPath);
  const setModelFile = useEditorStore((state) => state.setModelFile);
  const [draftModelPath, setDraftModelPath] = useState(modelPath);
  const [importError, setImportError] = useState<string | null>(null);

  const exportSession = () => {
    const session = editorStoreApi.getState().toSession();
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mesh-editor-session.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSession = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EditorSession;
      editorStoreApi.getState().loadSession(parsed);
      setDraftModelPath(parsed.modelPath);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import session");
    } finally {
      event.target.value = "";
    }
  };

  const uploadMesh = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setModelFile(file);
    setImportError(null);
    event.target.value = "";
  };

  return (
    <section className="panel">
      <h2>Session</h2>
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
      {modelFile ? <p className="hint">Current upload: {modelFile.name}</p> : null}
      <div className="panel-row">
        <label htmlFor="model-path">Model Path</label>
        <input
          id="model-path"
          type="text"
          value={draftModelPath}
          onChange={(event) => setDraftModelPath(event.target.value)}
        />
      </div>
      <div className="panel-row">
        <button className="btn" type="button" onClick={() => setModelPath(draftModelPath)}>
          Load From Path
        </button>
        <button className="btn" type="button" onClick={exportSession}>
          Export JSON
        </button>
      </div>
      <div className="panel-row">
        <input className="import-input" type="file" accept=".json" onChange={importSession} />
      </div>
      {importError ? <p className="hint" style={{ color: "#fda4af" }}>{importError}</p> : null}
    </section>
  );
}
