
-- Builder sessions table
CREATE TABLE public.builder_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  template_id uuid REFERENCES public.program_templates(id),
  program_name text,
  status text NOT NULL DEFAULT 'active',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  draft_program jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_builder_session_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'generating', 'reviewing', 'completed', 'abandoned') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be active, generating, reviewing, completed, or abandoned.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_builder_session_status_trigger
BEFORE INSERT OR UPDATE ON public.builder_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_builder_session_status();

-- Auto-update updated_at
CREATE TRIGGER update_builder_sessions_updated_at
BEFORE UPDATE ON public.builder_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_template_updated_at();

ALTER TABLE public.builder_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own builder sessions"
ON public.builder_sessions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Corporate admins can read all sessions"
ON public.builder_sessions FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = 'corporate_admin');

-- Builder uploads table
CREATE TABLE public.builder_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.builder_sessions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_path text NOT NULL,
  file_size int,
  extracted_text text,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.builder_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own builder uploads"
ON public.builder_uploads FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM builder_sessions bs WHERE bs.id = builder_uploads.session_id AND bs.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM builder_sessions bs WHERE bs.id = builder_uploads.session_id AND bs.user_id = auth.uid()
));

-- Storage bucket for builder uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('builder-uploads', 'builder-uploads', false, 10485760);

-- Storage policies
CREATE POLICY "Authenticated users can upload builder files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'builder-uploads');

CREATE POLICY "Users can read own builder uploads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'builder-uploads');

CREATE POLICY "Users can delete own builder uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'builder-uploads');
