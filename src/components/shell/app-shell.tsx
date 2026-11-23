"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "../../lib/utils";

type NavItem = { href: string; label: string };
type WorkspaceOption = { id: string; name: string };

export function AppShell({
  appName,
  nav,
  workspaces,
  currentWorkspaceId,
  userName,
  logoutLabel,
  children,
}: {
  appName: string;
  nav: NavItem[];
  workspaces: WorkspaceOption[];
  currentWorkspaceId: string;
  userName: string;
  logoutLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-line bg-card md:flex md:flex-col md:px-4 md:py-6">
        <Link href="/hoy" className="font-display text-2xl tracking-tight">
          {appName}
        </Link>
        <WorkspaceSelect workspaces={workspaces} current={currentWorkspaceId} />
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm",
                pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-sand font-medium" : "text-muted hover:bg-sand",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-6 text-sm">
          <p className="truncate text-muted">{userName}</p>
          <LogoutButton label={logoutLabel} />
        </div>
      </aside>
      <div className="pb-24 md:pb-0">
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Link href="/hoy" className="font-display text-xl">
            {appName}
          </Link>
          <LogoutButton label={logoutLabel} />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur md:hidden">
        <ul className="flex gap-1 overflow-x-auto px-2 py-2 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block whitespace-nowrap rounded-full px-3 py-2 text-sm",
                  pathname === item.href ? "bg-ink text-paper" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function WorkspaceSelect({ workspaces, current }: { workspaces: WorkspaceOption[]; current: string }) {
  const router = useRouter();
  if (workspaces.length < 2) {
    return <p className="mt-4 truncate text-sm text-muted">{workspaces[0]?.name}</p>;
  }
  return (
    <select
      className="mt-4 w-full rounded-xl border border-line bg-paper px-2 py-2 text-sm"
      value={current}
      aria-label="Workspace"
      onChange={async (event) => {
        await fetch("/api/v1/workspaces/select", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId: event.target.value }),
        });
        router.push("/hoy");
        router.refresh();
      }}
    >
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name}
        </option>
      ))}
    </select>
  );
}

function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mt-2 text-sm text-clay"
      onClick={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
