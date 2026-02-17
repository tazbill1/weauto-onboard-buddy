
CREATE OR REPLACE FUNCTION public.notify_deliverable_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_associate_name text;
  v_task_title text;
  v_day_number integer;
  v_manager_email text;
  v_notif_id uuid;
  v_base_url text;
  v_anon_key text;
BEGIN
  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, email) INTO v_associate_name FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  SELECT t.title, d.day_number INTO v_task_title, v_day_number
  FROM tasks t JOIN days d ON d.id = t.day_id
  WHERE t.id = NEW.task_id;

  INSERT INTO notifications (user_id, type, title, body, related_program_id, related_task_id, related_day)
  VALUES (
    v_program.manager_id,
    'deliverable_submitted',
    'New Deliverable to Review',
    v_associate_name || ' submitted ' || COALESCE(v_task_title, 'a task') || ' for Day ' || COALESCE(v_day_number::text, '?') || '. Tap to review.',
    NEW.program_id,
    NEW.task_id,
    v_day_number
  )
  RETURNING id INTO v_notif_id;

  -- Queue email only if settings are configured
  v_base_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.anon_key', true);
  
  IF v_base_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    SELECT email INTO v_manager_email FROM profiles WHERE user_id = v_program.manager_id LIMIT 1;
    IF v_manager_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_base_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'to', v_manager_email,
          'subject', 'New Deliverable to Review',
          'body', v_associate_name || ' submitted ' || COALESCE(v_task_title, 'a task') || ' for Day ' || COALESCE(v_day_number::text, '?') || '. Tap to review.',
          'notificationId', v_notif_id::text
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also fix the other triggers that have the same issue

CREATE OR REPLACE FUNCTION public.notify_needs_work()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_task_title text;
  v_associate_name text;
  v_associate_email text;
  v_needs_work_count integer;
  v_gm_id uuid;
  v_gm_email text;
  v_notif_id uuid;
  v_body text;
  v_base_url text;
  v_anon_key text;
BEGIN
  IF NEW.rating <> 'needs_work' THEN RETURN NEW; END IF;

  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT title INTO v_task_title FROM tasks WHERE id = NEW.task_id;
  SELECT COALESCE(full_name, email), email INTO v_associate_name, v_associate_email FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  v_body := 'You received a ''Needs Work'' rating on ' || COALESCE(v_task_title, 'a task') || '. Tap to see your manager''s feedback.';

  INSERT INTO notifications (user_id, type, title, body, related_program_id, related_task_id)
  VALUES (v_program.associate_id, 'needs_work', 'Performance Feedback: Needs Work', v_body, NEW.program_id, NEW.task_id)
  RETURNING id INTO v_notif_id;

  v_base_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.anon_key', true);

  IF v_base_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    IF v_associate_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_base_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'to', v_associate_email,
          'subject', 'Performance Feedback: Needs Work',
          'body', v_body,
          'notificationId', v_notif_id::text
        )
      );
    END IF;

    SELECT COUNT(*) INTO v_needs_work_count
    FROM performance_ratings WHERE program_id = NEW.program_id AND rating = 'needs_work';

    IF v_needs_work_count >= 3 THEN
      SELECT p.user_id, p.email INTO v_gm_id, v_gm_email
      FROM profiles p WHERE p.store_id = v_program.store_id AND p.role = 'gm' LIMIT 1;

      IF v_gm_id IS NOT NULL THEN
        v_body := v_associate_name || ' has received ' || v_needs_work_count || ' ''Needs Work'' ratings. Review may be needed.';
        INSERT INTO notifications (user_id, type, title, body, related_program_id)
        VALUES (v_gm_id, 'needs_work', 'Associate Needs Attention', v_body, NEW.program_id)
        RETURNING id INTO v_notif_id;

        IF v_gm_email IS NOT NULL THEN
          PERFORM net.http_post(
            url := v_base_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_anon_key
            ),
            body := jsonb_build_object(
              'to', v_gm_email,
              'subject', 'Associate Needs Attention',
              'body', v_body,
              'notificationId', v_notif_id::text
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_checkin_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_week_milestone()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_program onboarding_programs%ROWTYPE;
  v_associate_name text;
  v_week_number integer;
  v_week_days integer[];
  v_signed_count integer;
  v_expected_count integer;
  v_gm_id uuid;
  v_milestone_body text;
  v_milestone_title text;
  v_notif_id uuid;
  v_email text;
  v_base_url text;
  v_anon_key text;
BEGIN
  SELECT * INTO v_program FROM onboarding_programs WHERE id = NEW.program_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

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

  SELECT COUNT(DISTINCT day_number) INTO v_signed_count
  FROM daily_signoffs WHERE program_id = NEW.program_id AND day_number = ANY(v_week_days);

  IF v_signed_count < v_expected_count THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE related_program_id = NEW.program_id AND type = 'milestone'
      AND title = 'Week ' || v_week_number || ' Complete!'
  ) THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, email) INTO v_associate_name FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;

  v_milestone_title := 'Week ' || v_week_number || ' Complete!';
  IF v_week_number = 4 THEN
    v_milestone_body := v_associate_name || ' has completed the entire WEAuto Onboarding Program! Congratulations!';
  ELSE
    v_milestone_body := v_associate_name || ' has completed Week ' || v_week_number || ' of the WEAuto Onboarding Program. Great progress!';
  END IF;

  v_base_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.anon_key', true);

  -- Notify associate
  INSERT INTO notifications (user_id, type, title, body, related_program_id)
  VALUES (v_program.associate_id, 'milestone', v_milestone_title, v_milestone_body, NEW.program_id)
  RETURNING id INTO v_notif_id;

  IF v_base_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    SELECT email INTO v_email FROM profiles WHERE user_id = v_program.associate_id LIMIT 1;
    IF v_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_base_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
        body := jsonb_build_object('to', v_email, 'subject', v_milestone_title, 'body', v_milestone_body, 'notificationId', v_notif_id::text)
      );
    END IF;
  END IF;

  -- Notify manager
  INSERT INTO notifications (user_id, type, title, body, related_program_id)
  VALUES (v_program.manager_id, 'milestone', v_milestone_title, v_milestone_body, NEW.program_id)
  RETURNING id INTO v_notif_id;

  IF v_base_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    SELECT email INTO v_email FROM profiles WHERE user_id = v_program.manager_id LIMIT 1;
    IF v_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_base_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
        body := jsonb_build_object('to', v_email, 'subject', v_milestone_title, 'body', v_milestone_body, 'notificationId', v_notif_id::text)
      );
    END IF;
  END IF;

  -- Notify GM
  SELECT p.user_id, p.email INTO v_gm_id, v_email FROM profiles p WHERE p.store_id = v_program.store_id AND p.role = 'gm' LIMIT 1;
  IF v_gm_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, related_program_id)
    VALUES (v_gm_id, 'milestone', v_milestone_title, v_milestone_body, NEW.program_id)
    RETURNING id INTO v_notif_id;

    IF v_base_url IS NOT NULL AND v_anon_key IS NOT NULL AND v_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_base_url || '/functions/v1/send-notification-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
        body := jsonb_build_object('to', v_email, 'subject', v_milestone_title, 'body', v_milestone_body, 'notificationId', v_notif_id::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
