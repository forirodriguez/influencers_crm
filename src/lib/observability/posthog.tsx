"use client";

import { useEffect } from "react";

export function ProductAnalytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    void import("posthog-js").then((posthog) => {
      posthog.default.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
      });
    });
  }, []);
  return null;
}
