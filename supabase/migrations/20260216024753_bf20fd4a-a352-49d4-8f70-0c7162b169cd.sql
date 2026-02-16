-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_task_completions_program_id ON public.task_completions(program_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_associate_id ON public.task_completions(associate_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON public.task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_status ON public.task_completions(status);

CREATE INDEX IF NOT EXISTS idx_onboarding_programs_associate_id ON public.onboarding_programs(associate_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_programs_manager_id ON public.onboarding_programs(manager_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_programs_store_id ON public.onboarding_programs(store_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_programs_status ON public.onboarding_programs(status);

CREATE INDEX IF NOT EXISTS idx_performance_ratings_program_id ON public.performance_ratings(program_id);
CREATE INDEX IF NOT EXISTS idx_performance_ratings_task_id ON public.performance_ratings(task_id);
CREATE INDEX IF NOT EXISTS idx_performance_ratings_rating ON public.performance_ratings(rating);

CREATE INDEX IF NOT EXISTS idx_daily_signoffs_program_id ON public.daily_signoffs(program_id);
CREATE INDEX IF NOT EXISTS idx_daily_signoffs_day_number ON public.daily_signoffs(day_number);
CREATE INDEX IF NOT EXISTS idx_daily_signoffs_manager_id ON public.daily_signoffs(manager_id);

CREATE INDEX IF NOT EXISTS idx_uploads_program_id ON public.uploads(program_id);
CREATE INDEX IF NOT EXISTS idx_uploads_task_id ON public.uploads(task_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_by ON public.uploads(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

CREATE INDEX IF NOT EXISTS idx_tasks_day_id ON public.tasks(day_id);
CREATE INDEX IF NOT EXISTS idx_days_day_number ON public.days(day_number);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON public.profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
