import { useCallback, useEffect, useState } from "react";
import {
  deleteCase,
  getCaseByShareToken,
  getCase,
  getModelUrl,
  listCases,
  revokeShare,
  shareCase,
  type CaseSummary,
} from "../api/client";
import { editorStoreApi } from "../state/editorStore";
import type { EditorSession } from "../state/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CaseRowProps {
  item: CaseSummary;
  onLoad: (item: CaseSummary) => void;
  onDelete: (id: string) => void;
  onShare: (item: CaseSummary) => void;
}

function CaseRow({ item, onLoad, onDelete, onShare }: CaseRowProps) {
  return (
    <div className="group-item" style={{ marginBottom: 6 }}>
      <div className="group-top">
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </span>
        <button
          className="btn"
          style={{ fontSize: 11, padding: "3px 7px" }}
          onClick={() => onLoad(item)}
          type="button"
          title="Load this case"
        >
          Load
        </button>
        <button
          className="btn"
          style={{ fontSize: 11, padding: "3px 7px" }}
          onClick={() => onShare(item)}
          type="button"
          title={item.share_token ? "Copy share link" : "Generate share link"}
        >
          {item.share_token ? "Copy Link" : "Share"}
        </button>
        <button
          className="btn"
          style={{ fontSize: 11, padding: "3px 7px", borderColor: "#7f1d1d", color: "#fca5a5" }}
          onClick={() => onDelete(item.id)}
          type="button"
          title="Delete case"
        >
          Del
        </button>
      </div>
      <p className="hint" style={{ marginTop: 4 }}>
        {formatDate(item.updated_at)}
        {item.model_name ? ` · ${item.model_name}` : ""}
        {item.share_token ? " · shared" : ""}
      </p>
    </div>
  );
}

export function CaseHistoryPanel() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCases(await listCases());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flashMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleLoad = async (item: CaseSummary) => {
    setError(null);
    try {
      const detail = await getCase(item.id);
      const session = JSON.parse(detail.session_json) as EditorSession;

      if (detail.model_path) {
        session.modelPath = getModelUrl(detail.model_path);
      }

      editorStoreApi.getState().loadSession(session);
      flashMsg(`Loaded "${item.name}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this case? This cannot be undone.")) return;
    try {
      await deleteCase(id);
      setCases((prev) => prev.filter((c) => c.id !== id));
      flashMsg("Case deleted");
    } catch {
      setError("Failed to delete case");
    }
  };

  const handleShare = async (item: CaseSummary) => {
    try {
      let token = item.share_token;
      if (!token) {
        token = await shareCase(item.id);
        setCases((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, share_token: token } : c))
        );
      }
      const url = `${window.location.origin}${window.location.pathname}?share=${token}`;
      await navigator.clipboard.writeText(url);
      flashMsg("Share link copied to clipboard!");
    } catch {
      setError("Failed to generate share link");
    }
  };

  const handleLoadByToken = async () => {
    const input = shareInput.trim();
    if (!input) return;
    setError(null);
    setShareLoading(true);
    try {
      const detail = await getCaseByShareToken(input);
      const session = JSON.parse(detail.session_json) as EditorSession;

      if (detail.model_path) {
        session.modelPath = getModelUrl(detail.model_path);
      }

      editorStoreApi.getState().loadSession(session);
      flashMsg(`Loaded shared case "${detail.name}"`);
      setShareInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shared case");
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (id: string) => {
    try {
      await revokeShare(id);
      setCases((prev) =>
        prev.map((c) => (c.id === id ? { ...c, share_token: null } : c))
      );
      flashMsg("Share link revoked");
    } catch {
      setError("Failed to revoke share link");
    }
  };

  return (
    <section className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Case History</h2>
        <button
          className="btn"
          style={{ fontSize: 11, padding: "3px 7px" }}
          onClick={() => void refresh()}
          type="button"
          disabled={loading}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {/* Load by share link / token */}
      <div className="panel-row" style={{ marginBottom: 6 }}>
        <input
          type="text"
          placeholder="Paste share link or token…"
          value={shareInput}
          onChange={(e) => setShareInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleLoadByToken(); }}
          style={{ flex: 1 }}
        />
        <button
          className="btn"
          style={{ fontSize: 11, padding: "3px 7px", whiteSpace: "nowrap" }}
          onClick={() => void handleLoadByToken()}
          disabled={shareLoading || !shareInput.trim()}
          type="button"
        >
          {shareLoading ? "…" : "Open"}
        </button>
      </div>

      {actionMsg && (
        <p className="hint" style={{ color: "#86efac", marginBottom: 6 }}>{actionMsg}</p>
      )}
      {error && (
        <p className="hint" style={{ color: "#fda4af", marginBottom: 6 }}>{error}</p>
      )}

      {!loading && cases.length === 0 && !error && (
        <p className="hint">No saved cases yet. Save one from the Session panel.</p>
      )}

      {cases.map((item) => (
        <div key={item.id}>
          <CaseRow
            item={item}
            onLoad={(c) => void handleLoad(c)}
            onDelete={(id) => void handleDelete(id)}
            onShare={(c) => void handleShare(c)}
          />
          {item.share_token && (
            <div style={{ marginTop: -4, marginBottom: 6, paddingLeft: 2 }}>
              <button
                className="btn"
                style={{ fontSize: 10, padding: "2px 6px", borderColor: "#7f1d1d", color: "#fca5a5" }}
                onClick={() => void handleRevokeShare(item.id)}
                type="button"
              >
                Revoke share link
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
