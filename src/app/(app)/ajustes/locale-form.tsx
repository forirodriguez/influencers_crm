import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_LOCALE, ACTIVE_LOCALES } from "../../../lib/constants";
import { verifySessionToken } from "../../../lib/session";
import { updateProfile } from "../../../modules/identity/service";

async function updateLocale(formData: FormData) {
  "use server";
  const jar = await cookies();
  const session = await verifySessionToken(jar.get("icrm_session")?.value);
  if (!session) redirect("/login");
  const locale = String(formData.get("locale") ?? "");
  if (locale !== ACTIVE_LOCALE) redirect("/ajustes");
  await updateProfile(session.sub, { locale: ACTIVE_LOCALE });
  jar.set("icrm_locale", ACTIVE_LOCALE, { path: "/", sameSite: "lax" });
  redirect("/ajustes");
}

export function LocaleForm({ label, optionLabel, current, save }: { label: string; optionLabel: string; current: string; save: string }) {
  return (
    <form action={updateLocale} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="text-sm">
        {label}
        <select name="locale" defaultValue={current} className="mt-1 block rounded-xl border border-line bg-paper px-3 py-2">
          {ACTIVE_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {optionLabel}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-paper">
        {save}
      </button>
    </form>
  );
}
