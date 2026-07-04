import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { listStudentsByClass } from "@/lib/students";
import { calcMedia, getGrades, setStudentGrade, type GradeEntry } from "@/lib/grades";
import {
  createAssessmentType,
  deleteAssessmentType,
  listAssessmentTypes,
} from "@/lib/assessmentTypes";

export const Route = createFileRoute("/app/notas")({
  component: () => (
    <AppShell title="Notas">
      <SchoolGate>{({ schoolId }) => <Notas schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

type Row = { p1: string; p2: string; atividade: string };

function toNum(s: string): number | null {
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function Notas({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string | null>(null);
  const [bimestre, setBimestre] = useState<number>(1);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId!),
    enabled: !!classId,
  });
  const gradesQ = useQuery({
    queryKey: ["grades", schoolId, classId, bimestre],
    queryFn: () => getGrades(schoolId, classId!, bimestre),
    enabled: !!classId,
  });

  useEffect(() => {
    if (!studentsQ.data) return;
    const next: Record<string, Row> = {};
    for (const s of studentsQ.data) {
      const g = gradesQ.data?.[s.id] ?? {};
      next[s.id] = {
        p1: g.p1 == null ? "" : String(g.p1),
        p2: g.p2 == null ? "" : String(g.p2),
        atividade: g.atividade == null ? "" : String(g.atividade),
      };
    }
    setRows(next);
  }, [studentsQ.data, gradesQ.data]);

  const saveRow = async (studentId: string) => {
    if (!classId || !firebaseUser) return;
    setSavingId(studentId);
    try {
      const r = rows[studentId];
      const entry: GradeEntry = {
        p1: toNum(r.p1),
        p2: toNum(r.p2),
        atividade: toNum(r.atividade),
        by: firebaseUser.uid,
      };
      await setStudentGrade(schoolId, classId, bimestre, studentId, entry);
      toast.success("Nota salva.");
      qc.invalidateQueries({ queryKey: ["grades", schoolId, classId, bimestre] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  if (classesQ.isLoading) return <Loading />;
  const classes = classesQ.data ?? [];
  if (classes.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma para lançar notas." />;
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
            <Label>Bimestre</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((b) => (
                <button
                  key={b}
                  onClick={() => setBimestre(b)}
                  className={`h-10 rounded-md border text-sm font-medium ${
                    bimestre === b ? "bg-primary text-primary-foreground border-primary" : "bg-card"
                  }`}
                >
                  {b}º
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {classId && (
        <>
          <AssessmentTypesPanel schoolId={schoolId} classId={classId} bimester={bimestre} />

          {studentsQ.isLoading ? (
            <Loading />
          ) : (studentsQ.data ?? []).length === 0 ? (
            <EmptyState title="Sem alunos" />
          ) : (
            <div className="space-y-2">
              {studentsQ.data!.map((s) => {
                const r = rows[s.id] ?? { p1: "", p2: "", atividade: "" };
                const media = calcMedia({
                  p1: toNum(r.p1) ?? undefined,
                  p2: toNum(r.p2) ?? undefined,
                  atividade: toNum(r.atividade) ?? undefined,
                });
                return (
                  <Card key={s.id}>
                    <CardContent className="pt-4 pb-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm truncate flex-1">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Média:{" "}
                          <span
                            className={`font-bold ${
                              media >= 6 ? "text-secondary-foreground" : "text-destructive"
                            }`}
                          >
                            {media.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["p1", "p2", "atividade"] as const).map((k) => (
                          <div key={k}>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                              {k === "atividade" ? "Ativ." : k.toUpperCase()}
                            </div>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              max={10}
                              value={r[k]}
                              onChange={(e) =>
                                setRows((x) => ({
                                  ...x,
                                  [s.id]: { ...r, [k]: e.target.value },
                                }))
                              }
                              className="h-9"
                            />
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => saveRow(s.id)}
                        disabled={savingId === s.id}
                      >
                        <Save className="size-3.5" />
                        {savingId === s.id ? "Salvando..." : "Salvar"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

function AssessmentTypesPanel({
  schoolId,
  classId,
  bimester,
}: {
  schoolId: string;
  classId: string;
  bimester: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(1);
  const [scope, setScope] = useState<"class" | "all">("class");

  const typesQ = useQuery({
    queryKey: ["assessment-types", schoolId, classId, bimester],
    queryFn: () => listAssessmentTypes(schoolId, classId, bimester),
  });

  const save = async () => {
    if (!name.trim()) { toast.error("Dê um nome à avaliação."); return; }
    try {
      await createAssessmentType({
        schoolId,
        classId: scope === "all" ? null : classId,
        name,
        weight,
        bimester,
      });
      toast.success(scope === "all" ? "Aplicado em todas as suas turmas." : "Avaliação adicionada.");
      setName(""); setWeight(1); setScope("class"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["assessment-types"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao adicionar.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover avaliação?")) return;
    try {
      await deleteAssessmentType(id);
      qc.invalidateQueries({ queryKey: ["assessment-types"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover.");
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Avaliações do bimestre</div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Mais
          </Button>
        </div>
        {(typesQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma avaliação personalizada. Você usa P1, P2 e Atividade por padrão. Toque em "Mais"
            para adicionar (ex: Trabalho, Prova extra).
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {typesQ.data!.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium"
              >
                {t.name} <span className="opacity-60">×{t.weight}</span>
                <button onClick={() => remove(t.id)} className="hover:opacity-70">
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova avaliação</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Trabalho de Ciências" />
              </div>
              <div>
                <Label>Peso</Label>
                <Input type="number" step="0.5" min={0.5} value={weight}
                  onChange={(e) => setWeight(Number(e.target.value) || 1)} />
              </div>
              <div>
                <Label>Aplicar em</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setScope("class")}
                    className={`h-10 rounded-md border text-sm ${scope === "class" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                  >
                    Só esta turma
                  </button>
                  <button
                    onClick={() => setScope("all")}
                    className={`h-10 rounded-md border text-sm ${scope === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                  >
                    Todas as minhas turmas
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
