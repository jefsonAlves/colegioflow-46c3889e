import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/turmas")({
  component: () => (
    <ComingSoon
      title="Turmas"
      description="Adicionar turmas, vincular alunos e organizar disciplinas estará disponível em breve."
    />
  ),
});
