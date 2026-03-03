import { useState } from "react";
import { getRuntimeMesh } from "../engine/runtimeMesh";
import { getRuntimeSplintMesh } from "../engine/runtimeSplint";
import { exportCombinedGLBWithGroupColors } from "../export/glbExport";
import { exportSplintAsGLB, exportSplintAsSTL } from "../export/splintExport";
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

  const exportSplintSTL = () => {
    const splint = getRuntimeSplintMesh();
    if (!splint) {
      setExportStatus("No generated splint to export.");
      return;
    }
    const baseName = modelPath.replace(/[^\w-]+/g, "_") || "mesh";
    exportSplintAsSTL(splint, `${baseName}-splint.stl`);
    setExportStatus("Exported splint STL.");
  };

  const exportSplintGLB = async () => {
    const splint = getRuntimeSplintMesh();
    if (!splint) {
      setExportStatus("No generated splint to export.");
      return;
    }
    const baseName = modelPath.replace(/[^\w-]+/g, "_") || "mesh";
    try {
      await exportSplintAsGLB(splint, `${baseName}-splint.glb`);
      setExportStatus("Exported splint GLB.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Failed to export splint GLB.");
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
      <div className="panel-row">
        <button className="btn" type="button" onClick={exportSplintSTL}>
          Splint STL
        </button>
        <button className="btn" type="button" onClick={exportSplintGLB}>
          Splint GLB
        </button>
      </div>
      <p className="hint">Per-group STL downloads one file per visible group (no zip).</p>
      {exportStatus ? <p className="hint">{exportStatus}</p> : null}
    </section>
  );
}
