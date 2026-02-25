
-- ═══════════════════════════════════════════════
-- Migration 1: Add new enum values only
-- (must be committed separately before use)
-- ═══════════════════════════════════════════════
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'app_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'location_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
