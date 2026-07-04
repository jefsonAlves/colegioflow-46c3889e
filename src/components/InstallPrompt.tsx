import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cem.installPrompt.dismissedAt";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS
  return (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    if (isIOS()) {
      const t = window.setTimeout(() => setShowIOS(true), 4000);
      return () => window.clearTimeout(t);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setEvt(null);
    setShowIOS(false);
  };

  if (!evt && !showIOS) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 px-4 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto rounded-xl border bg-card shadow-lg p-3 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-2">
          <Download className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Instalar Colégio em Movimento</div>
          <div className="text-xs text-muted-foreground truncate">
            {evt
              ? "Use como app no seu celular ou computador."
              : "No Safari: toque em Compartilhar → Adicionar à Tela de Início."}
          </div>
        </div>
        {evt && (
          <Button
            size="sm"
            onClick={async () => {
              try {
                await evt.prompt();
                await evt.userChoice;
              } finally {
                setEvt(null);
              }
            }}
          >
            Instalar
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Fechar" onClick={dismiss}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
