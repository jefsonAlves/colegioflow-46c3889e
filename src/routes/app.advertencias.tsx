import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loading, EmptyState } from "@/components/States";
import { StudentSearchInput, matchesInitial } from "@/components/StudentSearchInput";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { listMyTaughtClasses } from "@/lib/classTeachers";
import { listStudents, listStudentsByClass } from "@/lib/students";
import { listSchedulesBySchool, WEEKDAY_LABELS } from "@/lib/classSchedules";
import {
  createDisciplinary,
  deleteDisciplinary,
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

const toISO = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const formatLong = (iso: string) =>
  fromISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

function Advertencias({ schoolId }: { schoolId: string }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();

  const [date, setDate] = useState(toISO(new Date()));
  const [classId, setClassId] = useState<string>("");
  const [studentId, setStudentId] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [type, setType] = useState<DisciplinaryType>("verbal");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });
  const myTaughtQ = useQuery({
    queryKey: ["my-taught-classes", firebaseUser?.uid],
    queryFn: () => listMyTaughtClasses(firebaseUser!.uid).then((list) => list.filter((t) => t.active)),
    enabled: !!firebaseUser,
  });
  const schedulesQ = useQuery({
    queryKey: ["schedules", schoolId],
    queryFn: () => listSchedulesBySchool(schoolId),
  });
  const studentsQ = useQuery({
    queryKey: ["students", schoolId, classId],
    queryFn: () => listStudentsByClass(schoolId, classId),
    enabled: !!classId,
  });
  const allStudentsQ = useQuery({
    queryKey: ["students-all", schoolId],
    queryFn: () => listStudents(schoolId),
  });
  const listQ = useQuery({

    queryKey: ["disciplinary", schoolId, classId || "all"],
    queryFn: () => listDisciplinary(schoolId, classId ? { classId } : undefined),
  });

  const taughtIds = useMemo(
    () => new Set((myTaughtQ.data ?? []).map((t) => t.classId)),
    [myTaughtQ.data],
  );
  const classes = useMemo(() => {
    const all = classesQ.data ?? [];
    const isTeacher = userDoc?.profileType === "teacher";
    const mine = all.filter((c) => taughtIds.has(c.id));
    if (isTeacher) return mine;
    return mine.length > 0 ? mine : all;
  }, [classesQ.data, taughtIds, userDoc]);

  if (classes.length === 0 && firebaseUser?.uid && !taughtIds.size) {
    return (
      <EmptyState
        title="Nenhuma turma"
        description="no painel perfil do professor possui uma opção de nome Minha Turmas nela possui uma função para ativar e cadastrar materias e horário quando a turma se encontrar desativada adicione a função ou condição que não seja exibido na opção frequencia dentro de turma ou em qualquer funcionalidade as turmas que não estão ativa igual mostra na imagem"
      />
    );
  }

  const classMap = useMemo(
    () => new Map((classesQ.data ?? []).map((c) => [c.id, c])),
    [classesQ.data],
  );

  // Classes scheduled for the selected weekday
  const weekday = fromISO(date).getDay();
  const daySchedules = useMemo(
    () =>
      (schedulesQ.data ?? [])
        .filter((s) => s.weekday === weekday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedulesQ.data, weekday],
  );

  const students = useMemo(() => {
    const list = studentsQ.data ?? [];
    if (!studentFilter.trim()) return list;
    return list.filter((s) => matchesInitial(s.name, studentFilter));
  }, [studentsQ.data, studentFilter]);

  const studentMap = useMemo(
    () =>
      new Map(
        [...(allStudentsQ.data ?? []), ...(studentsQ.data ?? [])].map((s) => [s.id, s]),
      ),
    [allStudentsQ.data, studentsQ.data],
  );


  const shiftDay = (delta: number) => {
    const d = fromISO(date);
    d.setDate(d.getDate() + delta);
    setDate(toISO(d));
  };

  const selectedStudent = studentId ? studentMap.get(studentId) : undefined;

  const reset = () => {
    setComposing(false);
    setStudentId("");
    setDescription("");
    setType("verbal");
    setStudentFilter("");
  };

  const save = async () => {
    if (!firebaseUser || !classId || !studentId) {
      toast.error("Escolha a turma e o aluno.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Descreva a ocorrência (mín. 5 caracteres).");
      return;
    }
    setSaving(true);
    try {
      await createDisciplinary(schoolId, {
        studentId,
        classId,
        type,
        description: description.trim(),
        date,
        by: firebaseUser.uid,
      });
      toast.success("Advertência registrada com sucesso!");
      reset();
      qc.invalidateQueries({ queryKey: ["disciplinary", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível registrar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta advertência?")) return;
    try {
      await deleteDisciplinary(id);
      toast.success("Advertência excluída.");
      qc.invalidateQueries({ queryKey: ["disciplinary", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível excluir.");
    }
  };

  // Timeline grouped by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof listQ.data>();
    for (const d of listQ.data ?? []) {
      const arr = map.get(d.date) ?? [];
      arr.push(d);
      map.set(d.date, arr as never);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [listQ.data]);

  return (
    <>
      {/* Calendar / day picker */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <div className="relative flex-1">
              <CalendarDays className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9"
                value={date}
                onChange={(e) => setDate(e.target.value || toISO(new Date()))}
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground capitalize">{formatLong(date)}</p>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Users className="size-3.5" /> Turmas de {WEEKDAY_LABELS[weekday]}
            </Label>
            {daySchedules.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum horário cadastrado para este dia — escolha a turma na lista abaixo.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {daySchedules.map((s) => {
                  const c = classMap.get(s.classId);
                  const active = classId === s.classId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setClassId(s.classId);
                        setStudentId("");
                      }}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        active ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/40"
                      }`}
                    >
                      <span className="block font-medium">{c?.name ?? "Turma"}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" />
                        {s.startTime}–{s.endTime}
                        {s.subject ? ` · ${s.subject}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Turma</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStudentId("");
              }}
            >
              <option value="">Todas as turmas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.year})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Student selection + new record */}
      {classId && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {composing ? "Nova advertência" : "Selecione o aluno"}
              </h3>
              {composing && (
                <Button size="sm" variant="ghost" onClick={reset}>
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {!composing ? (
              <>
                <StudentSearchInput value={studentFilter} onChange={setStudentFilter} />
                {studentsQ.isLoading ? (
                  <Loading />
                ) : students.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhum aluno nesta turma.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {students.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setStudentId(s.id);
                          setComposing(true);
                        }}
                        className="w-full flex items-center gap-2 rounded-md border p-2 text-sm text-left hover:bg-muted/40"
                      >
                        <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                        <span className="flex-1 truncate">{s.name}</span>
                        {s.specialNeeds && <Heart className="size-3.5 text-primary shrink-0" />}
                        <Plus className="size-3.5 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-2 text-sm">
                  <span className="font-medium">{selectedStudent?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {classMap.get(classId)?.name} · {date.split("-").reverse().join("/")}
                  </span>
                  {selectedStudent?.specialNeeds && (
                    <p className="text-[11px] text-primary mt-1 flex items-center gap-1">
                      <Heart className="size-3" />
                      {selectedStudent.specialNeedsNote || "Aluno com necessidade especial — considere a adaptação."}
                    </p>
                  )}
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
                  {saving ? "Salvando..." : (
                    <>
                      <Check className="size-4" /> Registrar
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Linha do tempo {classId ? `· ${classMap.get(classId)?.name ?? ""}` : "· todas as turmas"}
        </h3>
        {listQ.isLoading ? (
          <Loading />
        ) : grouped.length === 0 ? (
          <EmptyState
            title="Sem advertências"
            description="Escolha a turma e o aluno acima para registrar a primeira."
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, items]) => (
              <div key={day} className="relative pl-4 border-l-2 border-muted">
                <span className="absolute -left-[7px] top-1.5 size-3 rounded-full bg-primary" />
                <p className="text-xs font-medium text-muted-foreground mb-1.5 capitalize">
                  {formatLong(day)}
                </p>
                <div className="space-y-2">
                  {(items ?? []).map((d) => (
                    <Card key={d.id}>
                      <CardContent className="pt-3 pb-3 flex gap-3">
                        <div className="size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                          <AlertOctagon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">
                              {studentMap.get(d.studentId)?.name ?? "Aluno"}
                            </span>
                            <span
                              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${TYPE_COLOR[d.type]}`}
                            >
                              {TYPE_LABEL[d.type]}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{d.description}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {classMap.get(d.classId)?.name ?? "Sem turma"}
                          </p>
                        </div>
                        {d.by === firebaseUser?.uid && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Excluir advertência"
                            onClick={() => remove(d.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
