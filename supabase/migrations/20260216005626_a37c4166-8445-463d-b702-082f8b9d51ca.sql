
-- Performance ratings table
CREATE TABLE public.performance_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('meets_expectation','needs_work','not_attempted')),
  notes text,
  rated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, task_id)
);

ALTER TABLE public.performance_ratings ENABLE ROW LEVEL SECURITY;

-- Managers/admins can create and update ratings
CREATE POLICY "Managers can insert ratings"
  ON public.performance_ratings FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

CREATE POLICY "Managers can update ratings"
  ON public.performance_ratings FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

-- Managers can read all ratings
CREATE POLICY "Managers can read ratings"
  ON public.performance_ratings FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

-- Associates can read ratings for their own programs
CREATE POLICY "Associates can read own ratings"
  ON public.performance_ratings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_programs op
      WHERE op.id = program_id AND op.associate_id = auth.uid()
    )
  );

-- Daily sign-offs table
CREATE TABLE public.daily_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  day_number int NOT NULL,
  manager_id uuid NOT NULL,
  overall_notes text,
  signed_off_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, day_number)
);

ALTER TABLE public.daily_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can insert signoffs"
  ON public.daily_signoffs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

CREATE POLICY "Managers can read signoffs"
  ON public.daily_signoffs FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('sales_manager','gm','hr_admin','corporate_admin'));

CREATE POLICY "Associates can read own signoffs"
  ON public.daily_signoffs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_programs op
      WHERE op.id = program_id AND op.associate_id = auth.uid()
    )
  );
