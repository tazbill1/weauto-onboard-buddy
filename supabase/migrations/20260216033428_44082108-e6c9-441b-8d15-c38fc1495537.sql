
-- Create invites table
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  invited_by uuid NOT NULL,
  assigned_manager_id uuid,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  auto_start_onboarding boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint
ALTER TABLE public.invites ADD CONSTRAINT invites_email_store_status_unique UNIQUE (email, store_id, status);

-- Indexes
CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_email ON public.invites(email);
CREATE INDEX idx_invites_store_id ON public.invites(store_id);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Managers can insert invites
CREATE POLICY "Managers and admins can insert invites"
  ON public.invites FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) IN ('sales_manager', 'gm', 'hr_admin', 'corporate_admin')
  );

-- Managers can read invites scoped to their store
CREATE POLICY "Managers can read invites for their store"
  ON public.invites FOR SELECT
  USING (
    store_id = (SELECT store_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    AND get_user_role(auth.uid()) IN ('sales_manager', 'gm', 'hr_admin')
  );

-- Corporate admins can read all invites
CREATE POLICY "Corporate admins can read all invites"
  ON public.invites FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'corporate_admin'
  );

-- Public read by token (for registration page)
CREATE POLICY "Anyone can read invite by token"
  ON public.invites FOR SELECT
  USING (true);

-- Managers and admins can update invites (revoke, accept)
CREATE POLICY "Managers and admins can update invites"
  ON public.invites FOR UPDATE
  USING (
    get_user_role(auth.uid()) IN ('sales_manager', 'gm', 'hr_admin', 'corporate_admin')
    OR true
  );
