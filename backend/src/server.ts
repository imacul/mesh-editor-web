import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "../dist/client");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ─── List cases ───────────────────────────────────────────────────────────────
app.get("/api/cases", (_req, res) => {
  const cases = db
    .prepare(
      `SELECT id, name, model_name, share_token, created_at, updated_at,
              length(model_data) as model_size
       FROM cases ORDER BY updated_at DESC`
    )
    .all();
  res.json(cases);
});

// ─── Get single case ──────────────────────────────────────────────────────────
app.get("/api/cases/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT id, name, session_json, model_name, model_mime, share_token,
              created_at, updated_at, length(model_data) as model_size
       FROM cases WHERE id = ?`
    )
    .get(req.params.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// ─── Create case ──────────────────────────────────────────────────────────────
app.post("/api/cases", upload.single("model"), (req, res) => {
  const { name, session } = req.body as { name?: string; session?: string };
  if (!name || !session) {
    res.status(400).json({ error: "name and session are required" });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO cases (id, name, session_json, model_data, model_name, model_mime, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    session,
    req.file?.buffer ?? null,
    req.file?.originalname ?? null,
    req.file?.mimetype ?? null,
    now,
    now
  );

  res.status(201).json({ id });
});

// ─── Update case ──────────────────────────────────────────────────────────────
app.put("/api/cases/:id", upload.single("model"), (req, res) => {
  const existing = db
    .prepare("SELECT id FROM cases WHERE id = ?")
    .get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { name, session } = req.body as { name?: string; session?: string };
  if (!name || !session) {
    res.status(400).json({ error: "name and session are required" });
    return;
  }

  const now = new Date().toISOString();

  if (req.file) {
    db.prepare(
      `UPDATE cases
       SET name = ?, session_json = ?, model_data = ?, model_name = ?, model_mime = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      session,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      now,
      req.params.id
    );
  } else {
    db.prepare(
      `UPDATE cases SET name = ?, session_json = ?, updated_at = ? WHERE id = ?`
    ).run(name, session, now, req.params.id);
  }

  res.json({ success: true });
});

// ─── Delete case ──────────────────────────────────────────────────────────────
app.delete("/api/cases/:id", (req, res) => {
  db.prepare("DELETE FROM cases WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// ─── Generate / get share token ───────────────────────────────────────────────
app.post("/api/cases/:id/share", (req, res) => {
  const row = db
    .prepare("SELECT id, share_token FROM cases WHERE id = ?")
    .get(req.params.id) as { id: string; share_token: string | null } | undefined;
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  let token = row.share_token;
  if (!token) {
    token = uuidv4();
    db.prepare("UPDATE cases SET share_token = ? WHERE id = ?").run(
      token,
      req.params.id
    );
  }

  res.json({ token });
});

// ─── Revoke share token ───────────────────────────────────────────────────────
app.delete("/api/cases/:id/share", (req, res) => {
  db.prepare("UPDATE cases SET share_token = NULL WHERE id = ?").run(
    req.params.id
  );
  res.json({ success: true });
});

// ─── Get case by share token ──────────────────────────────────────────────────
app.get("/api/share/:token", (req, res) => {
  const row = db
    .prepare(
      `SELECT id, name, session_json, model_name, model_mime, share_token,
              created_at, updated_at, length(model_data) as model_size
       FROM cases WHERE share_token = ?`
    )
    .get(req.params.token);
  if (!row) {
    res.status(404).json({ error: "Shared case not found" });
    return;
  }
  res.json(row);
});

// ─── Download model by case id ────────────────────────────────────────────────
app.get("/api/cases/:id/model", (req, res) => {
  const row = db
    .prepare("SELECT model_data, model_name, model_mime FROM cases WHERE id = ?")
    .get(req.params.id) as
    | { model_data: Buffer | null; model_name: string | null; model_mime: string | null }
    | undefined;

  if (!row?.model_data) {
    res.status(404).json({ error: "No model stored for this case" });
    return;
  }

  res.set("Content-Type", row.model_mime ?? "application/octet-stream");
  res.set(
    "Content-Disposition",
    `attachment; filename="${row.model_name ?? "model"}"`
  );
  res.send(row.model_data);
});

// ─── Download model by share token ───────────────────────────────────────────
app.get("/api/share/:token/model", (req, res) => {
  const row = db
    .prepare(
      "SELECT model_data, model_name, model_mime FROM cases WHERE share_token = ?"
    )
    .get(req.params.token) as
    | { model_data: Buffer | null; model_name: string | null; model_mime: string | null }
    | undefined;

  if (!row?.model_data) {
    res.status(404).json({ error: "No model stored for this shared case" });
    return;
  }

  res.set("Content-Type", row.model_mime ?? "application/octet-stream");
  res.set(
    "Content-Disposition",
    `attachment; filename="${row.model_name ?? "model"}"`
  );
  res.send(row.model_data);
});

// ─── Serve built frontend (production) ───────────────────────────────────────
// In dev, Vite serves the frontend separately.
// In production (`npm run build && npm start`), the backend serves everything.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback — send index.html for any non-API route
  app.get("*", (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  const addr = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Mesh Editor running on http://${addr}:${PORT}`);
  if (fs.existsSync(CLIENT_DIST)) {
    console.log(`Serving frontend from ${CLIENT_DIST}`);
  } else {
    console.log(`Dev mode: frontend served by Vite on port 5173`);
  }
});
