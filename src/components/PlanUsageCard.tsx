import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Users, GraduationCap, CalendarClock } from "lucide-react";
import {
  FEATURES,
  PLAN_LABEL,
  PLAN_STATUS_LABEL,
  isFeatureEnabled,
  usageRatio,
  usageTone,
} from "@/lib/plans";
import type { PlanKey, PlanStatus } from "@/lib/plans";

interface Props {
  plan: PlanKey;
  planStatus: PlanStatus;
  planExpiresAt: string | null;
  staffCount: number;
  maxStaff: number;
  studentCount: number;
  maxStudents: number;
  classCount: number;
  pendingCount?: number;
  compact?: boolean;
}

function toneClass(tone: "ok" | "warn" | "over") {
  if (tone === "over") return "text-destructive";
  if (tone === "warn") return "text-secondary-foreground";
  return "text-muted-foreground";
}

function UsageBar({ label, used, limit, icon: Icon }: { label: string; used: number; limit: number; icon: typeof Users }) {
  const ratio = usageRatio(used, limit);
  const tone = usageTone(ratio);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="flex-1">{label}</span>
        <span className={`font-medium ${toneClass(tone)}`}>
          {used} / {limit}
        </span>
      </div>
      <Progress value={ratio * 100} aria-label={`${label}: ${used} de ${limit}`} />
      {tone !== "ok" && (
        <p className={`text-[11px] ${toneClass(tone)}`}>
          {tone === "over" ? "Limite do plano atingido." : "Perto do limite do plano."}
        </p>
      )}
    </div>
  );
}

export function PlanUsageCard({
  plan,
  planStatus,
  planExpiresAt,
  staffCount,
  maxStaff,
  studentCount,
  maxStudents,
  classCount,
  pendingCount = 0,
  compact = false,
}: Props) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={planStatus === "suspended" ? "destructive" : "default"}>
            Plano {PLAN_LABEL[plan]}
          </Badge>
          <Badge variant="outline">{PLAN_STATUS_LABEL[planStatus]}</Badge>
          {planExpiresAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden />
              até {new Date(`${planExpiresAt}T00:00:00`).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <UsageBar label="Funcionários vinculados" used={staffCount} limit={maxStaff} icon={Users} />
          <UsageBar label="Alunos cadastrados" used={studentCount} limit={maxStudents} icon={GraduationCap} />
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{classCount} turma(s)</span>
          {pendingCount > 0 && <span>{pendingCount} solicitação(ões) pendente(s)</span>}
        </div>

        {!compact && (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {FEATURES.map((f) => {
              const on = isFeatureEnabled(plan, planStatus, f.key);
              return (
                <li key={f.key} className="flex items-start gap-2 text-xs">
                  {on ? (
                    <Check className="size-3.5 mt-0.5 text-primary shrink-0" aria-hidden />
                  ) : (
                    <Lock className="size-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
                  )}
                  <span className={on ? "" : "text-muted-foreground"}>
                    <span className="font-medium">{f.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {on ? f.description : `Disponível no plano ${PLAN_LABEL[f.minPlan]}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
