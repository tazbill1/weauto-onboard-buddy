
-- Allow anon users to read stores (needed for registration page)
CREATE POLICY "Anyone can read active stores"
  ON public.stores FOR SELECT
  TO anon
  USING (is_active = true);
