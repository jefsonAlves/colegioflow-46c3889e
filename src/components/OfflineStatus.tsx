import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { pendingCount, subscribeQueueSize } from "@/lib/offlineQueue";

export function OfflineStatus() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    pendingCount().then(setPending);
    const unsub = subscribeQueueSize(setPending);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      unsub();
    };
  }, []);

  if (online && pending === 0) return null;
  return (
    <div className="fixed top-2 inset-x-0 z-40 flex justify-center pointer-events-none">
      <div
        className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-medium shadow-md flex items-center gap-1.5 ${
          online ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border"
        }`}
      >
        {online ? <RefreshCw className="size-3" /> : <CloudOff className="size-3" />}
        {online
          ? `Sincronizando ${pending} alteração(ões)`
          : pending > 0
            ? `Sem internet · ${pending} alteração(ões) na fila`
            : "Sem internet · modo offline"}
      </div>
    </div>
  );
}
