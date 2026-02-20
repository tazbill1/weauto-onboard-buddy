-- Fix: Change the INSERT policy on daily_signoffs from RESTRICTIVE to PERMISSIVE
DROP POLICY "Managers can insert signoffs" ON public.daily_signoffs;

CREATE POLICY "Managers can insert signoffs"
ON public.daily_signoffs
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role])
);

-- Also fix the SELECT policies to be permissive
DROP POLICY "Managers can read signoffs" ON public.daily_signoffs;
DROP POLICY "Associates can read own signoffs" ON public.daily_signoffs;

CREATE POLICY "Managers can read signoffs"
ON public.daily_signoffs
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role])
);

CREATE POLICY "Associates can read own signoffs"
ON public.daily_signoffs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_programs op
    WHERE op.id = daily_signoffs.program_id AND op.associate_id = auth.uid()
  )
);