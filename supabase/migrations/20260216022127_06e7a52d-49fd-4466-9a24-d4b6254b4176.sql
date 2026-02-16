
-- Replace the overly permissive insert policy with one that only allows
-- authenticated users to insert notifications for themselves (for edge function use)
-- Triggers use SECURITY DEFINER so they bypass RLS entirely
DROP POLICY "Service can insert notifications" ON public.notifications;

CREATE POLICY "Triggers and edge functions can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);
