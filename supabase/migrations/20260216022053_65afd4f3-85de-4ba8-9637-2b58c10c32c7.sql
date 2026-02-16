
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('behind_schedule', 'deliverable_submitted', 'checkin_complete', 'needs_work', 'milestone')),
  title text NOT NULL,
  body text NOT NULL,
  related_program_id uuid REFERENCES public.onboarding_programs(id) ON DELETE SET NULL,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_day integer,
  is_read boolean NOT NULL DEFAULT false,
  is_emailed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- System/triggers can insert notifications (service role or via triggers)
CREATE POLICY "Service can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ═══ TRIGGER FUNCTIONS ═══

-- 1. DELIVERABLE SUBMITTED: when upload inserted, notify the manager
CREATE OR REPLACE FUNCTION public.notify_deliverable_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_associate_name text;
  v_task_title text;
  v_day_number integer;
BEGIN
  -- Get program info
  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Get associate name
  SELECT COALESCE(full_name, email) INTO v_associate_name FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  -- Get task title and day number
  SELECT t.title, d.day_number INTO v_task_title, v_day_number
  FROM tasks t JOIN days d ON d.id = t.day_id
  WHERE t.id = NEW.task_id;

  -- Notify the manager
  INSERT INTO notifications (user_id, type, title, body, related_program_id, related_task_id, related_day)
  VALUES (
    v_program.manager_id,
    'deliverable_submitted',
    'New Deliverable to Review',
    v_associate_name || ' submitted ' || COALESCE(v_task_title, 'a task') || ' for Day ' || COALESCE(v_day_number::text, '?') || '. Tap to review.',
    NEW.program_id,
    NEW.task_id,
    v_day_number
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_deliverable_submitted
AFTER INSERT ON public.uploads
FOR EACH ROW
EXECUTE FUNCTION public.notify_deliverable_submitted();

-- 2. CHECKIN COMPLETE: when daily_signoffs inserted, notify the associate
CREATE OR REPLACE FUNCTION public.notify_checkin_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program onboarding_programs%ROWTYPE;
BEGIN
  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, title, body, related_program_id, related_day)
  VALUES (
    v_program.associate_id,
    'checkin_complete',
    'Day ' || NEW.day_number || ' Check-In Complete',
    'Your manager has reviewed Day ' || NEW.day_number || '. Tap to see your ratings and feedback.',
    NEW.program_id,
    NEW.day_number
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_checkin_complete
AFTER INSERT ON public.daily_signoffs
FOR EACH ROW
EXECUTE FUNCTION public.notify_checkin_complete();

-- 3. NEEDS WORK: when performance_ratings inserted with rating = 'needs_work'
CREATE OR REPLACE FUNCTION public.notify_needs_work()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_task_title text;
  v_associate_name text;
  v_needs_work_count integer;
  v_gm_id uuid;
BEGIN
  IF NEW.rating <> 'needs_work' THEN RETURN NEW; END IF;

  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT title INTO v_task_title FROM tasks WHERE id = NEW.task_id;
  SELECT COALESCE(full_name, email) INTO v_associate_name FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  -- Notify the associate
  INSERT INTO notifications (user_id, type, title, body, related_program_id, related_task_id)
  VALUES (
    v_program.associate_id,
    'needs_work',
    'Performance Feedback: Needs Work',
    'You received a ''Needs Work'' rating on ' || COALESCE(v_task_title, 'a task') || '. Tap to see your manager''s feedback.',
    NEW.program_id,
    NEW.task_id
  );

  -- Check if 3+ needs_work ratings across program
  SELECT COUNT(*) INTO v_needs_work_count
  FROM performance_ratings
  WHERE program_id = NEW.program_id AND rating = 'needs_work';

  IF v_needs_work_count >= 3 THEN
    -- Find a GM for the store
    SELECT p.user_id INTO v_gm_id
    FROM profiles p
    WHERE p.store_id = v_program.store_id AND p.role = 'gm'
    LIMIT 1;

    IF v_gm_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, related_program_id)
      VALUES (
        v_gm_id,
        'needs_work',
        'Associate Needs Attention',
        v_associate_name || ' has received ' || v_needs_work_count || ' ''Needs Work'' ratings. Review may be needed.',
        NEW.program_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_needs_work
AFTER INSERT ON public.performance_ratings
FOR EACH ROW
EXECUTE FUNCTION public.notify_needs_work();

-- 4. WEEK MILESTONE: when daily_signoffs inserted, check if entire week is complete
CREATE OR REPLACE FUNCTION public.notify_week_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_associate_name text;
  v_week_number integer;
  v_week_days integer[];
  v_signed_count integer;
  v_expected_count integer;
  v_gm_id uuid;
  v_milestone_body text;
  v_recipient uuid;
BEGIN
  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Determine which week this day belongs to and get all days in that week
  IF NEW.day_number BETWEEN 1 AND 6 THEN
    v_week_number := 1; v_week_days := ARRAY[1,2,3,4,5,6]; v_expected_count := 6;
  ELSIF NEW.day_number BETWEEN 7 AND 10 THEN
    v_week_number := 2; v_week_days := ARRAY[7,8,9,10]; v_expected_count := 4;
  ELSIF NEW.day_number BETWEEN 11 AND 15 THEN
    v_week_number := 3; v_week_days := ARRAY[11,12,13,14,15]; v_expected_count := 5;
  ELSIF NEW.day_number BETWEEN 16 AND 20 THEN
    v_week_number := 4; v_week_days := ARRAY[16,17,18,19,20]; v_expected_count := 5;
  ELSE
    RETURN NEW;
  END IF;

  -- Count signed off days in this week for this program
  SELECT COUNT(DISTINCT day_number) INTO v_signed_count
  FROM daily_signoffs
  WHERE program_id = NEW.program_id AND day_number = ANY(v_week_days);

  IF v_signed_count < v_expected_count THEN RETURN NEW; END IF;

  -- Check if we already sent this milestone
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE related_program_id = NEW.program_id
      AND type = 'milestone'
      AND title = 'Week ' || v_week_number || ' Complete!'
  ) THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, email) INTO v_associate_name FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  IF v_week_number = 4 THEN
    v_milestone_body := v_associate_name || ' has completed the entire WEAuto Onboarding Program! Congratulations!';
  ELSE
    v_milestone_body := v_associate_name || ' has completed Week ' || v_week_number || ' of the WEAuto Onboarding Program. Great progress!';
  END IF;

  -- Notify associate
  INSERT INTO notifications (user_id, type, title, body, related_program_id)
  VALUES (v_program.associate_id, 'milestone', 'Week ' || v_week_number || ' Complete!', v_milestone_body, NEW.program_id);

  -- Notify manager
  INSERT INTO notifications (user_id, type, title, body, related_program_id)
  VALUES (v_program.manager_id, 'milestone', 'Week ' || v_week_number || ' Complete!', v_milestone_body, NEW.program_id);

  -- Notify GM
  SELECT p.user_id INTO v_gm_id FROM profiles p WHERE p.store_id = v_program.store_id AND p.role = 'gm' LIMIT 1;
  IF v_gm_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, related_program_id)
    VALUES (v_gm_id, 'milestone', 'Week ' || v_week_number || ' Complete!', v_milestone_body, NEW.program_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_week_milestone
AFTER INSERT ON public.daily_signoffs
FOR EACH ROW
EXECUTE FUNCTION public.notify_week_milestone();
