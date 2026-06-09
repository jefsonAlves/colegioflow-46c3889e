import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  NotebookPen,
  Users,
  FileText,
  AlertOctagon,
  BarChart3,
  Megaphone,
  Building2,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

interface Action {
  to: "/app/frequencia" | "/app/notas" | "/app/turmas" | "/app/boletim" | "/app/advertencias" | "/app/relatorios";
  label: string;
  description: string;
  icon: LucideIcon;
  accent: "primary" | "secondary" | "accent";
}

const ACTIONS: Action[] = [
  { to: "/app/frequencia", label: "Frequência", description: "Fazer chamada", icon: ClipboardCheck, accent: "primary" },
  { to: "/app/notas", label: "Notas", description: "Lançar notas", icon: NotebookPen, accent: "secondary" },
  { to: "/app/turmas", label: "Turmas", description: "Adicionar e gerenciar", icon: Users, accent: "primary" },
  { to: "/app/boletim", label: "Boletim", description: "Fechamento do bimestre", icon: FileText, accent: "secondary" },
  { to: "/app/advertencias", label: "Advertências", description: "Registrar ocorrências", icon: AlertOctagon, accent: "accent" },
  { to: "/app/relatorios", label: "Relatórios", description: "Desempenho dos alunos", icon: BarChart3, accent: "primary" },
];

function accentClasses(a: Action["accent"]) {
  switch (a) {
    case "secondary":
      return "bg-secondary/15 text-secondary-foreground border-secondary/30";
    case "accent":
      return "bg-accent/15 text-accent-foreground border-accent/30";
    default:
      return "bg-primary/10 text-primary border-primary/20";
  }
}

function AppHome() {
  const { userDoc } = useAuth();
  if (!userDoc) return null;

  const firstName = userDoc.name?.split(" ")[0] ?? "";

  return (
    <AppShell title={`Olá, ${firstName}`} back={false}>
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {userDoc.profileType === "school_admin"
            ? "Painel da escola"
            : userDoc.profileType === "parent"
              ? "Acompanhamento escolar"
              : "Painel do professor"}
        </p>
        <h2 className="text-xl font-bold">O que você quer fazer hoje?</h2>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className="group">
              <Card className="h-full transition active:scale-[0.98] hover:border-primary/40">
                <CardContent className="pt-5 pb-4 flex flex-col gap-2 items-start min-h-[124px]">
                  <div className={`size-11 rounded-xl border flex items-center justify-center ${accentClasses(a.accent)}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-semibold leading-tight">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.description}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="space-y-2">
        <Link to="/app/avisos">
          <Card className="transition active:scale-[0.99]">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="size-10 rounded-lg bg-accent/15 text-accent-foreground flex items-center justify-center">
                <Megaphone className="size-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Avisos</div>
                <div className="text-xs text-muted-foreground">Comunicados da escola e turmas</div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {userDoc.profileType === "school_admin" && (
          <Link to="/app/escola">
            <Card className="transition active:scale-[0.99]">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Minha escola</div>
                  <div className="text-xs text-muted-foreground">
                    Aprovar professores, configurar dados
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        )}
      </section>
    </AppShell>
  );
}
