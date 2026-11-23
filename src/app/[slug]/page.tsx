import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEnv } from "../../lib/env.server";
import { isReservedSlug } from "../../lib/slug";
import { getPublicMediaKit } from "../../modules/media-kit/queries";
import { MediaKitView } from "../../modules/media-kit/view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};
  const kit = await getPublicMediaKit(slug);
  if (!kit) return {};
  return {
    title: kit.displayName,
    description: kit.bio ?? undefined,
    robots: kit.settings.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: kit.displayName,
      description: kit.bio ?? undefined,
      url: `${getEnv().NEXT_PUBLIC_APP_URL}/${kit.slug}`,
      images: [`${getEnv().NEXT_PUBLIC_APP_URL}/${kit.slug}/opengraph-image`],
    },
  };
}

export default async function PublicMediaKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isReservedSlug(slug) || slug.includes(".")) notFound();
  const kit = await getPublicMediaKit(slug);
  if (!kit) notFound();
  const origin = getEnv().NEXT_PUBLIC_APP_URL;
  return (
    <main className="min-h-screen bg-paper">
      <MediaKitView kit={kit} shareUrl={`${origin}/${kit.slug}`} />
    </main>
  );
}
