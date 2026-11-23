import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { isReservedSlug } from "../../lib/slug";
import { getPublicMediaKit } from "../../modules/media-kit/queries";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTranslations("mediaKit");
  const kit = isReservedSlug(slug) || slug.includes(".") ? null : await getPublicMediaKit(slug);
  const accent = kit?.settings.accent || "#b8432f";
  const followers = kit?.accounts.reduce((sum, account) => sum + (account.followers ?? 0), 0) ?? 0;
  const followerLabel = new Intl.NumberFormat("es-AR").format(followers);
  const initial = (kit?.displayName ?? "M").slice(0, 1);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#f3eee7",
          color: "#241c18",
          padding: 72,
          fontFamily: "Georgia",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: accent }}>influencers_crm</div>
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            <div
              style={{
                display: "flex",
                width: 160,
                height: 160,
                borderRadius: 80,
                background: accent,
                color: "white",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 72,
              }}
            >
              {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 76, lineHeight: 1 }}>{kit?.displayName ?? t("missing")}</div>
              <div style={{ marginTop: 18, fontSize: 32 }}>{`${followerLabel} ${t("followers")}`}</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#6e625b" }}>/{kit?.slug ?? slug}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
