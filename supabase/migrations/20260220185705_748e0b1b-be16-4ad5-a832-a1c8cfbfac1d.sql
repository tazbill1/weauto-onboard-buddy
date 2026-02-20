-- Add UPDATE policy for managers on daily_signoffs (needed for upsert)
CREATE POLICY "Managers can update signoffs"
ON public.daily_signoffs
FOR UPDATE
TO authenticated
USING (
  get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role])
)
WITH CHECK (
  get_user_role(auth.uid()) = ANY (ARRAY['sales_manager'::app_role, 'gm'::app_role, 'hr_admin'::app_role, 'corporate_admin'::app_role])
);