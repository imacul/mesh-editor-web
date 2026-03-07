import { MODELS_BUCKET, supabase } from "../lib/supabase";

export interface CaseSummary {
  id: string;
  name: string;
  model_name: string | null;
  model_path: string | null;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends CaseSummary {
  session_json: string;
}

// ─── List all cases ───────────────────────────────────────────────────────────
export async function listCases(): Promise<CaseSummary[]> {
  const { data, error } = await supabase
    .from("cases")
    .select("id, name, model_name, model_path, share_token, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as CaseSummary[];
}

// ─── Get single case ──────────────────────────────────────────────────────────
export async function getCase(id: string): Promise<CaseDetail> {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as CaseDetail;
}

// ─── Save (create or update) a case ──────────────────────────────────────────
export async function saveCase(
  name: string,
  sessionJson: string,
  modelFile: File | null,
  existingId?: string
): Promise<string> {
  let model_path: string | null = null;
  let model_name: string | null = null;

  // Upload model file to Supabase Storage if provided
  if (modelFile) {
    const caseId = existingId ?? crypto.randomUUID();
    const filePath = `${caseId}/${modelFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from(MODELS_BUCKET)
      .upload(filePath, modelFile, { upsert: true });

    if (uploadError) throw new Error(`Model upload failed: ${uploadError.message}`);

    model_path = filePath;
    model_name = modelFile.name;

    if (existingId) {
      // Update existing row with new model
      const { error } = await supabase
        .from("cases")
        .update({ name, session_json: sessionJson, model_path, model_name })
        .eq("id", existingId);
      if (error) throw new Error(error.message);
      return existingId;
    }

    // Insert new row with the pre-generated id
    const { error } = await supabase
      .from("cases")
      .insert({ id: caseId, name, session_json: sessionJson, model_path, model_name });
    if (error) throw new Error(error.message);
    return caseId;
  }

  if (existingId) {
    const { error } = await supabase
      .from("cases")
      .update({ name, session_json: sessionJson })
      .eq("id", existingId);
    if (error) throw new Error(error.message);
    return existingId;
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({ name, session_json: sessionJson })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

// ─── Delete a case ────────────────────────────────────────────────────────────
export async function deleteCase(id: string): Promise<void> {
  // Remove model file from storage first (ignore error if none)
  const { data: row } = await supabase
    .from("cases")
    .select("model_path")
    .eq("id", id)
    .single();

  if (row?.model_path) {
    await supabase.storage.from(MODELS_BUCKET).remove([row.model_path as string]);
  }

  const { error } = await supabase.from("cases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Generate share token ─────────────────────────────────────────────────────
export async function shareCase(id: string): Promise<string> {
  // Check if token already exists
  const { data: existing } = await supabase
    .from("cases")
    .select("share_token")
    .eq("id", id)
    .single();

  if (existing?.share_token) return existing.share_token as string;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("cases")
    .update({ share_token: token })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return token;
}

// ─── Revoke share token ───────────────────────────────────────────────────────
export async function revokeShare(id: string): Promise<void> {
  const { error } = await supabase
    .from("cases")
    .update({ share_token: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Load a case by share token ───────────────────────────────────────────────
export async function getCaseByShareToken(token: string): Promise<CaseDetail> {
  // Accept both a bare token UUID and a full share URL
  const bare = token.trim().split("?share=").pop()!.split("&")[0];

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("share_token", bare)
    .single();

  if (error) throw new Error("Shared case not found or link has expired");
  return data as CaseDetail;
}

// ─── Get a public URL for a stored model file ─────────────────────────────────
export function getModelUrl(modelPath: string): string {
  const { data } = supabase.storage.from(MODELS_BUCKET).getPublicUrl(modelPath);
  return data.publicUrl;
}
