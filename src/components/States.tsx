import { Loader2 } from "lucide-react";

export function Loading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10 px-4">
      <div className="size-14 rounded-full bg-muted flex items-center justify-center text-2xl">
        📭
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-10">
      <div className="text-3xl">⚠️</div>
      <p className="text-sm text-muted-foreground">{message ?? "Algo deu errado."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-primary font-medium hover:underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
