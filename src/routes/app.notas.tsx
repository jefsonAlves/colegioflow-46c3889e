import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Save } from "lucide-react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, EmptyState } from "@/components/States";
import { useActiveSchool } from "@/hooks/useActiveSchool";
import { listClasses } from "@/lib/classes";
import { listStudentsByClass } from "@/lib/students";
import {
  calcWeightedMedia,
  getClassGradeMap,
  setStudentGradeMap,
  type GradeMap,
} from "@/lib/grades";
import { ensureAssessmentTypes, type AssessmentType } from "@/lib/assessmentTypes";
import { sanitizeGrade } from "@/lib/gradeSanitize";
import { NotasDashboard } from "@/components/NotasDashboard";
import { GradeColumnsPanel } from "@/components/GradeColumnsPanel";
import { matchesInitial, StudentSearchInput } from "@/components/StudentSearchInput";

export const Route = createFileRoute("/app/notas")({
  component: () => (
    <AppShell title="Notas">
      <SchoolGate>{({ schoolId }) => <Notas schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

type RowDraft = Record<string, string>; // subjectKey -> typed text

function Notas({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const { membership } = useActiveSchool();
  const [classId, setClassId] = useState<string | null>(null);
  const [bimestre, setBimestre] = useState<number>(1);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const dirtyIds = useMemo(() => Object.keys(dirty).filter((id) => dirty[id]), [dirty]);
  useUnsavedChanges(dirtyIds.length > 0);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId!),
    enabled: !!classId,
  });
  const typesQ = useQuery({
    queryKey: ["assessment-types", schoolId, classId, bimestre],
    queryFn: () => ensureAssessmentTypes(schoolId, classId!, bimestre),
    enabled: !!classId,
  });
  const gradesQ = useQuery({
    queryKey: ["grade-map", schoolId, classId, bimestre],
    queryFn: () => getClassGradeMap(schoolId, classId!, bimestre),
    enabled: !!classId,
  });

  const columns: AssessmentType[] = useMemo(() => typesQ.data ?? [], [typesQ.data]);

  useEffect(() => {
    if (!studentsQ.data || !gradesQ.data) return;
    const next: Record<string, RowDraft> = {};
    for (const s of studentsQ.data) {
      const stored = gradesQ.data[s.id] ?? {};
      const row: RowDraft = {};
      for (const c of columns) {
        const v = stored[c.subjectKey];
        row[c.subjectKey] = typeof v === "number" ? String(v) : "";
      }
      next[s.id] = row;
    }
    setDrafts(next);
    setDirty({});
  }, [studentsQ.data, gradesQ.data, columns]);

  const filteredStudents = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!filter.trim()) return list;
    return list.filter((s) => matchesInitial(s.name, filter));
  }, [studentsQ.data, filter]);

  const numbersFor = (studentId: string): GradeMap => {
    const row = drafts[studentId] ?? {};
    const out: GradeMap = {};
    for (const c of columns) {
      const parsed = sanitizeGrade(row[c.subjectKey] ?? "", c.maxValue).value;
      if (parsed != null) out[c.subjectKey] = parsed;
    }
    return out;
  };

  const saveRow = async (studentId: string) => {
    if (!classId) return;
    setSavingId(studentId);
    try {
      const row = drafts[studentId] ?? {};
      const values: Record<string, number | null> = {};
      const display: RowDraft = {};
      let corrected = false;
      for (const c of columns) {
        const s = sanitizeGrade(row[c.subjectKey] ?? "", c.maxValue);
        values[c.subjectKey] = s.value;
        display[c.subjectKey] = s.display;
        corrected = corrected || s.corrected;
      }
      setDrafts((x) => ({ ...x, [studentId]: display }));
      await setStudentGradeMap({
        schoolId,
        classId,
        bimestre,
        studentId,
        subjectKeys: columns.map((c) => c.subjectKey),
        values,
      });
      setDirty((d) => ({ ...d, [studentId]: false }));
      toast.success(corrected ? "Nota salva (valores ajustados)." : "Nota salva.");
      qc.invalidateQueries({ queryKey: ["grade-map", schoolId, classId, bimestre] });
      qc.invalidateQueries({ queryKey: ["grades", schoolId, classId, bimestre] });
      qc.invalidateQueries({ queryKey: ["attention-report", schoolId, classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  // Moved to top of component for consistent hook order
  // const dirtyIds = Object.keys(dirty).filter((id) => dirty[id]);
  // useUnsavedChanges(dirtyIds.length > 0);

  const saveAll = async () => {
    for (const id of dirtyIds) await saveRow(id);
    setDirty({});
  };

  if (classesQ.isLoading) return <Loading />;
  const allClasses = classesQ.data ?? [];
  const isOffice = membership?.roleInSchool === "school_admin" || membership?.roleInSchool === "coordinator" || membership?.roleInSchool === "master";
  const classes = isOffice ? allClasses : allClasses; // For grades, we usually show all classes the user has access to or filter by taught classes. 
  // Wait, let's keep the filter consistency if needed, but the user asked for office to see everything.
  
  if (allClasses.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma para lançar notas." />;
  }
  const currentClass = classes.find((c) => c.id === classId);

  return (
    <>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="turma-select">Turma</Label>
            <select
              id="turma-select"
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
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Bimestre">
              {[1, 2, 3, 4].map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={bimestre === b}
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

      {classId && currentClass && (
        <>
          <NotasDashboard
            schoolId={schoolId}
            classId={classId}
            className={currentClass.name}
            bimester={bimestre}
          />

          {typesQ.isLoading ? (
            <Loading />
          ) : (
            <GradeColumnsPanel
              schoolId={schoolId}
              classId={classId}
              bimester={bimestre}
              types={columns}
            />
          )}

          {studentsQ.isLoading || gradesQ.isLoading ? (
            <Loading />
          ) : (studentsQ.data ?? []).length === 0 ? (
            <EmptyState title="Sem alunos" />
          ) : (
            <div className="space-y-2">
              <StudentSearchInput value={filter} onChange={setFilter} />

              {dirtyIds.length > 0 && (
                <div className="sticky top-2 z-10 flex items-center justify-between gap-2 rounded-md border bg-card/95 backdrop-blur px-3 py-2 shadow-sm">
                  <span className="text-xs text-muted-foreground">
                    {dirtyIds.length} aluno(s) com alterações
                  </span>
                  <Button size="sm" onClick={saveAll} disabled={!!savingId}>
                    <Save className="size-3.5" /> Salvar tudo
                  </Button>
                </div>
              )}

              {filteredStudents.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum aluno com essas iniciais.
                </p>
              )}

              {filteredStudents.map((s, index) => {
                const row = drafts[s.id] ?? {};
                const nums = numbersFor(s.id);
                const media = calcWeightedMedia(
                  nums,
                  columns.map((c) => ({ subjectKey: c.subjectKey, weight: c.weight })),
                );
                const sum = Object.values(nums).reduce((a, b) => a + b, 0);
                const filled = Object.keys(nums).length;
                const isDirty = !!dirty[s.id];
                return (
                  <Card key={s.id} className={isDirty ? "border-primary/60" : undefined}>
                    <CardContent className="pt-4 pb-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-medium text-sm truncate">{s.name}</span>
                          {s.specialNeeds && (
                            <Heart
                              className="size-3.5 text-primary shrink-0"
                              aria-label={s.specialNeedsNote ?? "Adaptação"}
                            />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            Total:
                          </span>
                          <span
                            className={`font-bold ${
                              filled === 0
                                ? "text-muted-foreground"
                                : media >= 6
                                  ? "text-primary"
                                  : "text-destructive"
                            }`}
                          >
                            {sum.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {columns.map((c) => {
                          const inputId = `g-${s.id}-${c.subjectKey}`;
                          return (
                            <div key={c.subjectKey} className="min-w-0">
                              <label
                                htmlFor={inputId}
                                className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1 truncate"
                                title={`${c.name} (peso ${c.weight}, máx ${c.maxValue})`}
                              >
                                {c.name}
                                {c.weight !== 1 && (
                                  <span className="opacity-60"> ×{c.weight}</span>
                                )}
                              </label>
                              <Input
                                id={inputId}
                                inputMode="decimal"
                                value={row[c.subjectKey] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDrafts((x) => ({
                                    ...x,
                                    [s.id]: { ...(x[s.id] ?? {}), [c.subjectKey]: v },
                                  }));
                                  setDirty((d) => ({ ...d, [s.id]: true }));
                                }}
                                onBlur={(e) => {
                                  const sanitized = sanitizeGrade(e.target.value, c.maxValue)
                                    .display;
                                  if (sanitized !== e.target.value) {
                                    setDrafts((x) => ({
                                      ...x,
                                      [s.id]: { ...(x[s.id] ?? {}), [c.subjectKey]: sanitized },
                                    }));
                                  }
                                }}
                                className="h-9 text-center tabular-nums"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        size="sm"
                        variant={isDirty ? "default" : "outline"}
                        className="w-full"
                        onClick={() => saveRow(s.id)}
                        disabled={savingId === s.id}
                      >
                        <Save className="size-3.5" />
                        {savingId === s.id
                          ? "Salvando..."
                          : isDirty
                            ? "Salvar alterações"
                            : filled > 0
                              ? "Atualizar"
                              : "Salvar"}
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
