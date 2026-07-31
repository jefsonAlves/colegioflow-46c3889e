import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loading } from "@/components/States";
import { useActiveSchool } from "@/hooks/useActiveSchool";
import { listClasses } from "@/lib/classes";
import {
  absenceReportToCSV,
  buildAbsenceReport,
  periodRange,
  type AbsencePeriodKey,
} from "@/lib/absenceReport";
import { downloadCSV } from "@/lib/attentionReport";
import { generateAbsenceReportPDF } from "@/lib/pdf/faltosos";

interface Props {
  schoolId: string;
  /** Pré-seleciona uma turma (ex.: a turma aberta na chamada). */
  defaultClassId?: string | null;
  /** Restringe as turmas listadas no filtro. */
  classOptions?: { id: string; name: string }[];
  title?: string;
}

export function AbsenceReportSection({
  schoolId,
  defaultClassId = null,
  classOptions,
  title = "Alunos faltosos",
}: Props) {
  const { school } = useActiveSchool();
  const [period, setPeriod] = useState<AbsencePeriodKey>("month");
  const [classId, setClassId] = useState<string>(defaultClassId ?? "all");
  const [minAbsences, setMinAbsences] = useState(1);
  const initial = periodRange("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  useEffect(() => {
    if (defaultClassId) setClassId(defaultClassId);
  }, [defaultClassId]);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
    enabled: !classOptions,
  });
  const classes = classOptions ?? classesQ.data ?? [];

  const range = useMemo(
    () => (period === "custom" ? { from, to } : periodRange(period)),
    [period, from, to],
  );

  const reportQ = useQuery({
    queryKey: ["absence-report", schoolId, range.from, range.to, classId, minAbsences],
    queryFn: () =>
      buildAbsenceReport({
        schoolId,
        from: range.from,
        to: range.to,
        classId: classId === "all" ? null : classId,
        minAbsences,
        schoolName: school?.name,
      }),
  });

  const report = reportQ.data;
  const className =
    classId === "all" ? "Todas" : classes.find((c) => c.id === classId)?.name ?? "Turma";

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="abs-period">Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as AbsencePeriodKey)}>
                <SelectTrigger id="abs-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="bimester">Bimestre</SelectItem>
                  <SelectItem value="semester">Semestre</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                  <SelectItem value="custom">Datas personalizadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="abs-class">Turma</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="abs-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {period === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="abs-from">De</Label>
                <Input
                  id="abs-from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="abs-to">Até</Label>
                <Input
                  id="abs-to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="abs-min">Mínimo de faltas</Label>
            <Input
              id="abs-min"
              type="number"
              min={1}
              value={minAbsences}
              onChange={(e) => setMinAbsences(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="flex-1 min-w-[140px]"
              disabled={!report || report.rows.length === 0}
              onClick={() => report && generateAbsenceReportPDF(report, className)}
            >
              <FileText className="size-4" /> Baixar PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!report || report.rows.length === 0}
              onClick={() =>
                report &&
                downloadCSV(`faltosos-${report.from}-a-${report.to}.csv`, absenceReportToCSV(report))
              }
            >
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportQ.isLoading ? (
        <Loading />
      ) : !report || report.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum aluno com faltas no período selecionado.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {report.totals.flagged} aluno(s) · {report.totals.absences} falta(s) no período
          </p>
          {report.rows.map((r) => (
            <Card key={`${r.studentId}:${r.classId}`}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.studentName}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.className} · {r.days} dia(s) registrado(s)
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-destructive">{r.absences} falta(s)</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.justified} just. · {r.attendancePct}% freq.
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
