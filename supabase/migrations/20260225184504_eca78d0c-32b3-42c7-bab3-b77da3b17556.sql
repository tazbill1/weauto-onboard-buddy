
-- Create departments table
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  typical_duration_days int,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate admins can manage departments"
  ON public.departments FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'corporate_admin')
  WITH CHECK (get_user_role(auth.uid()) = 'corporate_admin');

-- Seed departments
INSERT INTO public.departments (slug, label, description, typical_duration_days, sort_order) VALUES
  ('sales', 'Sales', 'New and used vehicle sales associates', 20, 1),
  ('service_advisor', 'Service Advisor', 'Service department customer-facing advisors', 15, 2),
  ('bdc', 'BDC', 'Business Development Center - phones, internet leads, appointments', 10, 3),
  ('finance', 'Finance (F&I)', 'Finance and insurance office', 15, 4),
  ('parts', 'Parts', 'Parts department counter and wholesale', 10, 5),
  ('detailing', 'Detailing', 'Vehicle reconditioning and detail', 7, 6),
  ('custom', 'Custom', 'Custom department - define your own program', NULL, 99);

-- Add department_id to days
ALTER TABLE public.days ADD COLUMN department_id uuid REFERENCES public.departments(id);
UPDATE public.days SET department_id = (SELECT id FROM public.departments WHERE slug = 'sales');
ALTER TABLE public.days ALTER COLUMN department_id SET NOT NULL;

-- Add department_id to onboarding_programs
ALTER TABLE public.onboarding_programs ADD COLUMN department_id uuid REFERENCES public.departments(id);
UPDATE public.onboarding_programs SET department_id = (SELECT id FROM public.departments WHERE slug = 'sales');
ALTER TABLE public.onboarding_programs ALTER COLUMN department_id SET NOT NULL;

-- Add department_id to invites
ALTER TABLE public.invites ADD COLUMN department_id uuid REFERENCES public.departments(id);
UPDATE public.invites SET department_id = (SELECT id FROM public.departments WHERE slug = 'sales');
ALTER TABLE public.invites ALTER COLUMN department_id SET NOT NULL;
