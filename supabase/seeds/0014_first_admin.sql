-- 0014_first_admin.sql
-- Feature: 014-admin-products-crud
--
-- Seed the first admin user. Replace <replace-me> with the UUID of the
-- bootstrap user from Supabase Authentication → Users before running.
-- See specs/014-admin-products-crud/quickstart.md §1 for the shell
-- command that substitutes the placeholder safely.

INSERT INTO public.user_roles (user_id, role)
VALUES ('<replace-me>', 'admin')
ON CONFLICT DO NOTHING;
