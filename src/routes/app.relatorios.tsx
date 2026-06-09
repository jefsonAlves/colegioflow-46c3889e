import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <ComingSoon
      title="Relatórios"
      description="Relatórios de desempenho, frequência e turmas estará disponível em breve."
    />
  ),
});
