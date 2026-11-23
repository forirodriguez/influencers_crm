-- Public media kit: richer metrics, recent posts, and no audience under 100 followers.
-- Instagram does not return follower demographics below that threshold.
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
          'following', ms.following,
          'mediaCount', ms.media_count,
          'likesTotal', ms.likes_total::text,
          'reach30d', ms.reach_30d::text,
          'views30d', ms.views_30d::text,
          'interactions30d', ms.interactions_30d::text,
          'demographics', CASE
            WHEN COALESCE(ms.followers, 0) >= 100 THEN ms.demographics
            ELSE NULL
          END,
          'capturedAt', ms.captured_at,
          'posts', COALESCE((
            SELECT jsonb_agg(limited.item ORDER BY limited.ord)
            FROM (
              SELECT jsonb_build_object(
                'url', p.url,
                'type', p.type,
                'thumbnailUrl', p.thumbnail_url,
                'publishedAt', p.published_at,
                'metrics', COALESCE(p.metrics, '{}'::jsonb)
              ) AS item,
              row_number() OVER (ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC) AS ord
              FROM posts p
              WHERE p.social_account_id = sa.id
                AND p.deleted_at IS NULL
              ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
              LIMIT 8
            ) limited
          ), '[]'::jsonb)
        ) ORDER BY sa.platform, sa.handle)
        FROM social_accounts sa
        LEFT JOIN LATERAL (
          SELECT followers, following, media_count, likes_total, reach_30d, views_30d, interactions_30d, demographics, captured_at
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
GRANT EXECUTE ON FUNCTION app.get_public_media_kit(text) TO app_user, app_jobs
