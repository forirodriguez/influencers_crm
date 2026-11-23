import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/shell/app-shell";
import { APP_NAV } from "../../components/shell/nav";
import { requireAppContext } from "../../modules/identity/context";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAppContext();
  if (!context.user.country) redirect("/onboarding");
  const t = await getTranslations();
  return (
    <AppShell
      appName={t("common.appName")}
      logoutLabel={t("common.logout")}
      userName={context.user.name ?? context.user.email}
      currentWorkspaceId={context.workspace.workspaceId}
      workspaces={context.memberships.map((item) => ({ id: item.workspaceId, name: item.workspaceName }))}
      nav={APP_NAV.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }))}
    >
      {children}
    </AppShell>
  );
}
