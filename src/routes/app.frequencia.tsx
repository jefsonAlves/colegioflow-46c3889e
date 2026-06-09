import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/frequencia")({
  component: () => (
    <ComingSoon
      title="Frequência"
      description="A chamada digital com presença, falta e justificativa estará disponível em breve."
    />
  ),
});
