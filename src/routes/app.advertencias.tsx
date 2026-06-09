import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/app/advertencias")({
  component: () => (
    <ComingSoon
      title="Advertências"
      description="Registrar ocorrências, advertências e comunicar a família estará disponível em breve."
    />
  ),
});
