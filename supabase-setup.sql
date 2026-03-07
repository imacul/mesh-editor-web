-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- NOTE: Also create a "models" bucket in Storage (Public bucket ON) before running.

CREATE TABLE IF NOT EXISTS cases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  session_json text NOT NULL,
  model_path  text,
  model_name  text,
  share_token uuid UNIQUE DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS with open policy (add auth later if needed)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON cases FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage RLS policies for the "models" bucket
-- Allow anyone to upload, read, update, and delete model files
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "models_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'models');

CREATE POLICY "models_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'models');

CREATE POLICY "models_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'models');

CREATE POLICY "models_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'models');
