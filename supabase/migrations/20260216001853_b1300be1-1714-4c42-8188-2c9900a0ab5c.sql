
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('associate', 'sales_manager', 'gm', 'hr_admin', 'corporate_admin');

-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (true);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'associate',
  store_id UUID REFERENCES public.stores(id),
  avatar_url TEXT,
  hired_date DATE,
  onboarding_start_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE POLICY "Admins and managers can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('corporate_admin', 'hr_admin', 'gm', 'sales_manager')
  );

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role, store_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'associate'),
    CASE WHEN NEW.raw_user_meta_data->>'store_id' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'store_id')::uuid 
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed stores
INSERT INTO public.stores (id, store_name, brand, address) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'WEAuto Toyota Ann Arbor', 'Toyota', '2200 W Stadium Blvd, Ann Arbor, MI'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'WEAuto Subaru Ann Arbor', 'Subaru', '2845 S State St, Ann Arbor, MI'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'WEAuto CDJR Ann Arbor', 'CDJR', '3975 Jackson Rd, Ann Arbor, MI');
