
-- 1. Make deliverables bucket private
UPDATE storage.buckets SET public = false WHERE id = 'deliverables';

-- 2. Drop overly permissive public read policy on storage
DROP POLICY IF EXISTS "Public read access for deliverables" ON storage.objects;

-- 3. Create authenticated read policy for storage
CREATE POLICY "Authenticated users can read deliverables"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'deliverables');

-- 4. Drop overly permissive public invite read policy
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;

-- 5. Fix the invites UPDATE policy to be properly scoped
DROP POLICY IF EXISTS "Managers and admins can update invites" ON public.invites;

CREATE POLICY "Managers and admins can update invites"
ON public.invites FOR UPDATE
USING (
  get_user_role(auth.uid()) IN ('sales_manager', 'gm', 'hr_admin', 'corporate_admin')
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
