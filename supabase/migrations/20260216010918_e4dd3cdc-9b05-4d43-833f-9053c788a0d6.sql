
-- Create uploads table
CREATE TABLE public.uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid NOT NULL REFERENCES public.onboarding_programs(id),
  task_id uuid NOT NULL REFERENCES public.tasks(id),
  uploaded_by uuid NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('video', 'image', 'document', 'worksheet')),
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid,
  review_notes text,
  reviewed_at timestamp with time zone,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Associates can read their own uploads
CREATE POLICY "Associates can read own uploads"
ON public.uploads FOR SELECT
USING (auth.uid() = uploaded_by);

-- Associates can insert their own uploads
CREATE POLICY "Associates can insert own uploads"
ON public.uploads FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Associates can update own uploads (for re-upload after rejection)
CREATE POLICY "Associates can update own uploads"
ON public.uploads FOR UPDATE
USING (auth.uid() = uploaded_by);

-- Managers can read all uploads
CREATE POLICY "Managers can read all uploads"
ON public.uploads FOR SELECT
USING (get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role]));

-- Managers can update uploads (approve/reject)
CREATE POLICY "Managers can update uploads"
ON public.uploads FOR UPDATE
USING (get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role]));

-- Create deliverables storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverables', 'deliverables', true);

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload deliverables"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deliverables');

-- Anyone can view deliverables (bucket is public)
CREATE POLICY "Public read access for deliverables"
ON storage.objects FOR SELECT
USING (bucket_id = 'deliverables');

-- Users can update their own deliverables
CREATE POLICY "Users can update own deliverables"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'deliverables');

-- Users can delete their own deliverables
CREATE POLICY "Users can delete own deliverables"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'deliverables');
