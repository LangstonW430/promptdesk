-- ============================================================
-- Migration: RLS + auth.users sync trigger
-- ============================================================

-- ── Part A: public.users sync trigger ───────────────────────
-- Fires after every INSERT on auth.users (Supabase Auth).
-- Creates the matching public.users row so Prisma queries work.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Part B: Enable Row Level Security ───────────────────────

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_prompts ENABLE ROW LEVEL SECURITY;


-- ── Part C: Policies ────────────────────────────────────────

-- users: each user can only see and modify their own row
CREATE POLICY "users: own row only"
  ON users
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- clients
CREATE POLICY "clients: owner access"
  ON clients
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- notes
CREATE POLICY "notes: owner access"
  ON notes
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- activities
CREATE POLICY "activities: owner access"
  ON activities
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- tasks
CREATE POLICY "tasks: owner access"
  ON tasks
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- tags
CREATE POLICY "tags: owner access"
  ON tags
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- client_tags: no direct owner_id — check through the parent client
CREATE POLICY "client_tags: owner access via client"
  ON client_tags
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_tags.client_id
        AND clients.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_tags.client_id
        AND clients.owner_id = auth.uid()
    )
  );

-- attachments
CREATE POLICY "attachments: owner access"
  ON attachments
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- prompt_templates: built-in templates (owner_id IS NULL) are readable by all;
-- custom templates are readable/writable only by the owner
CREATE POLICY "prompt_templates: read built-in or own"
  ON prompt_templates
  FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "prompt_templates: write own only"
  ON prompt_templates
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "prompt_templates: update own only"
  ON prompt_templates
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "prompt_templates: delete own only"
  ON prompt_templates
  FOR DELETE
  USING (owner_id = auth.uid());

-- generated_prompts
CREATE POLICY "generated_prompts: owner access"
  ON generated_prompts
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
