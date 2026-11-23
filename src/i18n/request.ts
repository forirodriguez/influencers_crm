import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { loadMessages, resolveLocale } from "./load";

export default getRequestConfig(async () => {
  const jar = await cookies();
  const locale = resolveLocale(jar.get("icrm_locale")?.value);
  return {
    locale,
    messages: loadMessages(locale),
  };
});
