import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/notas")({
  component: () => (
    <ComingSoon
      title="Notas"
      description="O lançamento de notas por bimestre e por avaliação estará disponível em breve."
    />
  ),
});
