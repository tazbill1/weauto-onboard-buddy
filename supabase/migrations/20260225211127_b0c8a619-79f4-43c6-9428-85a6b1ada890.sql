
-- ═══════════════════════════════════════════════
-- Step 1: Drop ALL policies that reference get_user_role
-- ═══════════════════════════════════════════════

DROP POLICY IF EXISTS "Corporate admins can read all sessions" ON public.builder_sessions;
DROP POLICY IF EXISTS "Managers can insert signoffs" ON public.daily_signoffs;
DROP POLICY IF EXISTS "Managers can read signoffs" ON public.daily_signoffs;
DROP POLICY IF EXISTS "Managers can update signoffs" ON public.daily_signoffs;
DROP POLICY IF EXISTS "Corporate/HR admins can manage days" ON public.days;
DROP POLICY IF EXISTS "Corporate admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Corporate admins can read all invites" ON public.invites;
DROP POLICY IF EXISTS "Managers and admins can insert invites" ON public.invites;
DROP POLICY IF EXISTS "Managers and admins can update invites" ON public.invites;
DROP POLICY IF EXISTS "Managers can read invites for their store" ON public.invites;
DROP POLICY IF EXISTS "Admins can read all programs" ON public.onboarding_programs;
DROP POLICY IF EXISTS "Managers and admins can create programs" ON public.onboarding_programs;
DROP POLICY IF EXISTS "Managers and admins can update programs" ON public.onboarding_programs;
DROP POLICY IF EXISTS "Managers can insert ratings" ON public.performance_ratings;
DROP POLICY IF EXISTS "Managers can read ratings" ON public.performance_ratings;
DROP POLICY IF EXISTS "Managers can update ratings" ON public.performance_ratings;
DROP POLICY IF EXISTS "Admins and managers can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read accessible templates" ON public.program_templates;
DROP POLICY IF EXISTS "Corporate admins can manage all templates" ON public.program_templates;
DROP POLICY IF EXISTS "GMs and HR can manage store templates" ON public.program_templates;
DROP POLICY IF EXISTS "Managers and admins can read all completions" ON public.task_completions;
DROP POLICY IF EXISTS "Managers can update completions for review" ON public.task_completions;
DROP POLICY IF EXISTS "Corporate/HR admins can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Corporate admins can manage template days" ON public.template_days;
DROP POLICY IF EXISTS "GMs and HR can manage their store template days" ON public.template_days;
DROP POLICY IF EXISTS "Template days follow template access" ON public.template_days;
DROP POLICY IF EXISTS "Corporate admins can manage template tasks" ON public.template_tasks;
DROP POLICY IF EXISTS "GMs and HR can manage their store template tasks" ON public.template_tasks;
DROP POLICY IF EXISTS "Template tasks follow template day access" ON public.template_tasks;
DROP POLICY IF EXISTS "Managers can read store uploads" ON public.uploads;
DROP POLICY IF EXISTS "Managers can update store uploads" ON public.uploads;

-- ═══════════════════════════════════════════════
-- Step 2: Replace get_user_role (returns text with normalization)
-- ═══════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE (SELECT role::text FROM public.profiles WHERE user_id = _user_id LIMIT 1)
    WHEN 'corporate_admin' THEN 'app_admin'
    WHEN 'gm' THEN 'location_admin'
    WHEN 'hr_admin' THEN 'location_admin'
    WHEN 'sales_manager' THEN 'manager'
    WHEN 'associate' THEN 'user'
    ELSE (SELECT role::text FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  END;
$$;

-- ═══════════════════════════════════════════════
-- Step 3: Recreate ALL policies
-- ═══════════════════════════════════════════════

-- builder_sessions
CREATE POLICY "App admins can read all sessions" ON public.builder_sessions
FOR SELECT USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

-- daily_signoffs
CREATE POLICY "Managers can insert signoffs" ON public.daily_signoffs
FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers can read signoffs" ON public.daily_signoffs
FOR SELECT USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers can update signoffs" ON public.daily_signoffs
FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

-- days
CREATE POLICY "Admins can manage days" ON public.days
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'hr_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'hr_admin'));

-- departments
CREATE POLICY "App admins can manage departments" ON public.departments
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

-- invites
CREATE POLICY "App admins can read all invites" ON public.invites
FOR SELECT USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

CREATE POLICY "Managers and admins can insert invites" ON public.invites
FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers and admins can update invites" ON public.invites
FOR UPDATE USING (
  get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin')
  OR email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text
);

CREATE POLICY "Managers can read invites for their store" ON public.invites
FOR SELECT USING (
  store_id = (SELECT profiles.store_id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
  AND get_user_role(auth.uid()) IN ('manager', 'location_admin', 'sales_manager', 'gm', 'hr_admin')
);

-- onboarding_programs
CREATE POLICY "Admins can read all programs" ON public.onboarding_programs
FOR SELECT USING (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'hr_admin', 'gm'));

CREATE POLICY "Managers and admins can create programs" ON public.onboarding_programs
FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers and admins can update programs" ON public.onboarding_programs
FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

-- performance_ratings
CREATE POLICY "Managers can insert ratings" ON public.performance_ratings
FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers can read ratings" ON public.performance_ratings
FOR SELECT USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers can update ratings" ON public.performance_ratings
FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

-- profiles
CREATE POLICY "Admins and managers can read all profiles" ON public.profiles
FOR SELECT USING (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'manager', 'corporate_admin', 'hr_admin', 'gm', 'sales_manager'));

-- program_templates
CREATE POLICY "Authenticated users can read accessible templates" ON public.program_templates
FOR SELECT USING (
  status = 'published'
  OR created_by = auth.uid()
  OR get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin')
  OR (
    store_id IS NOT NULL
    AND get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
  )
);

CREATE POLICY "App admins can manage all templates" ON public.program_templates
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

CREATE POLICY "Location admins can manage store templates" ON public.program_templates
FOR ALL USING (
  get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  AND store_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
)
WITH CHECK (
  get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  AND store_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.store_id = program_templates.store_id)
);

-- task_completions
CREATE POLICY "Managers and admins can read all completions" ON public.task_completions
FOR SELECT USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

CREATE POLICY "Managers can update completions for review" ON public.task_completions
FOR UPDATE USING (get_user_role(auth.uid()) IN ('manager', 'location_admin', 'app_admin', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin'));

-- tasks
CREATE POLICY "Admins can manage tasks" ON public.tasks
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'hr_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'hr_admin'));

-- template_days
CREATE POLICY "Admins can manage template days" ON public.template_days
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

CREATE POLICY "Location admins can manage their store template days" ON public.template_days
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM program_templates pt
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE pt.id = template_days.template_id
    AND pt.store_id = p.store_id
    AND get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM program_templates pt
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE pt.id = template_days.template_id
    AND pt.store_id = p.store_id
    AND get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  )
);

CREATE POLICY "Template days follow template access" ON public.template_days
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM program_templates pt
    WHERE pt.id = template_days.template_id
    AND (
      pt.status = 'published'
      OR pt.created_by = auth.uid()
      OR get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin')
    )
  )
);

-- template_tasks
CREATE POLICY "Admins can manage template tasks" ON public.template_tasks
FOR ALL USING (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin'));

CREATE POLICY "Location admins can manage their store template tasks" ON public.template_tasks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM template_days td
    JOIN program_templates pt ON pt.id = td.template_id
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE td.id = template_tasks.template_day_id
    AND pt.store_id = p.store_id
    AND get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM template_days td
    JOIN program_templates pt ON pt.id = td.template_id
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE td.id = template_tasks.template_day_id
    AND pt.store_id = p.store_id
    AND get_user_role(auth.uid()) IN ('location_admin', 'gm', 'hr_admin')
  )
);

CREATE POLICY "Template tasks follow template day access" ON public.template_tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM template_days td
    JOIN program_templates pt ON pt.id = td.template_id
    WHERE td.id = template_tasks.template_day_id
    AND (
      pt.status = 'published'
      OR pt.created_by = auth.uid()
      OR get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin')
    )
  )
);

-- uploads
CREATE POLICY "Managers can read store uploads" ON public.uploads
FOR SELECT USING (
  auth.uid() = uploaded_by
  OR get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin')
  OR (
    get_user_role(auth.uid()) IN ('manager', 'location_admin', 'sales_manager', 'gm', 'hr_admin')
    AND EXISTS (
      SELECT 1 FROM onboarding_programs op
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE op.id = uploads.program_id AND op.store_id = p.store_id
    )
  )
);

CREATE POLICY "Managers can update store uploads" ON public.uploads
FOR UPDATE USING (
  auth.uid() = uploaded_by
  OR get_user_role(auth.uid()) IN ('app_admin', 'corporate_admin')
  OR (
    get_user_role(auth.uid()) IN ('manager', 'location_admin', 'sales_manager', 'gm', 'hr_admin')
    AND EXISTS (
      SELECT 1 FROM onboarding_programs op
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE op.id = uploads.program_id AND op.store_id = p.store_id
    )
  )
);

-- ═══════════════════════════════════════════════
-- Step 4: Create manager_departments table
-- ═══════════════════════════════════════════════
CREATE TABLE public.manager_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

ALTER TABLE public.manager_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own department assignments"
ON public.manager_departments FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage department assignments"
ON public.manager_departments FOR ALL
USING (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'gm', 'hr_admin'))
WITH CHECK (get_user_role(auth.uid()) IN ('app_admin', 'location_admin', 'corporate_admin', 'gm', 'hr_admin'));

CREATE POLICY "Managers can read assignments at their store"
ON public.manager_departments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.store_id = p2.store_id
    WHERE p1.user_id = auth.uid()
    AND p2.user_id = manager_departments.user_id
  )
);

-- ═══════════════════════════════════════════════
-- Step 5: Add department_ids to invites
-- ═══════════════════════════════════════════════
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS department_ids jsonb DEFAULT '[]'::jsonb;

-- ═══════════════════════════════════════════════
-- Step 6: Update handle_new_user trigger function
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role;
  v_normalized text;
  v_invite_exists boolean;
BEGIN
  v_normalized := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

  CASE v_normalized
    WHEN 'corporate_admin' THEN v_normalized := 'app_admin';
    WHEN 'gm' THEN v_normalized := 'location_admin';
    WHEN 'hr_admin' THEN v_normalized := 'location_admin';
    WHEN 'sales_manager' THEN v_normalized := 'manager';
    WHEN 'associate' THEN v_normalized := 'user';
    ELSE NULL;
  END CASE;

  v_role := v_normalized::app_role;

  IF v_role <> 'user' THEN
    SELECT EXISTS (
      SELECT 1 FROM invites
      WHERE email = NEW.email
      AND (
        role::text = v_role::text
        OR role::text = (CASE v_role::text
          WHEN 'app_admin' THEN 'corporate_admin'
          WHEN 'location_admin' THEN 'gm'
          WHEN 'manager' THEN 'sales_manager'
          ELSE v_role::text
        END)
      )
      AND status = 'accepted'
    ) INTO v_invite_exists;

    IF NOT v_invite_exists THEN
      v_role := 'user';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, role, store_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role,
    CASE WHEN NEW.raw_user_meta_data->>'store_id' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'store_id')::uuid
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$function$;

-- ═══════════════════════════════════════════════
-- Step 7: Update notify functions for new role names
-- ═══════════════════════════════════════════════
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
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
        body := jsonb_build_object('to', v_associate_email, 'subject', 'Performance Feedback: Needs Work', 'body', v_body, 'notificationId', v_notif_id::text)
      );
    END IF;

    SELECT COUNT(*) INTO v_needs_work_count
    FROM performance_ratings WHERE program_id = NEW.program_id AND rating = 'needs_work';

    IF v_needs_work_count >= 3 THEN
      SELECT p.user_id, p.email INTO v_gm_id, v_gm_email
      FROM profiles p WHERE p.store_id = v_program.store_id AND p.role::text IN ('gm', 'location_admin') LIMIT 1;

      IF v_gm_id IS NOT NULL THEN
        v_body := v_associate_name || ' has received ' || v_needs_work_count || ' ''Needs Work'' ratings. Review may be needed.';
        INSERT INTO notifications (user_id, type, title, body, related_program_id)
        VALUES (v_gm_id, 'needs_work', 'Associate Needs Attention', v_body, NEW.program_id)
        RETURNING id INTO v_notif_id;

        IF v_gm_email IS NOT NULL THEN
          PERFORM net.http_post(
            url := v_base_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
            body := jsonb_build_object('to', v_gm_email, 'subject', 'Associate Needs Attention', 'body', v_body, 'notificationId', v_notif_id::text)
          );
        END IF;
      END IF;
    END IF;
  END IF;

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

  SELECT p.user_id, p.email INTO v_gm_id, v_email FROM profiles p WHERE p.store_id = v_program.store_id AND p.role::text IN ('gm', 'location_admin') LIMIT 1;
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

-- ═══════════════════════════════════════════════
-- Step 8: Migrate existing profile data to new roles
-- ═══════════════════════════════════════════════
UPDATE public.profiles SET role = 'app_admin' WHERE role::text = 'corporate_admin';
UPDATE public.profiles SET role = 'location_admin' WHERE role::text = 'gm';
UPDATE public.profiles SET role = 'location_admin' WHERE role::text = 'hr_admin';
UPDATE public.profiles SET role = 'manager' WHERE role::text = 'sales_manager';
UPDATE public.profiles SET role = 'user' WHERE role::text = 'associate';
