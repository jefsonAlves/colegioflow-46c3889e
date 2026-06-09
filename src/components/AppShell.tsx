import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Home, School, Settings, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { userDoc } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!userDoc) return null;

  const items = [
    { to: "/app", label: "Início", icon: Home },
    ...(userDoc.profileType === "school_admin"
      ? [{ to: "/app/escola", label: "Escola", icon: School }]
      : []),
    ...(userDoc.globalRole === "master"
      ? [{ to: "/app/master", label: "Master", icon: Shield }]
      : []),
    { to: "/app/perfil", label: "Perfil", icon: Settings },
  ] as const;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul
        className="mx-auto max-w-md grid px-2 pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}
      >
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-20 bg-card border-b">
        <div className="mx-auto max-w-md px-4 h-14 flex items-center justify-between">
          <h1 className="text-base font-semibold truncate">{title}</h1>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">{children}</main>
      <BottomNav />
    </div>
  );
}
