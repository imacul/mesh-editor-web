import { useEffect } from "react";
import { getCaseByShareToken, getModelUrl } from "./api/client";
import { editorStoreApi, useEditorStore } from "./state/editorStore";
import type { EditorSession } from "./state/types";
import { Sidebar } from "./ui/Sidebar";
import { Viewport } from "./ui/Viewport";

function App() {
  const setBrushRadius = useEditorStore((state) => state.setBrushRadius);
  const brushRadius = useEditorStore((state) => state.brushRadius);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  // Load a shared case if ?share=TOKEN is present in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("share");
    if (!token) return;

    getCaseByShareToken(token)
      .then((detail) => {
        const session = JSON.parse(detail.session_json) as EditorSession;
        if (detail.model_path) {
          session.modelPath = getModelUrl(detail.model_path);
        }
        editorStoreApi.getState().loadSession(session);
        // Clean the token from the URL without triggering a reload
        const url = new URL(window.location.href);
        url.searchParams.delete("share");
        window.history.replaceState(null, "", url.toString());
      })
      .catch((err: unknown) => {
        console.error("Failed to load shared case:", err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        const delta = Math.max(0.0001, brushRadius * 0.12);
        setBrushRadius(Math.max(0.0001, brushRadius - delta));
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        const delta = Math.max(0.0001, brushRadius * 0.12);
        setBrushRadius(brushRadius + delta);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [brushRadius, redo, setBrushRadius, undo]);

  return (
    <div className="app-shell">
      <Sidebar />
      <Viewport />
    </div>
  );
}

export default App;
