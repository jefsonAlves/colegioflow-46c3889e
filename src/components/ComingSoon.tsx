import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Construction, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: Props) {
  const router = useRouter();
  return (
    <AppShell title={title}>
      <Card>
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Construction className="size-7" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold text-lg">{title} — em construção</h2>
            <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
          </div>
          <Button variant="outline" onClick={() => router.history.back()}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

// Dummy route export so this file is ignored by file-based routing
// (placed under components instead would be cleaner; keeping here is harmless)
export const Route = createFileRoute("/app/_coming-soon-helper" as never)({
  component: () => null,
});
