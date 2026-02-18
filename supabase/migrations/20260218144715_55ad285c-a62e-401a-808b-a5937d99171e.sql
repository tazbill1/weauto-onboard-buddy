CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role app_role;
  v_invite_exists boolean;
BEGIN
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'associate');
  
  -- If role is not associate, verify there is a matching accepted invite
  IF v_role <> 'associate' THEN
    SELECT EXISTS (
      SELECT 1 FROM invites 
      WHERE email = NEW.email 
      AND role = v_role  -- Fixed: compare app_role to app_role, not to text
      AND status = 'accepted'
    ) INTO v_invite_exists;
    
    IF NOT v_invite_exists THEN
      v_role := 'associate';
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