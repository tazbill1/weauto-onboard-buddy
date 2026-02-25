
-- Allow app_admin to insert stores
CREATE POLICY "App admins can insert stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role(auth.uid()) = 'app_admin'
);

-- Allow app_admin to update stores
CREATE POLICY "App admins can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (
  get_user_role(auth.uid()) = 'app_admin'
)
WITH CHECK (
  get_user_role(auth.uid()) = 'app_admin'
);
