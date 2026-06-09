import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { listClasses } from "@/lib/classes";
import { listStudentsByClass } from "@/lib/students";
import { getStudentAllBimesters } from "@/lib/grades";
import { getClassAttendanceAll } from "@/lib/attendance";

export const Route = createFileRoute("/app/boletim")({
  component: () => (
    <AppShell title="Boletim">
      <SchoolGate>{({ schoolId }) => <Boletim schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

function Boletim({ schoolId }: { schoolId: string }) {
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId!),
    enabled: !!classId,
  });

  if (classesQ.isLoading) return <Loading />;
  const classes = classesQ.data ?? [];
  if (classes.length === 0)
    return <EmptyState title="Nenhuma turma" description="Crie turmas para gerar boletins." />;

  if (studentId && classId) {
    return (
      <StudentBoletim
        schoolId={schoolId}
        classId={classId}
        studentId={studentId}
        studentName={
          (studentsQ.data ?? []).find((s) => s.id === studentId)?.name ?? "Aluno"
        }
        onBack={() => setStudentId(null)}
      />
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-5 space-y-2">
          <Label>Turma</Label>
          <select
            className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={classId ?? ""}
            onChange={(e) => setClassId(e.target.value || null)}
          >
            <option value="">Selecione...</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.year})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {classId && (
        <>
          {studentsQ.isLoading ? (
            <Loading />
          ) : (studentsQ.data ?? []).length === 0 ? (
            <EmptyState title="Sem alunos" />
          ) : (
            <div className="space-y-2">
              {studentsQ.data!.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className="w-full text-left rounded-xl border bg-card p-3 active:scale-[0.99]"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">Ver boletim</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function StudentBoletim({
  schoolId,
  classId,
  studentId,
  studentName,
  onBack,
}: {
  schoolId: string;
  classId: string;
  studentId: string;
  studentName: string;
  onBack: () => void;
}) {
  const gradesQ = useQuery({
    queryKey: ["boletim-grades", schoolId, classId, studentId],
    queryFn: () => getStudentAllBimesters(schoolId, classId, studentId),
  });
  const attQ = useQuery({
    queryKey: ["attendance-all", schoolId, classId],
    queryFn: () => getClassAttendanceAll(schoolId, classId),
  });

  if (gradesQ.isLoading || attQ.isLoading) return <Loading />;

  const grades = gradesQ.data ?? {};
  const att = attQ.data ?? {};
  const totalDays = Object.keys(att).length;
  let present = 0;
  for (const day of Object.values(att)) {
    const entry = day[studentId];
    if (entry?.status === "P" || entry?.status === "J") present++;
  }
  const freq = totalDays === 0 ? 0 : Math.round((present / totalDays) * 100);

  const allMedias = [1, 2, 3, 4].map((b) => grades[b]?.media);
  const valid = allMedias.filter((m): m is number => typeof m === "number");
  const mediaFinal =
    valid.length === 0 ? 0 : Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;

  return (
    <>
      <Button variant="ghost" onClick={onBack} className="self-start">
        <ArrowLeft className="size-4" /> Voltar
      </Button>
      <Card>
        <CardContent className="pt-5 space-y-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Aluno</div>
          <div className="text-xl font-bold">{studentName}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-3">Notas por bimestre</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 pr-2">Bim.</th>
                  <th className="py-2 px-2">P1</th>
                  <th className="py-2 px-2">P2</th>
                  <th className="py-2 px-2">Ativ.</th>
                  <th className="text-right py-2 pl-2">Média</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((b) => {
                  const g = grades[b];
                  return (
                    <tr key={b} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{b}º</td>
                      <td className="py-2 px-2 text-center">{g?.p1 ?? "—"}</td>
                      <td className="py-2 px-2 text-center">{g?.p2 ?? "—"}</td>
                      <td className="py-2 px-2 text-center">{g?.atividade ?? "—"}</td>
                      <td
                        className={`py-2 pl-2 text-right font-bold ${
                          (g?.media ?? 0) >= 6 ? "" : "text-destructive"
                        }`}
                      >
                        {g?.media != null ? g.media.toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-xs text-muted-foreground">Média final</div>
            <div
              className={`text-2xl font-bold ${mediaFinal >= 6 ? "text-primary" : "text-destructive"}`}
            >
              {mediaFinal.toFixed(1)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5 text-center">
            <div className="text-xs text-muted-foreground">Frequência</div>
            <div
              className={`text-2xl font-bold ${freq >= 75 ? "text-primary" : "text-destructive"}`}
            >
              {freq}%
            </div>
            <div className="text-[10px] text-muted-foreground">{totalDays} dia(s)</div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
