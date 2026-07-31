import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, Download, FileText, GraduationCap, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
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
import { listStudents } from "@/lib/students";
import { getClassAttendanceAll } from "@/lib/attendance";
import { getGrades } from "@/lib/grades";
import {
  absenceReportToCSV,
  buildAbsenceReport,
  periodRange,
  type AbsencePeriodKey,
} from "@/lib/absenceReport";
import { downloadCSV } from "@/lib/attentionReport";
import { generateAbsenceReportPDF } from "@/lib/pdf/faltosos";


export const Route = createFileRoute("/app/relatorios")({
  component: () => (
    <AppShell title="Relatórios">
      <SchoolGate>{({ schoolId }) => <Relatorios schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Relatorios({ schoolId }: { schoolId: string }) {
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["all-students", schoolId],
    queryFn: () => listStudents(schoolId),
  });

  const summariesQ = useQuery({
    queryKey: ["report-summaries", schoolId, classesQ.data?.map((c) => c.id).join(",")],
    enabled: !!classesQ.data,
    queryFn: async () => {
      const classes = classesQ.data ?? [];
      const month = thisMonth();
      const out: { classId: string; name: string; freq: number; media: number; alunos: number }[] = [];
      for (const c of classes) {
        // Attendance %
        const att = await getClassAttendanceAll(schoolId, c.id);
        const daysOfMonth = Object.entries(att).filter(([d]) => d.startsWith(month));
        let totalMarks = 0;
        let present = 0;
        for (const [, entries] of daysOfMonth) {
          for (const e of Object.values(entries)) {
            totalMarks++;
            if (e.status === "P" || e.status === "J") present++;
          }
        }
        const freq = totalMarks === 0 ? 0 : Math.round((present / totalMarks) * 100);

        // Average across all 4 bimesters
        let sum = 0;
        let count = 0;
        for (const b of [1, 2, 3, 4]) {
          const grades = await getGrades(schoolId, c.id, b);
          for (const g of Object.values(grades)) {
            if (typeof g.media === "number") {
              sum += g.media;
              count++;
            }
          }
        }
        const media = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;

        const alunos = (studentsQ.data ?? []).filter(
          (s) => s.classId === c.id && s.active !== false,
        ).length;

        out.push({ classId: c.id, name: c.name, freq, media, alunos });
      }
      return out;
    },
  });

  if (classesQ.isLoading || studentsQ.isLoading) return <Loading />;
  const summaries = summariesQ.data ?? [];

  const totalClasses = (classesQ.data ?? []).length;
  const totalStudents = (studentsQ.data ?? []).filter((s) => s.active !== false).length;
  const avgFreq =
    summaries.length === 0
      ? 0
      : Math.round(summaries.reduce((a, b) => a + b.freq, 0) / summaries.length);
  const avgGrade =
    summaries.length === 0
      ? 0
      : Math.round((summaries.reduce((a, b) => a + b.media, 0) / summaries.length) * 10) / 10;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={BookOpen} label="Turmas" value={String(totalClasses)} />
        <Stat icon={Users} label="Alunos" value={String(totalStudents)} />
        <Stat icon={Calendar} label="Frequência mês" value={`${avgFreq}%`} />
        <Stat icon={GraduationCap} label="Média geral" value={avgGrade.toFixed(1)} />
      </div>

      <AbsenceReportSection schoolId={schoolId} />



      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Por turma
        </h2>
        {summariesQ.isLoading ? (
          <Loading />
        ) : summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma turma para resumir.</p>
        ) : (
          <div className="space-y-2">
            {summaries.map((s) => (
              <Card key={s.classId}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.alunos} aluno(s)</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        Frequência (mês)
                      </div>
                      <div
                        className={`font-bold ${s.freq >= 75 ? "text-primary" : "text-destructive"}`}
                      >
                        {s.freq}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Média geral</div>
                      <div
                        className={`font-bold ${s.media >= 6 ? "text-primary" : "text-destructive"}`}
                      >
                        {s.media.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AbsenceReportSection({ schoolId }: { schoolId: string }) {
  const { school } = useActiveSchool();
  const [period, setPeriod] = useState<AbsencePeriodKey>("month");
  const [classId, setClassId] = useState<string>("all");
  const [minAbsences, setMinAbsences] = useState(1);
  const initial = periodRange("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

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
    classId === "all"
      ? "Todas"
      : (classesQ.data ?? []).find((c) => c.id === classId)?.name ?? "Turma";

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Alunos faltosos
      </h2>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Período</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as AbsencePeriodKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="bimester">Bimestre</SelectItem>
                  <SelectItem value="semester">Semestre</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Turma</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as turmas</SelectItem>
                  {(classesQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Mínimo de faltas</Label>
            <Input
              type="number"
              min={1}
              value={minAbsences}
              onChange={(e) => setMinAbsences(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
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


function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <Icon className="size-5 text-primary mb-1" />
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
