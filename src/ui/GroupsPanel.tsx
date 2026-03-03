import { useMemo } from "react";
import { useEditorStore } from "../state/editorStore";

export function GroupsPanel() {
  const groups = useEditorStore((state) => state.groups);
  const groupIds = useEditorStore((state) => state.groupIds);
  const activeGroupId = useEditorStore((state) => state.activeGroupId);
  const setActiveGroupId = useEditorStore((state) => state.setActiveGroupId);
  const renameGroup = useEditorStore((state) => state.renameGroup);
  const setGroupColor = useEditorStore((state) => state.setGroupColor);
  const setGroupVisibility = useEditorStore((state) => state.setGroupVisibility);
  const createGroup = useEditorStore((state) => state.createGroup);

  const presentGroups = useMemo(() => {
    const ids = new Set<number>([0, ...Object.keys(groups).map(Number), ...groupIds]);
    return Array.from(ids).sort((a, b) => a - b);
  }, [groupIds, groups]);

  return (
    <section className="panel">
      <h2>Groups</h2>
      <button type="button" className="btn" onClick={() => createGroup()}>
        New Group
      </button>
      <div style={{ marginTop: 8 }}>
        {presentGroups.map((id) => {
          const group = groups[id] ?? {
            id,
            name: id === 0 ? "Unassigned" : `Group ${id}`,
            color: "#7f8c8d",
            visible: true,
          };
          const faceCount = groupIds.reduce((total, value) => (value === id ? total + 1 : total), 0);
          return (
            <div key={id} className={`group-item ${activeGroupId === id ? "active" : ""}`}>
              <div className="group-top">
                <button className="btn" type="button" onClick={() => setActiveGroupId(id)}>
                  Use #{id}
                </button>
                <input
                  className="color-swatch"
                  type="color"
                  value={group.color}
                  onChange={(event) => setGroupColor(id, event.target.value)}
                />
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={group.visible}
                    onChange={(event) => setGroupVisibility(id, event.target.checked)}
                  />{" "}
                  Visible
                </label>
              </div>
              <div className="panel-row" style={{ marginTop: 8, marginBottom: 0 }}>
                <input
                  className="group-name-input"
                  type="text"
                  value={group.name}
                  onChange={(event) => renameGroup(id, event.target.value)}
                />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{faceCount} faces</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

