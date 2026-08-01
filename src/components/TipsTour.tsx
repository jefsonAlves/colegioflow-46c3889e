import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ChevronLeft, ChevronRight, X, Lightbulb } from "lucide-react";

/** Bump this when new tips are published — everyone sees the tour again. */
export const TIPS_VERSION = "2026-08-01";
const STORAGE_KEY = `tips-tour:${TIPS_VERSION}`;

export interface Tip {
  title: string;
  body: string;
  badge?: string;
}

const TEACHER_TIPS: Tip[] = [
  {
    badge: "Novo",
    title: "Alunos compartilhados na turma",
    body: "Professores da mesma escola que dão aula para a mesma turma usam a mesma lista de alunos. Ao adicionar nomes, o sistema avisa quem já existe e você pode reaproveitar em vez de duplicar.",
  },
  {
    badge: "Novo",
    title: "Seu plano fica visível",
    body: "Em Minha escola você acompanha o plano da escola, quantos funcionários e alunos estão cadastrados e quais recursos estão liberados.",
  },
  {
    title: "Comece pela próxima aula",
    body: "Na Home, o card da próxima aula mostra o horário e leva direto para a chamada da turma do dia.",
  },
  {
    title: "Notas como um diário",
    body: "Em Notas você renomeia as colunas (P1, P2, Ativ.), define peso e nota máxima e adiciona quantas colunas quiser.",
  },
  {
    title: "Relatórios em segundos",
    body: "Na Frequência, a aba Faltosos gera o relatório em PDF ou CSV com o período que você escolher.",
  },
];

const ADMIN_TIPS: Tip[] = [
  {
    badge: "Novo",
    title: "Painel da escola",
    body: "Veja quantos funcionários estão vinculados, quantos alunos cadastrados e o uso em relação ao limite do plano.",
  },
  {
    badge: "Novo",
    title: "Funcionários e permissões",
    body: "A lista de funcionários mostra função e situação de cada um. Aprove ou recuse solicitações na própria tela.",
  },
  {
    title: "Atestados justificam faltas",
    body: "Ao registrar um atestado, as faltas do período são justificadas automaticamente na frequência.",
  },
];

const MASTER_TIPS: Tip[] = [
  {
    badge: "Novo",
    title: "Acompanhamento por escola",
    body: "No Painel Master você vê funcionários, professores, turmas e alunos de cada escola, com o uso frente aos limites.",
  },
  {
    badge: "Novo",
    title: "Controle de plano",
    body: "Defina plano, situação, validade e limites de cada escola. Recursos são liberados ou limitados conforme o plano.",
  },
];

export function tipsFor(audience: "teacher" | "school_admin" | "master"): Tip[] {
  if (audience === "master") return [...MASTER_TIPS, ...ADMIN_TIPS, ...TEACHER_TIPS];
  if (audience === "school_admin") return [...ADMIN_TIPS, ...TEACHER_TIPS];
  return TEACHER_TIPS;
}

export function TipsTour({ audience }: { audience: "teacher" | "school_admin" | "master" }) {
  const tips = tipsFor(audience);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* storage indisponível */
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="w-full flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition"
      >
        <Lightbulb className="size-3.5" aria-hidden />
        Ver dicas e novidades do sistema
      </button>
    );
  }

  const tip = tips[step];
  const last = step === tips.length - 1;

  return (
    <Card className="border-primary/30 bg-primary/5" role="region" aria-label="Dicas e novidades">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-5 text-primary mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {tip.badge && <Badge className="text-[11px]">{tip.badge}</Badge>}
              <h3 className="font-semibold text-sm">{tip.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{tip.body}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Fechar dicas">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1" aria-hidden>
            {tips.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-primary/20"}`}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label="Dica anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          {last ? (
            <Button size="sm" onClick={dismiss}>
              Entendi
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} aria-label="Próxima dica">
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
