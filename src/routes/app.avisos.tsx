import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/avisos")({
  component: () => (
    <ComingSoon
      title="Avisos"
      description="Comunicados da escola e das turmas estará disponível em breve."
    />
  ),
});
