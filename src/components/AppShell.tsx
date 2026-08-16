import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Home, School, Settings, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getHasUnsavedChanges } from "@/hooks/useUnsavedChanges";

export function BottomNav() {
  const { userDoc } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!userDoc) return null;

  const items = [
    { to: "/app", label: "Início", icon: Home },
    ...((userDoc.profileType === "school_admin" || userDoc.globalRole === "master")
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
                onClick={(e) => {
                  if (getHasUnsavedChanges()) {
                    if (!window.confirm("Você tem alterações não salvas. Deseja realmente sair sem salvar?")) {
                      e.preventDefault();
                    }
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all duration-200 relative",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-xl transition-all duration-300",
                  active ? "bg-primary/10 scale-110" : "group-hover:bg-muted"
                )}>
                  <Icon className={cn("size-5", active && "stroke-[2.5px]")} />
                </div>
                {it.label}
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-1 w-1 h-1 rounded-full bg-primary"
                  />
                )}
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
  back = true,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  back?: boolean;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const handleBack = () => {
    if (getHasUnsavedChanges()) {
      if (!window.confirm("Você tem alterações não salvas. Deseja realmente sair sem salvar?")) {
        return;
      }
    }
    
    // Primary navigation check: go back in history if possible
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      
      // Safety timeout: if history.back didn't move us (e.g. at the start of app session)
      // then we fallback to navigating to /app
      setTimeout(() => {
        if (window.location.pathname.startsWith('/app') && 
            (window.location.pathname === router.state.location.pathname)) {
          navigate({ to: "/app" });
        }
      }, 100);
    } else {
      navigate({ to: "/app" });
    }
  };
  return (
    <div className="min-h-screen bg-muted/20 pb-24 overflow-x-hidden">
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b">
        <div className="mx-auto max-w-md px-2 h-14 flex items-center gap-1">
          {back ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={handleBack}
              className="shrink-0 active:scale-90 transition-transform"
            >
              <ChevronLeft className="size-5" />
            </Button>
          ) : (
            <div className="w-2" />
          )}
          <motion.h1 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            key={title}
            className="text-base font-semibold truncate flex-1"
          >
            {title}
          </motion.h1>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={router.state.location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
