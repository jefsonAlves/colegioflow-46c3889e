import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/boletim")({
  component: () => (
    <ComingSoon
      title="Boletim"
      description="O fechamento do bimestre e a geração de boletins estará disponível em breve."
    />
  ),
});
