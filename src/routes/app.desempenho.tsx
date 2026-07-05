import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Heart,
  Save,
  Send,
  Trash2,
  UserCog,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loading, EmptyState } from "@/components/States";
import { StudentSearchInput, matchesInitial } from "@/components/StudentSearchInput";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { countStudentsBySchool, listStudentsByClass, type StudentDoc } from "@/lib/students";
import {
  createPerformanceLog,
  deletePerformanceLog,
  listPerformanceLogs,
  type Performance,
  type PerformanceLog,
} from "@/lib/performanceLogs";
import { listContentLogs } from "@/lib/classContent";
import { getGrades, calcMedia } from "@/lib/grades";
import { getClassAttendanceAll } from "@/lib/attendance";
import { createAnnouncement } from "@/lib/announcements";

export const Route = createFileRoute("/app/desempenho")({
  component: () => (
    <AppShell title="Desempenho do aluno">
      <SchoolGate>{({ schoolId }) => <Desempenho schoolId={schoolId} />}</SchoolGate>
    </AppShell>
  ),
});

const PERF_LABEL: Record<Performance, { label: string; className: string }> = {
  excelente: { label: "Excelente", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  bom: { label: "Bom", className: "bg-primary/10 text-primary" },
  regular: { label: "Regular", className: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
  dificuldade: { label: "Dificuldade", className: "bg-destructive/10 text-destructive" },
};

function Desempenho({ schoolId }: { schoolId: string }) {
  const { userDoc } = useAuth();
  const isAdmin = userDoc?.profileType === "school_admin";
  const [classId, setClassId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
    staleTime: 30_000,
  });
  const countsQ = useQuery({
    queryKey: ["students-counts", schoolId],
    queryFn: () => countStudentsBySchool(schoolId),
    staleTime: 30_000,
  });
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId!),
    enabled: !!classId,
    staleTime: 30_000,
  });

  const filteredStudents = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!filter.trim()) return list;
    return list.filter((s) => matchesInitial(s.name, filter));
  }, [studentsQ.data, filter]);

  const currentClass = (classesQ.data ?? []).find((c) => c.id === classId) ?? null;
  const currentStudent = (studentsQ.data ?? []).find((s) => s.id === studentId) ?? null;

  if (classesQ.isLoading) return <Loading />;
  const classes = classesQ.data ?? [];
  if (classes.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma primeiro." />;
  }

  return (
    <>
      {isAdmin && !currentStudent && (
        <AdminAdaptationsPanel schoolId={schoolId} />
      )}

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="space-y-1.5">
            <Label>Turma</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={classId ?? ""}
              onChange={(e) => {
                setClassId(e.target.value || null);
                setStudentId(null);
              }}
            >
              <option value="">Selecione...</option>
              {classes.map((c) => {
                const n = countsQ.data?.[c.id] ?? 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.year}) — {n} aluno(s)
                  </option>
                );
              })}
            </select>
          </div>
        </CardContent>
      </Card>

      {classId && !studentId && (
        <>
          <StudentSearchInput value={filter} onChange={setFilter} />
          {studentsQ.isLoading ? (
            <Loading />
          ) : filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhum aluno.
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className="w-full text-left rounded-lg border bg-card p-3 flex items-center gap-2 active:scale-[0.99]"
                >
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {s.name}
                      {s.specialNeeds && <Heart className="size-3.5 text-primary" />}
                    </div>
                    {s.specialNeeds && s.specialNeedsNote && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {s.specialNeedsNote}
                      </div>
                    )}
                  </div>
                  <Activity className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {classId && currentClass && currentStudent && (
        <StudentDesempenho
          schoolId={schoolId}
          classId={classId}
          className={currentClass.name}
          student={currentStudent}
          onBack={() => setStudentId(null)}
        />
      )}
    </>
  );
}

function StudentDesempenho({
  schoolId,
  classId,
  className,
  student,
  onBack,
}: {
  schoolId: string;
  classId: string;
  className: string;
  student: StudentDoc;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [bimester, setBimester] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [performance, setPerformance] = useState<Performance>("bom");
  const [notes, setNotes] = useState("");
  const [needsAdaptation, setNeedsAdaptation] = useState(false);
  const [adaptationDesc, setAdaptationDesc] = useState("");
  const [contentRef, setContentRef] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const logsQ = useQuery({
    queryKey: ["performance-logs", classId, student.id],
    queryFn: () => listPerformanceLogs(classId, student.id),
    staleTime: 30_000,
  });
  const gradesQ = useQuery({
    queryKey: ["grades", schoolId, classId, bimester],
    queryFn: () => getGrades(schoolId, classId, bimester),
    staleTime: 30_000,
  });
  const attendanceQ = useQuery({
    queryKey: ["attendance", schoolId, classId],
    queryFn: () => getClassAttendanceAll(schoolId, classId),
    staleTime: 30_000,
  });
  const contentQ = useQuery({
    queryKey: ["content-logs", schoolId, classId],
    queryFn: () => listContentLogs(schoolId, classId, 20),
    staleTime: 60_000,
  });

  const grade = gradesQ.data?.[student.id];
  const media = grade ? calcMedia(grade) : 0;
  const attendanceStats = useMemo(() => {
    const att = attendanceQ.data ?? {};
    let total = 0;
    let presentOrJust = 0;
    let absences = 0;
    for (const entries of Object.values(att)) {
      const e = entries[student.id];
      if (!e) continue;
      total++;
      if (e.status === "P" || e.status === "J") presentOrJust++;
      if (e.status === "F") absences++;
    }
    const pct = total === 0 ? 100 : Math.round((presentOrJust / total) * 100);
    return { total, pct, absences };
  }, [attendanceQ.data, student.id]);

  const save = async () => {
    setSaving(true);
    try {
      const finalNotes = [
        notes.trim(),
        needsAdaptation && adaptationDesc.trim()
          ? `[Adaptação] ${adaptationDesc.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      await createPerformanceLog({
        schoolId,
        classId,
        studentId: student.id,
        date,
        performance,
        notes: finalNotes || undefined,
        needsAdaptation,
        contentRef: contentRef || null,
      });
      toast.success("Registro salvo.");
      setNotes("");
      setAdaptationDesc("");
      setNeedsAdaptation(false);
      setContentRef("");
      qc.invalidateQueries({ queryKey: ["performance-logs", classId, student.id] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este registro?")) return;
    try {
      await deletePerformanceLog(id);
      qc.invalidateQueries({ queryKey: ["performance-logs", classId, student.id] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir.");
    }
  };

  const sendSummary = async () => {
    const logs = (logsQ.data ?? []).slice(0, 8);
    if (logs.length === 0) {
      toast.error("Nenhum registro para enviar.");
      return;
    }
    const body = [
      `Resumo de desempenho — ${student.name} (${className})`,
      `Média atual: ${media.toFixed(1)} · Frequência: ${attendanceStats.pct}%`,
      "",
      ...logs.map(
        (l) =>
          `• ${l.date} — ${PERF_LABEL[l.performance].label}${l.needsAdaptation ? " · precisa de adaptação" : ""}${l.notes ? `\n  ${l.notes}` : ""}`,
      ),
    ].join("\n");
    try {
      await createAnnouncement({
        schoolId,
        classId,
        audience: "teachers",
        targetRole: "school_admin",
        title: `Desempenho · ${student.name}`,
        body,
      });
      toast.success("Enviado à secretaria.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar.");
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> Voltar aos alunos
      </Button>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold flex items-center gap-1.5 truncate">
                {student.name}
                {student.specialNeeds && <Heart className="size-3.5 text-primary" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">{className}</div>
              {student.specialNeeds && student.specialNeedsNote && (
                <div className="text-[11px] text-primary/80 mt-1">
                  Laudo/adaptação: {student.specialNeedsNote}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/40 p-2">
              <div className="text-xs text-muted-foreground">Frequência</div>
              <div className={`text-lg font-bold ${attendanceStats.pct < 75 ? "text-destructive" : "text-primary"}`}>
                {attendanceStats.pct}%
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <div className="text-xs text-muted-foreground">Faltas</div>
              <div className="text-lg font-bold">{attendanceStats.absences}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <div className="text-xs text-muted-foreground">Média (B{bimester})</div>
              <div className={`text-lg font-bold ${media > 0 && media < 6 ? "text-destructive" : "text-primary"}`}>
                {media > 0 ? media.toFixed(1) : "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((b) => (
              <button
                key={b}
                onClick={() => setBimester(b)}
                className={`h-8 rounded-md border text-xs font-medium ${
                  bimester === b
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card"
                }`}
              >
                {b}º Bim
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="size-4" /> Novo registro
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Desempenho</Label>
              <select
                value={performance}
                onChange={(e) => setPerformance(e.target.value as Performance)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(PERF_LABEL) as Performance[]).map((p) => (
                  <option key={p} value={p}>{PERF_LABEL[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo / guia do professor (opcional)</Label>
            <select
              value={contentRef}
              onChange={(e) => setContentRef(e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Nenhum —</option>
              {(contentQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.date} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que o aluno demonstrou, dificuldades, avanços..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Precisa de adaptação</div>
              <div className="text-[11px] text-muted-foreground">
                Marque quando a secretaria/laudo indicar ajuste na atividade.
              </div>
            </div>
            <Switch checked={needsAdaptation} onCheckedChange={setNeedsAdaptation} />
          </div>

          {needsAdaptation && (
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição da adaptação solicitada</Label>
              <Textarea
                rows={2}
                value={adaptationDesc}
                onChange={(e) => setAdaptationDesc(e.target.value)}
                placeholder="Ex.: prova em fonte ampliada, tempo estendido..."
              />
            </div>
          )}

          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="size-4" /> {saving ? "Salvando..." : "Salvar registro"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="size-4" /> Histórico
            </div>
            <Button size="sm" variant="outline" onClick={sendSummary}>
              <Send className="size-3.5" /> Secretaria
            </Button>
          </div>

          {logsQ.isLoading ? (
            <Loading />
          ) : (logsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Nenhum registro ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {logsQ.data!.map((l) => (
                <LogItem key={l.id} log={l} onDelete={() => remove(l.id)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function LogItem({ log, onDelete }: { log: PerformanceLog; onDelete: () => void }) {
  const perf = PERF_LABEL[log.performance];
  return (
    <li className="rounded-lg border p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{log.date}</span>
          <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-semibold ${perf.className}`}>
            {perf.label}
          </span>
          {log.needsAdaptation && (
            <span className="text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 font-semibold">
              Adaptação
            </span>
          )}
        </div>
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Excluir"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {log.notes && (
        <p className="text-xs text-foreground whitespace-pre-wrap">{log.notes}</p>
      )}
    </li>
  );
}

function AdminAdaptationsPanel({ schoolId }: { schoolId: string }) {
  // Secretaria: alunos com adaptação sinalizada recentemente (últimos 60 dias).
  const logsQ = useQuery({
    queryKey: ["adaptation-logs", schoolId],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("student_performance_logs")
        .select("*")
        .eq("school_id", schoolId)
        .eq("needs_adaptation", true)
        .gte("date", since)
        .order("date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const askAdjust = async (teacherId: string, studentId: string, note: string) => {
    try {
      await createAnnouncement({
        schoolId,
        audience: "teachers",
        targetUserId: teacherId,
        title: `Ajuste de atividade solicitado`,
        body: `A secretaria solicita revisão da atividade para o aluno (${studentId}).\n\nObservação anexada: ${note || "—"}`,
      });
      toast.success("Solicitação enviada ao professor.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar.");
    }
  };

  const rows = logsQ.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="text-sm font-semibold flex items-center gap-2">
          <UserCog className="size-4 text-primary" /> Adaptações sinalizadas (últimos 60 dias)
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id as string} className="rounded-lg bg-muted/40 p-2 text-xs space-y-1">
              <div className="font-medium">
                {r.date as string}
              </div>
              {r.notes && <div className="text-[11px] text-muted-foreground">{r.notes as string}</div>}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => askAdjust(r.teacher_id as string, r.student_id as string, (r.notes as string) ?? "")}
              >
                Solicitar ajuste ao professor
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
