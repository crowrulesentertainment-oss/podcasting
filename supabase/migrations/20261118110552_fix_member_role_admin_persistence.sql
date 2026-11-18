-- Restore admin management of secondary member roles.
-- Primary roles are stored on public.members; optional secondary roles live in public.member_roles.
-- Keep the existing member-owned SELECT policy and add admin-only access using the
-- same private authorization helper already used by the role-options catalog.

ALTER TABLE public.member_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.member_roles TO authenticated;

DROP POLICY IF EXISTS "Admins can view all member role assignments" ON public.member_roles;
CREATE POLICY "Admins can view all member role assignments"
ON public.member_roles
FOR SELECT
TO authenticated
USING ((SELECT private.crowrules_is_admin_impl()));

DROP POLICY IF EXISTS "Admins can insert member role assignments" ON public.member_roles;
CREATE POLICY "Admins can insert member role assignments"
ON public.member_roles
FOR INSERT
TO authenticated
WITH CHECK ((SELECT private.crowrules_is_admin_impl()));

DROP POLICY IF EXISTS "Admins can delete member role assignments" ON public.member_roles;
CREATE POLICY "Admins can delete member role assignments"
ON public.member_roles
FOR DELETE
TO authenticated
USING ((SELECT private.crowrules_is_admin_impl()));
