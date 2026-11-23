-- Row-level access by workspace membership.
-- Runtime requests use the app_user role and set app.user_id inside a transaction.
-- Jobs use app_jobs, which is allowed through the policies below.
-- The table owner (postgres / migration role) is a superuser and bypasses RLS.
-- Do not point the Next.js request path at the superuser URL.

CREATE SCHEMA IF NOT EXISTS app
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw text;
BEGIN
  raw := nullif(btrim(current_setting('app.user_id', true)), '');
  IF raw IS NULL THEN
    raw := nullif(btrim(current_setting('request.jwt.claim.sub', true)), '');
  END IF;
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN raw::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.user_workspace_ids() RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM memberships
  WHERE user_id = app.current_user_id()
    AND deleted_at IS NULL
    AND accepted_at IS NOT NULL;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.membership_role(ws uuid) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM memberships
  WHERE ws IS NOT NULL
    AND workspace_id = ws
    AND user_id = app.current_user_id()
    AND accepted_at IS NOT NULL
    AND deleted_at IS NULL
  LIMIT 1;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.profile_workspace(p_id uuid) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM creator_profiles WHERE id = p_id AND deleted_at IS NULL;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.account_workspace(p_id uuid) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.workspace_id
  FROM social_accounts sa
  JOIN creator_profiles cp ON cp.id = sa.creator_profile_id
  WHERE sa.id = p_id
    AND sa.deleted_at IS NULL
    AND cp.deleted_at IS NULL;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.get_public_media_kit(p_slug text) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN cp.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'slug', cp.slug,
      'displayName', cp.display_name,
      'bio', cp.bio,
      'photoUrl', cp.photo_url,
      'country', cp.country,
      'city', cp.city,
      'niches', to_jsonb(cp.niches),
      'languages', to_jsonb(cp.languages),
      'publicEmail', cp.public_email,
      'publicWhatsapp', cp.public_whatsapp,
      'settings', cp.media_kit_settings,
      'services', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name', s.name,
          'platform', s.platform,
          'priceMinor', s.price_minor::text,
          'currency', s.currency,
          'isFromPrice', s.is_from_price
        ) ORDER BY s.created_at)
        FROM services s
        WHERE s.creator_profile_id = cp.id
          AND s.deleted_at IS NULL
          AND s.visible = true
      ), '[]'::jsonb),
      'accounts', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'platform', sa.platform,
          'handle', sa.handle,
          'connection', sa.connection,
          'followers', ms.followers,
          'reach30d', ms.reach_30d::text,
          'views30d', ms.views_30d::text,
          'capturedAt', ms.captured_at
        ) ORDER BY sa.platform)
        FROM social_accounts sa
        LEFT JOIN LATERAL (
          SELECT followers, reach_30d, views_30d, captured_at
          FROM metric_snapshots
          WHERE social_account_id = sa.id
            AND deleted_at IS NULL
          ORDER BY captured_at DESC
          LIMIT 1
        ) ms ON true
        WHERE sa.creator_profile_id = cp.id
          AND sa.deleted_at IS NULL
          AND sa.status = 'active'
      ), '[]'::jsonb)
    )
  END
  FROM creator_profiles cp
  WHERE cp.slug = p_slug
    AND cp.deleted_at IS NULL;
$$
--> statement-breakpoint
ALTER TABLE invitations
  DROP CONSTRAINT IF EXISTS invitations_role_not_owner
--> statement-breakpoint
ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_not_owner CHECK (role <> 'owner')
--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.table_name || '_touch', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()',
      r.table_name || '_touch',
      r.table_name
    );
  END LOOP;
END $$
--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'creator_profiles',
    'brands',
    'brand_contacts',
    'pipeline_stages',
    'deals',
    'deliverables',
    'payment_expectations',
    'payments_received',
    'activities',
    'attachments',
    'reminder_rules'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (current_user = ''app_jobs'' OR (deleted_at IS NULL AND workspace_id IN (SELECT app.user_workspace_ids())))',
      t || '_select',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (current_user = ''app_jobs'' OR (deleted_at IS NULL AND app.membership_role(workspace_id) IN (''owner'', ''manager'')))',
      t || '_insert',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (current_user = ''app_jobs'' OR (deleted_at IS NULL AND app.membership_role(workspace_id) IN (''owner'', ''manager''))) WITH CHECK (current_user = ''app_jobs'' OR (deleted_at IS NULL AND app.membership_role(workspace_id) IN (''owner'', ''manager'')))',
      t || '_update',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (current_user = ''app_jobs'' OR app.membership_role(workspace_id) IN (''owner'', ''manager''))',
      t || '_delete',
      t
    );
  END LOOP;
END $$
--> statement-breakpoint
DROP POLICY IF EXISTS workspaces_select ON workspaces
--> statement-breakpoint
DROP POLICY IF EXISTS workspaces_update ON workspaces
--> statement-breakpoint
DROP POLICY IF EXISTS workspaces_delete ON workspaces
--> statement-breakpoint
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (current_user = 'app_jobs' OR (deleted_at IS NULL AND id IN (SELECT app.user_workspace_ids())))
--> statement-breakpoint
CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (current_user = 'app_jobs' OR app.membership_role(id) = 'owner')
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(id) = 'owner')
--> statement-breakpoint
CREATE POLICY workspaces_delete ON workspaces FOR DELETE
  USING (current_user = 'app_jobs' OR app.membership_role(id) = 'owner')
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_select ON memberships
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_insert ON memberships
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_update ON memberships
--> statement-breakpoint
DROP POLICY IF EXISTS memberships_delete ON memberships
--> statement-breakpoint
CREATE POLICY memberships_select ON memberships FOR SELECT
  USING (current_user = 'app_jobs' OR (deleted_at IS NULL AND workspace_id IN (SELECT app.user_workspace_ids())))
--> statement-breakpoint
CREATE POLICY memberships_insert ON memberships FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
CREATE POLICY memberships_update ON memberships FOR UPDATE
  USING (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
CREATE POLICY memberships_delete ON memberships FOR DELETE
  USING (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
DROP POLICY IF EXISTS invitations_select ON invitations
--> statement-breakpoint
DROP POLICY IF EXISTS invitations_insert ON invitations
--> statement-breakpoint
DROP POLICY IF EXISTS invitations_update ON invitations
--> statement-breakpoint
DROP POLICY IF EXISTS invitations_delete ON invitations
--> statement-breakpoint
CREATE POLICY invitations_select ON invitations FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(workspace_id) IN ('owner', 'manager'))
  )
--> statement-breakpoint
CREATE POLICY invitations_insert ON invitations FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
CREATE POLICY invitations_update ON invitations FOR UPDATE
  USING (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
CREATE POLICY invitations_delete ON invitations FOR DELETE
  USING (current_user = 'app_jobs' OR app.membership_role(workspace_id) = 'owner')
--> statement-breakpoint
DROP POLICY IF EXISTS users_select ON users
--> statement-breakpoint
DROP POLICY IF EXISTS users_update ON users
--> statement-breakpoint
CREATE POLICY users_select ON users FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR id = app.current_user_id()
    OR id IN (
      SELECT m.user_id
      FROM memberships m
      WHERE m.deleted_at IS NULL
        AND m.accepted_at IS NOT NULL
        AND m.workspace_id IN (SELECT app.user_workspace_ids())
    )
  )
--> statement-breakpoint
CREATE POLICY users_update ON users FOR UPDATE
  USING (current_user = 'app_jobs' OR id = app.current_user_id())
  WITH CHECK (current_user = 'app_jobs' OR id = app.current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS notifications_select ON notifications
--> statement-breakpoint
DROP POLICY IF EXISTS notifications_insert ON notifications
--> statement-breakpoint
DROP POLICY IF EXISTS notifications_update ON notifications
--> statement-breakpoint
DROP POLICY IF EXISTS notifications_delete ON notifications
--> statement-breakpoint
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (
      deleted_at IS NULL
      AND user_id = app.current_user_id()
      AND workspace_id IN (SELECT app.user_workspace_ids())
    )
  )
--> statement-breakpoint
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(workspace_id) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (user_id = app.current_user_id() AND workspace_id IN (SELECT app.user_workspace_ids()))
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR (user_id = app.current_user_id() AND workspace_id IN (SELECT app.user_workspace_ids()))
  )
--> statement-breakpoint
CREATE POLICY notifications_delete ON notifications FOR DELETE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS audit_log_select ON audit_log
--> statement-breakpoint
DROP POLICY IF EXISTS audit_log_insert ON audit_log
--> statement-breakpoint
DROP POLICY IF EXISTS audit_log_delete ON audit_log
--> statement-breakpoint
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (current_user = 'app_jobs' OR app.membership_role(workspace_id) IN ('owner', 'manager'))
--> statement-breakpoint
CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR app.membership_role(workspace_id) IN ('owner', 'manager'))
--> statement-breakpoint
CREATE POLICY audit_log_delete ON audit_log FOR DELETE
  USING (current_user = 'app_jobs')
--> statement-breakpoint
DROP POLICY IF EXISTS legal_acceptances_select ON legal_acceptances
--> statement-breakpoint
DROP POLICY IF EXISTS legal_acceptances_insert ON legal_acceptances
--> statement-breakpoint
CREATE POLICY legal_acceptances_select ON legal_acceptances FOR SELECT
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY legal_acceptances_insert ON legal_acceptances FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS social_accounts_select ON social_accounts
--> statement-breakpoint
DROP POLICY IF EXISTS social_accounts_insert ON social_accounts
--> statement-breakpoint
DROP POLICY IF EXISTS social_accounts_update ON social_accounts
--> statement-breakpoint
DROP POLICY IF EXISTS social_accounts_delete ON social_accounts
--> statement-breakpoint
CREATE POLICY social_accounts_select ON social_accounts FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.profile_workspace(creator_profile_id)) IS NOT NULL)
  )
--> statement-breakpoint
CREATE POLICY social_accounts_insert ON social_accounts FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY social_accounts_update ON social_accounts FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager'))
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY social_accounts_delete ON social_accounts FOR DELETE
  USING (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
DROP POLICY IF EXISTS services_select ON services
--> statement-breakpoint
DROP POLICY IF EXISTS services_insert ON services
--> statement-breakpoint
DROP POLICY IF EXISTS services_update ON services
--> statement-breakpoint
DROP POLICY IF EXISTS services_delete ON services
--> statement-breakpoint
CREATE POLICY services_select ON services FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.profile_workspace(creator_profile_id)) IS NOT NULL)
  )
--> statement-breakpoint
CREATE POLICY services_insert ON services FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY services_update ON services FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager'))
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY services_delete ON services FOR DELETE
  USING (
    current_user = 'app_jobs'
    OR app.membership_role(app.profile_workspace(creator_profile_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
DROP POLICY IF EXISTS metric_snapshots_select ON metric_snapshots
--> statement-breakpoint
DROP POLICY IF EXISTS metric_snapshots_insert ON metric_snapshots
--> statement-breakpoint
DROP POLICY IF EXISTS metric_snapshots_update ON metric_snapshots
--> statement-breakpoint
DROP POLICY IF EXISTS metric_snapshots_delete ON metric_snapshots
--> statement-breakpoint
CREATE POLICY metric_snapshots_select ON metric_snapshots FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.account_workspace(social_account_id)) IS NOT NULL)
  )
--> statement-breakpoint
CREATE POLICY metric_snapshots_insert ON metric_snapshots FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY metric_snapshots_update ON metric_snapshots FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager'))
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY metric_snapshots_delete ON metric_snapshots FOR DELETE
  USING (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
DROP POLICY IF EXISTS posts_select ON posts
--> statement-breakpoint
DROP POLICY IF EXISTS posts_insert ON posts
--> statement-breakpoint
DROP POLICY IF EXISTS posts_update ON posts
--> statement-breakpoint
DROP POLICY IF EXISTS posts_delete ON posts
--> statement-breakpoint
CREATE POLICY posts_select ON posts FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.account_workspace(social_account_id)) IS NOT NULL)
  )
--> statement-breakpoint
CREATE POLICY posts_insert ON posts FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY posts_update ON posts FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (deleted_at IS NULL AND app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager'))
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
CREATE POLICY posts_delete ON posts FOR DELETE
  USING (
    current_user = 'app_jobs'
    OR app.membership_role(app.account_workspace(social_account_id)) IN ('owner', 'manager')
  )
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_consents_select ON whatsapp_consents
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_consents_insert ON whatsapp_consents
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_consents_update ON whatsapp_consents
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_consents_delete ON whatsapp_consents
--> statement-breakpoint
CREATE POLICY whatsapp_consents_select ON whatsapp_consents FOR SELECT
  USING (current_user = 'app_jobs' OR (deleted_at IS NULL AND user_id = app.current_user_id()))
--> statement-breakpoint
CREATE POLICY whatsapp_consents_insert ON whatsapp_consents FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY whatsapp_consents_update ON whatsapp_consents FOR UPDATE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY whatsapp_consents_delete ON whatsapp_consents FOR DELETE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_messages_select ON whatsapp_messages
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_messages_insert ON whatsapp_messages
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_messages_update ON whatsapp_messages
--> statement-breakpoint
DROP POLICY IF EXISTS whatsapp_messages_delete ON whatsapp_messages
--> statement-breakpoint
CREATE POLICY whatsapp_messages_select ON whatsapp_messages FOR SELECT
  USING (current_user = 'app_jobs' OR (deleted_at IS NULL AND user_id = app.current_user_id()))
--> statement-breakpoint
CREATE POLICY whatsapp_messages_insert ON whatsapp_messages FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY whatsapp_messages_update ON whatsapp_messages FOR UPDATE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY whatsapp_messages_delete ON whatsapp_messages FOR DELETE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, app_jobs
--> statement-breakpoint
REVOKE ALL ON TABLE public.auth_credentials FROM app_user, app_jobs
--> statement-breakpoint
REVOKE ALL ON TABLE public.magic_links FROM app_user, app_jobs
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_user, app_jobs
--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user, app_jobs
