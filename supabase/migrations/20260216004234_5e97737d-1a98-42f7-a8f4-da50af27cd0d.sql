
-- Days table (20-day program template)
CREATE TABLE public.days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_number int NOT NULL CHECK (day_number BETWEEN 1 AND 20),
  week_number int NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  phase text NOT NULL CHECK (phase IN ('foundations','skill_development','advanced_selling','mastery_integration')),
  title text NOT NULL,
  subtitle text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read days"
  ON public.days FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate/HR admins can manage days"
  ON public.days FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('corporate_admin','hr_admin'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('corporate_admin','hr_admin'));

-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.days(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('learn','practice','mastery_homework','manager_checkin')),
  title text NOT NULL,
  description text,
  content_html text,
  sort_order int NOT NULL DEFAULT 0,
  requires_upload boolean NOT NULL DEFAULT false,
  requires_rating boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tasks"
  ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate/HR admins can manage tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('corporate_admin','hr_admin'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('corporate_admin','hr_admin'));

-- Onboarding programs table
CREATE TABLE public.onboarding_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associate_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date date,
  actual_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','terminated')),
  current_day int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can read own program"
  ON public.onboarding_programs FOR SELECT TO authenticated
  USING (auth.uid() = associate_id);

CREATE POLICY "Managers can read assigned programs"
  ON public.onboarding_programs FOR SELECT TO authenticated
  USING (auth.uid() = manager_id);

CREATE POLICY "Admins can read all programs"
  ON public.onboarding_programs FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('corporate_admin','hr_admin','gm'));

CREATE POLICY "Managers and admins can create programs"
  ON public.onboarding_programs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

CREATE POLICY "Managers and admins can update programs"
  ON public.onboarding_programs FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

-- Task completions table
CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  associate_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','needs_review')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, task_id)
);

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Associates can read own completions"
  ON public.task_completions FOR SELECT TO authenticated
  USING (auth.uid() = associate_id);

CREATE POLICY "Associates can upsert own completions"
  ON public.task_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = associate_id);

CREATE POLICY "Associates can update own completions"
  ON public.task_completions FOR UPDATE TO authenticated
  USING (auth.uid() = associate_id);

CREATE POLICY "Managers and admins can read all completions"
  ON public.task_completions FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

CREATE POLICY "Managers can update completions for review"
  ON public.task_completions FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));
