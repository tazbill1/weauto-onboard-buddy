
-- Program Templates table
CREATE TABLE public.program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  description text,
  total_days int,
  created_by uuid NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  forked_from uuid REFERENCES public.program_templates(id),
  store_id uuid REFERENCES public.stores(id),
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for status instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_template_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'published', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be draft, published, or archived.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_template_status
BEFORE INSERT OR UPDATE ON public.program_templates
FOR EACH ROW EXECUTE FUNCTION public.validate_template_status();

ALTER TABLE public.program_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read accessible templates"
ON public.program_templates FOR SELECT TO authenticated
USING (
  status = 'published'
  OR created_by = auth.uid()
  OR get_user_role(auth.uid()) = 'corporate_admin'
  OR (
    store_id IS NOT NULL
    AND get_user_role(auth.uid()) IN ('gm', 'hr_admin')
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
  )
);

CREATE POLICY "Corporate admins can manage all templates"
ON public.program_templates FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'corporate_admin')
WITH CHECK (get_user_role(auth.uid()) = 'corporate_admin');

CREATE POLICY "GMs and HR can manage store templates"
ON public.program_templates FOR ALL TO authenticated
USING (
  get_user_role(auth.uid()) IN ('gm', 'hr_admin')
  AND store_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('gm', 'hr_admin')
  AND store_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
);

-- Template Days table
CREATE TABLE public.template_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.program_templates(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  title text NOT NULL,
  subtitle text,
  phase text,
  is_locked boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, day_number)
);

-- Validation trigger for day_number
CREATE OR REPLACE FUNCTION public.validate_template_day_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.day_number < 1 THEN
    RAISE EXCEPTION 'day_number must be >= 1';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_template_day_number
BEFORE INSERT OR UPDATE ON public.template_days
FOR EACH ROW EXECUTE FUNCTION public.validate_template_day_number();

ALTER TABLE public.template_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template days follow template access"
ON public.template_days FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM program_templates pt
  WHERE pt.id = template_days.template_id
  AND (pt.status = 'published' OR pt.created_by = auth.uid() OR get_user_role(auth.uid()) = 'corporate_admin')
));

CREATE POLICY "Corporate admins can manage template days"
ON public.template_days FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'corporate_admin')
WITH CHECK (get_user_role(auth.uid()) = 'corporate_admin');

CREATE POLICY "GMs and HR can manage their store template days"
ON public.template_days FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM program_templates pt
  JOIN profiles p ON p.user_id = auth.uid()
  WHERE pt.id = template_days.template_id
  AND pt.store_id = p.store_id
  AND get_user_role(auth.uid()) IN ('gm', 'hr_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM program_templates pt
  JOIN profiles p ON p.user_id = auth.uid()
  WHERE pt.id = template_days.template_id
  AND pt.store_id = p.store_id
  AND get_user_role(auth.uid()) IN ('gm', 'hr_admin')
));

-- Template Tasks table
CREATE TABLE public.template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id uuid NOT NULL REFERENCES public.template_days(id) ON DELETE CASCADE,
  section text NOT NULL,
  title text NOT NULL,
  description text,
  content_html text,
  requires_upload boolean NOT NULL DEFAULT false,
  requires_rating boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for section
CREATE OR REPLACE FUNCTION public.validate_template_task_section()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.section NOT IN ('learn', 'practice', 'mastery_homework', 'manager_checkin') THEN
    RAISE EXCEPTION 'Invalid section: %. Must be learn, practice, mastery_homework, or manager_checkin.', NEW.section;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_template_task_section
BEFORE INSERT OR UPDATE ON public.template_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_template_task_section();

ALTER TABLE public.template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template tasks follow template day access"
ON public.template_tasks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM template_days td
  JOIN program_templates pt ON pt.id = td.template_id
  WHERE td.id = template_tasks.template_day_id
  AND (pt.status = 'published' OR pt.created_by = auth.uid() OR get_user_role(auth.uid()) = 'corporate_admin')
));

CREATE POLICY "Corporate admins can manage template tasks"
ON public.template_tasks FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'corporate_admin')
WITH CHECK (get_user_role(auth.uid()) = 'corporate_admin');

CREATE POLICY "GMs and HR can manage their store template tasks"
ON public.template_tasks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM template_days td
  JOIN program_templates pt ON pt.id = td.template_id
  JOIN profiles p ON p.user_id = auth.uid()
  WHERE td.id = template_tasks.template_day_id
  AND pt.store_id = p.store_id
  AND get_user_role(auth.uid()) IN ('gm', 'hr_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM template_days td
  JOIN program_templates pt ON pt.id = td.template_id
  JOIN profiles p ON p.user_id = auth.uid()
  WHERE td.id = template_tasks.template_day_id
  AND pt.store_id = p.store_id
  AND get_user_role(auth.uid()) IN ('gm', 'hr_admin')
));

-- Add template_id to onboarding_programs
ALTER TABLE public.onboarding_programs ADD COLUMN template_id uuid REFERENCES public.program_templates(id);

-- Auto-update updated_at on program_templates
CREATE OR REPLACE FUNCTION public.update_template_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_program_templates_updated_at
BEFORE UPDATE ON public.program_templates
FOR EACH ROW EXECUTE FUNCTION public.update_template_updated_at();
