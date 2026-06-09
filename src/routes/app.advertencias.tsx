import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, Plus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { listStudents } from "@/lib/students";
import {
  createDisciplinary,
  listDisciplinary,
  type DisciplinaryType,
} from "@/lib/disciplinary";

export const Route = createFileRoute("/app/advertencias")({
  component: () => (
    <AppShell title="Advertências">
      <SchoolGate>{({ schoolId }) => <Advertencias schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

const TYPE_LABEL: Record<DisciplinaryType, string> = {
  verbal: "Verbal",
  escrita: "Escrita",
  grave: "Grave",
};

const TYPE_COLOR: Record<DisciplinaryType, string> = {
  verbal: "bg-accent/15 text-accent-foreground border-accent/30",
  escrita: "bg-secondary/15 text-secondary-foreground border-secondary/30",
  grave: "bg-destructive/15 text-destructive border-destructive/30",
};

function Advertencias({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<DisciplinaryType>("verbal");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const listQ = useQuery({
    queryKey: ["disciplinary", schoolId],
    queryFn: () => listDisciplinary(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["all-students", schoolId],
    queryFn: () => listStudents(schoolId),
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const studentMap = useMemo(
    () => new Map((studentsQ.data ?? []).map((s) => [s.id, s])),
    [studentsQ.data],
  );

  const save = async () => {
    if (!firebaseUser) return;
    if (!studentId) {
      toast.error("Selecione um aluno.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Descreva a ocorrência (mín. 5 caracteres).");
      return;
    }
    const student = studentMap.get(studentId);
    if (!student) return;
    setSaving(true);
    try {
      await createDisciplinary(schoolId, {
        studentId,
        classId: student.classId,
        type,
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
        by: firebaseUser.uid,
      });
      toast.success("Advertência registrada.");
      setCreating(false);
      setStudentId("");
      setDescription("");
      setType("verbal");
      qc.invalidateQueries({ queryKey: ["disciplinary", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!creating && (
        <Button className="w-full" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Nova advertência
        </Button>
      )}

      {creating && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Nova advertência</h3>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Aluno</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Selecione...</option>
                {(studentsQ.data ?? []).map((s) => {
                  const cls = (classesQ.data ?? []).find((c) => c.id === s.classId);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} {cls ? `(${cls.name})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["verbal", "escrita", "grave"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`h-10 rounded-md border text-sm font-medium ${
                      type === t ? "border-primary bg-primary/10 text-primary" : "bg-card"
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que aconteceu..."
              />
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Registrar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {listQ.isLoading ? (
        <Loading />
      ) : (listQ.data ?? []).length === 0 ? (
        <EmptyState
          title="Sem advertências"
          description="Use o botão acima para registrar a primeira."
        />
      ) : (
        <div className="space-y-2">
          {listQ.data!.map((d) => {
            const s = studentMap.get(d.studentId);
            return (
              <Card key={d.id}>
                <CardContent className="pt-4 pb-4 flex gap-3">
                  <div className="size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                    <AlertOctagon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{s?.name ?? "Aluno"}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TYPE_COLOR[d.type]}`}
                      >
                        {TYPE_LABEL[d.type]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{d.date}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// Silence Input unused if necessary
void Input;
