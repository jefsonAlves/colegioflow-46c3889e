import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Check, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { listStudentsByClass } from "@/lib/students";
import { getAttendance, setAttendance, type AttendanceStatus } from "@/lib/attendance";

export const Route = createFileRoute("/app/frequencia")({
  component: () => (
    <AppShell title="Frequência">
      <SchoolGate>{({ schoolId }) => <Frequencia schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Frequencia({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId!),
    enabled: !!classId,
  });

  const attendanceQ = useQuery({
    queryKey: ["attendance", schoolId, classId, date],
    queryFn: () => getAttendance(schoolId, classId!, date),
    enabled: !!classId,
  });

  useEffect(() => {
    if (attendanceQ.data) {
      const next: Record<string, AttendanceStatus> = {};
      for (const [uid, v] of Object.entries(attendanceQ.data)) next[uid] = v.status;
      setMarks(next);
    } else if (studentsQ.data) {
      // Default to Presente for unmarked
      const next: Record<string, AttendanceStatus> = {};
      for (const s of studentsQ.data) next[s.id] = "P";
      setMarks(next);
    }
  }, [attendanceQ.data, studentsQ.data]);

  const save = async () => {
    if (!classId || !firebaseUser) return;
    setSaving(true);
    try {
      const now = Date.now();
      const payload = Object.fromEntries(
        Object.entries(marks).map(([uid, s]) => [uid, { status: s, by: firebaseUser.uid, at: now }]),
      );
      await setAttendance(schoolId, classId, date, payload);
      toast.success("Chamada salva!");
      qc.invalidateQueries({ queryKey: ["attendance", schoolId, classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar chamada.");
    } finally {
      setSaving(false);
    }
  };

  if (classesQ.isLoading) return <Loading />;
  const classes = classesQ.data ?? [];
  if (classes.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma para fazer chamada." />;
  }

  return (
    <>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="space-y-1.5">
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
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <div className="relative">
              <Calendar className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" className="pl-9" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {classId && (
        <>
          {studentsQ.isLoading ? (
            <Loading />
          ) : (studentsQ.data ?? []).length === 0 ? (
            <EmptyState title="Sem alunos" description="Adicione alunos a esta turma em Turmas." />
          ) : (
            <div className="space-y-2">
              {studentsQ.data!.map((s, i) => {
                const status = marks[s.id] ?? "P";
                return (
                  <div key={s.id} className="rounded-xl border bg-card p-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                    <span className="flex-1 font-medium text-sm truncate">{s.name}</span>
                    {(["P", "F", "J"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: opt }))}
                        className={`size-9 rounded-lg text-xs font-bold border ${
                          status === opt
                            ? opt === "P"
                              ? "bg-secondary text-secondary-foreground border-secondary"
                              : opt === "F"
                                ? "bg-destructive text-destructive-foreground border-destructive"
                                : "bg-accent text-accent-foreground border-accent"
                            : "bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                );
              })}

              <Button className="w-full h-12" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : (
                  <>
                    <Save className="size-4" /> Salvar chamada
                  </>
                )}
              </Button>

              {attendanceQ.data && Object.keys(attendanceQ.data).length > 0 && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Check className="size-3" /> Já existe chamada para este dia (você pode editar e salvar de novo).
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
