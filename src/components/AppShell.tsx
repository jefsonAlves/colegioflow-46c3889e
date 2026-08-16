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
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border/40 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
      <ul
        className="mx-auto max-w-md grid px-4 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-3"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}
      >
        {items.map((it) => {
          const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
          const Icon = it.icon;
          return (
            <li key={it.to} className="group">
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
                  "flex flex-col items-center gap-1.5 py-1 text-[11px] font-bold transition-all duration-300 relative",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className={cn(
                  "p-2 rounded-2xl transition-all duration-500 relative",
                  active ? "bg-primary/15 text-primary shadow-lg shadow-primary/10" : "group-hover:bg-muted/50"
                )}>
                  <Icon className={cn("size-6 transition-transform duration-500", active && "scale-110 stroke-[2.5px]")} />
                  {active && (
                    <motion.div
                      layoutId="nav-glow"
                      className="absolute inset-0 bg-primary/20 blur-xl rounded-full -z-10"
                    />
                  )}
                </div>
                <span className="tracking-tight">{it.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-3 w-6 h-1 rounded-full bg-primary"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
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
    <div className="min-h-screen bg-linear-to-b from-background to-muted/30 pb-24 overflow-x-hidden">
      <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-xl border-b border-border/40">
        <div className="mx-auto max-w-md px-3 h-16 flex items-center gap-2">
          {back ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={handleBack}
              className="shrink-0 active:scale-90 transition-all duration-200 hover:bg-primary/10 hover:text-primary rounded-2xl"
            >
              <ChevronLeft className="size-6" />
            </Button>
          ) : (
            <div className="w-2" />
          )}
          <motion.h1 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            key={title}
            className="text-lg font-bold tracking-tight truncate flex-1"
          >
            {title}
          </motion.h1>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6 space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={router.state.location.pathname}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 150,
              mass: 0.8
            }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
