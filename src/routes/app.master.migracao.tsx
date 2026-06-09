import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/master/migracao")({
  component: () => (
    <ComingSoon
      title="Migração"
      description="A migração de dados legados do Firebase foi concluída. Esta tela ficará para futuras importações."
    />
  ),
});
