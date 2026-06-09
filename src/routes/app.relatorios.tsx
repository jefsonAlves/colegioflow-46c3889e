import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Calendar, GraduationCap, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Loading } from "@/components/States";
import { listClasses } from "@/lib/classes";
import { listStudents } from "@/lib/students";
import { getClassAttendanceAll } from "@/lib/attendance";
import { getGrades } from "@/lib/grades";

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
