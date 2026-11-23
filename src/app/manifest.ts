import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "influencers_crm",
    short_name: "influencers_crm",
    description: "Acuerdos, entregas y cobros para microinfluencers.",
    start_url: "/hoy",
    display: "standalone",
    background_color: "#f3eee7",
    theme_color: "#241c18",
    lang: "es",
  };
}
