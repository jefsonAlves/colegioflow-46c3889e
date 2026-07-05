import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Download, Send, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  buildAttentionReport,
  downloadCSV,
  reportToCSV,
  reportToText,
  type ReportPeriod,
} from "@/lib/attentionReport";
import { createAnnouncement } from "@/lib/announcements";
import { listClassTeachers } from "@/lib/classTeachers";

interface Props {
  schoolId: string;
  classId: string;
  className: string;
  bimester: number;
}

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "bimester", label: "Bimestre" },
  { id: "semester", label: "Semestre" },
  { id: "year", label: "Ano" },
];

export function NotasDashboard({ schoolId, classId, className, bimester }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>("bimester");
  const toastedRef = useRef<string | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  const reportQ = useQuery({
    queryKey: ["attention-report", schoolId, classId, bimester, period],
    queryFn: () => buildAttentionReport({ schoolId, classId, bimester, period }),
    staleTime: 30_000,
  });

  const teachersQ = useQuery({
    queryKey: ["class-teachers", classId],
    queryFn: () => listClassTeachers(classId),
    staleTime: 60_000,
  });

  const summary = useMemo(() => {
    const r = reportQ.data;
    if (!r) return { atRisk: 0, missingGrades: 0, lowGrade: 0, lowFreq: 0, freqNoGrade: 0 };
    let missingGrades = 0;
    let lowGrade = 0;
    let lowFreq = 0;
    for (const row of r.rows) {
      if (row.missingGrades > 0) missingGrades++;
      if (row.lowGrade) lowGrade++;
      if (row.attendancePct < 75) lowFreq++;
    }
    return {
      atRisk: r.totals.atRisk,
      missingGrades,
      lowGrade,
      lowFreq,
      freqNoGrade: r.totals.frequentWithoutGrade,
    };
  }, [reportQ.data]);

  const freqNoGradeRows = useMemo(
    () => (reportQ.data?.allRows ?? []).filter((r) => r.frequentWithoutGrade),
    [reportQ.data],
  );

  // Informative (non-blocking) toast the first time this class/bimester loads with issues.
  useEffect(() => {
    if (!reportQ.data) return;
    const key = `${classId}-${bimester}-${period}`;
    if (toastedRef.current === key) return;
    toastedRef.current = key;
    if (summary.freqNoGrade > 0) {
      toast.warning(
        `${summary.freqNoGrade} aluno(s) frequente(s) ainda sem nota neste bimestre`,
        {
          action: {
            label: "Ver",
            onClick: () =>
              focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
        },
      );
    }
  }, [reportQ.data, summary.freqNoGrade, classId, bimester, period]);

  const exportCSV = () => {
    if (!reportQ.data) return;
    downloadCSV(
      `atencao-${className.replace(/\s+/g, "_")}-b${bimester}-${period}.csv`,
      reportToCSV(reportQ.data),
    );
    toast.success("CSV baixado.");
  };

  const sendToAdmin = async () => {
    if (!reportQ.data) return;
    try {
      await createAnnouncement({
        schoolId,
        classId,
        audience: "teachers",
        targetRole: "school_admin",
        title: `Atenção · ${className} · Bim ${bimester}`,
        body: reportToText(reportQ.data),
      });
      toast.success("Enviado à secretaria/administração.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar.");
    }
  };

  const notifyTeachers = async () => {
    if (freqNoGradeRows.length === 0) return;
    const teachers = teachersQ.data ?? [];
    if (teachers.length === 0) {
      toast.error("Nenhum professor vinculado a esta turma.");
      return;
    }
    const body = [
      `Alunos frequentes sem nota lançada — ${className} (Bim ${bimester}):`,
      "",
      ...freqNoGradeRows.map(
        (r) => `• ${r.studentName} — falta: ${r.missingLabels.join(", ")}`,
      ),
    ].join("\n");
    try {
      await Promise.all(
        teachers.map((t) =>
          createAnnouncement({
            schoolId,
            classId,
            audience: "teachers",
            targetUserId: t.userId,
            title: `Verificar notas · ${className}`,
            body,
          }),
        ),
      );
      toast.success(`Notificado ${teachers.length} professor(es).`);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível notificar.");
    }
  };

  return (
    <Card className="border-primary/30" ref={focusRef}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <BellRing className="size-4 text-primary" /> Situação da turma
          </div>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`text-[10px] rounded-full px-2 py-1 font-medium border ${
                  period === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          <Stat label="Em atenção" value={summary.atRisk} tone="warn" icon={<Users className="size-3" />} />
          <Stat label="Sem notas" value={summary.missingGrades} tone="warn" />
          <Stat label="Nota baixa" value={summary.lowGrade} tone="destructive" />
          <Stat label="Freq. < 75%" value={summary.lowFreq} tone="destructive" />
          <Stat
            label="Freq. sem nota"
            value={summary.freqNoGrade}
            tone="warn"
            icon={<UserCheck className="size-3" />}
          />
        </div>

        {freqNoGradeRows.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wide flex items-center gap-1">
              <UserCheck className="size-3" /> Frequentes sem nota lançada
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {freqNoGradeRows.slice(0, 12).map((r) => (
                <div key={r.studentId} className="text-xs rounded-md bg-amber-500/10 px-2 py-1.5">
                  <div className="font-medium truncate">{r.studentName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Falta lançar: {r.missingLabels.join(", ")} · Frequência {r.attendancePct}%
                  </div>
                </div>
              ))}
              {freqNoGradeRows.length > 12 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  … e mais {freqNoGradeRows.length - 12}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={notifyTeachers}
              disabled={teachersQ.isLoading}
            >
              <Send className="size-3.5" /> Notificar professor(es) desta turma
            </Button>
          </div>
        )}

        {reportQ.data && reportQ.data.rows.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="size-3" /> Alunos em atenção
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {reportQ.data.rows.slice(0, 12).map((r) => (
                <div key={r.studentId} className="text-xs rounded-md bg-muted/40 px-2 py-1.5">
                  <div className="font-medium truncate">{r.studentName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.reasons.join(" · ")}
                  </div>
                </div>
              ))}
              {reportQ.data.rows.length > 12 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  … e mais {reportQ.data.rows.length - 12}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={exportCSV}
            disabled={!reportQ.data}
          >
            <Download className="size-3.5" /> Exportar CSV
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={sendToAdmin}
            disabled={!reportQ.data || reportQ.data.rows.length === 0}
          >
            <Send className="size-3.5" /> Enviar à secretaria
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function Stat({
  label,
  value,
  tone = "info",
  icon,
}: {
  label: string;
  value: number;
  tone?: "info" | "warn" | "destructive";
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warn"
        ? "bg-accent/30 text-accent-foreground"
        : "bg-primary/10 text-primary";
  return (
    <div className={`rounded-lg p-2 text-center ${cls}`}>
      <div className="text-lg font-bold leading-none flex items-center justify-center gap-1">
        {icon}
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
