import { useState } from "react";
import { getRuntimeMesh } from "../engine/runtimeMesh";
import { exportCombinedGLBWithGroupColors } from "../export/glbExport";
import { exportVisibleGroupsAsSTL } from "../export/stlExport";
import { editorStoreApi, useEditorStore } from "../state/editorStore";

export function ExportPanel() {
  const modelPath = useEditorStore((state) => state.modelPath);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const exportSTL = () => {
    const mesh = getRuntimeMesh();
    const state = editorStoreApi.getState();
    if (!mesh) {
      setExportStatus("No mesh loaded.");
      return;
    }
    const baseName = modelPath.replace(/[^\w-]+/g, "_") || "mesh";
    const count = exportVisibleGroupsAsSTL({
      mesh,
      groupIds: state.groupIds,
      groups: state.groups,
      baseName,
    });
    setExportStatus(`Exported ${count} STL file(s).`);
  };

  const exportGLB = async () => {
    const mesh = getRuntimeMesh();
    const state = editorStoreApi.getState();
    if (!mesh) {
      setExportStatus("No mesh loaded.");
      return;
    }
    const baseName = modelPath.replace(/[^\w-]+/g, "_") || "mesh";
    try {
      await exportCombinedGLBWithGroupColors({
        mesh,
        groupIds: state.groupIds,
        groups: state.groups,
        filename: `${baseName}-groups.glb`,
      });
      setExportStatus("Exported combined GLB.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Failed to export GLB.");
    }
  };

  return (
    <section className="panel">
      <h2>Export</h2>
      <div className="panel-row">
        <button className="btn" type="button" onClick={exportSTL}>
          Per-group STL
        </button>
        <button className="btn" type="button" onClick={exportGLB}>
          Combined GLB
        </button>
      </div>
      <p className="hint">Per-group STL downloads one file per visible group (no zip).</p>
      {exportStatus ? <p className="hint">{exportStatus}</p> : null}
    </section>
  );
}
