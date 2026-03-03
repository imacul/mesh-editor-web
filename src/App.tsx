import { useEffect } from "react";
import { Sidebar } from "./ui/Sidebar";
import { Viewport } from "./ui/Viewport";
import { useEditorStore } from "./state/editorStore";

function App() {
  const setBrushRadius = useEditorStore((state) => state.setBrushRadius);
  const brushRadius = useEditorStore((state) => state.brushRadius);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        setBrushRadius(Math.max(0.01, brushRadius - 0.05));
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        setBrushRadius(brushRadius + 0.05);
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

