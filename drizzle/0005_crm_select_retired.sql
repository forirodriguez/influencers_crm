-- Postgres checks the new row of an UPDATE against SELECT policies. The phase-1
-- SELECT policies hide every row with deleted_at set, so an owner could not
-- retire a CRM row. Owners and managers may read retired rows (the app still
-- filters deleted_at). Viewers keep seeing only live rows.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brands',
    'brand_contacts',
    'pipeline_stages',
    'deals',
    'deliverables',
    'payment_expectations',
    'payments_received',
    'activities',
    'attachments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (current_user = ''app_jobs'' OR (workspace_id IN (SELECT app.user_workspace_ids()) AND (deleted_at IS NULL OR app.membership_role(workspace_id) IN (''owner'', ''manager''))))',
      t || '_select',
      t
    );
  END LOOP;
END $$;
