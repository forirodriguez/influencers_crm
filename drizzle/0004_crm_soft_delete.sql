-- CRM rows are retired with deleted_at. The phase-1 UPDATE policies required the
-- new row to keep deleted_at null, so a member could not soft-delete. Owners and
-- managers may set deleted_at; they still cannot update a row that is already deleted,
-- and app_jobs is unchanged. Workspace checks stay in the WITH CHECK.
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (current_user = ''app_jobs'' OR (deleted_at IS NULL AND app.membership_role(workspace_id) IN (''owner'', ''manager''))) WITH CHECK (current_user = ''app_jobs'' OR app.membership_role(workspace_id) IN (''owner'', ''manager''))',
      t || '_update',
      t
    );
  END LOOP;
END $$;
