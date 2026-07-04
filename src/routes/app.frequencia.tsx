import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellRing,
  Calendar,
  Check,
  ClipboardList,
  Download,
  Heart,
  Paperclip,
  Save,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SchoolGate } from "@/components/SchoolGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loading, EmptyState } from "@/components/States";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses } from "@/lib/classes";
import { listMyTaughtClasses } from "@/lib/classTeachers";
import { listStudentsByClass } from "@/lib/students";
import {
  getAttendance,
  getClassAttendanceAll,
  setAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";
import {
  getMyAttendanceAlert,
  periodStart,
  upsertAttendanceAlert,
  type AlertPeriod,
} from "@/lib/attendanceAlerts";
import {
  createContentLog,
  deleteContentLog,
  getContentAttachmentUrl,
  listContentLogs,
  type SuccessLevel,
} from "@/lib/classContent";
import { createAnnouncement } from "@/lib/announcements";

export const Route = createFileRoute("/app/frequencia")({
  validateSearch: (s: Record<string, unknown>) => ({
    classId: typeof s.classId === "string" ? s.classId : undefined,
  }),
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
  const search = Route.useSearch();
  const [classId, setClassId] = useState<string | null>(search.classId ?? null);
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [tab, setTab] = useState<"chamada" | "conteudo">("chamada");

  useEffect(() => {
    if (search.classId) setClassId(search.classId);
  }, [search.classId]);

  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const myTaughtQ = useQuery({
    queryKey: ["my-taught-classes", firebaseUser?.uid],
    queryFn: () => listMyTaughtClasses(firebaseUser!.uid),
    enabled: !!firebaseUser,
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

  const allAttendanceQ = useQuery({
    queryKey: ["attendance-all", schoolId, classId],
    queryFn: () => getClassAttendanceAll(schoolId, classId!),
    enabled: !!classId,
  });

  const alertQ = useQuery({
    queryKey: ["att-alert", classId, firebaseUser?.uid],
    queryFn: () => getMyAttendanceAlert(classId!),
    enabled: !!classId && !!firebaseUser,
  });

  useEffect(() => {
    if (attendanceQ.data && Object.keys(attendanceQ.data).length > 0) {
      const next: Record<string, AttendanceStatus> = {};
      for (const [uid, v] of Object.entries(attendanceQ.data)) next[uid] = v.status;
      setMarks(next);
    } else if (studentsQ.data) {
      const next: Record<string, AttendanceStatus> = {};
      for (const s of studentsQ.data) next[s.id] = "P";
      setMarks(next);
    }
  }, [attendanceQ.data, studentsQ.data]);

  const counts = useMemo(() => {
    let p = 0, f = 0, j = 0;
    for (const v of Object.values(marks)) {
      if (v === "P") p++;
      else if (v === "F") f++;
      else if (v === "J") j++;
    }
    return { p, f, j, total: (studentsQ.data ?? []).length };
  }, [marks, studentsQ.data]);

  // Absentee analytics for the alert period
  const absenceStats = useMemo(() => {
    const period: AlertPeriod = alertQ.data?.period ?? "month";
    const start = periodStart(period);
    const startISO = start.toISOString().slice(0, 10);
    const perStudent: Record<string, { total: number; unjustified: number; dates: string[] }> = {};
    const dayFaults: Record<string, number> = {};
    for (const [d, entries] of Object.entries(allAttendanceQ.data ?? {})) {
      if (d < startISO) continue;
      for (const [sid, e] of Object.entries(entries)) {
        if (e.status === "F" || e.status === "J") {
          const rec = (perStudent[sid] ??= { total: 0, unjustified: 0, dates: [] });
          rec.total++;
          if (e.status === "F") {
            rec.unjustified++;
            rec.dates.push(d);
          }
          if (e.status === "F") dayFaults[d] = (dayFaults[d] ?? 0) + 1;
        }
      }
    }
    const nameOf = (id: string) =>
      (studentsQ.data ?? []).find((s) => s.id === id)?.name ?? "Aluno";
    const top = Object.entries(perStudent)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([id, s]) => ({ id, name: nameOf(id), ...s }));
    const topDays = Object.entries(dayFaults)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d, n]) => ({ date: d, count: n }));
    const atRisk = alertQ.data
      ? Object.entries(perStudent)
          .filter(([, s]) => s.total >= (alertQ.data?.maxAbsences ?? Infinity))
          .map(([id, s]) => ({ id, name: nameOf(id), ...s }))
      : [];
    return { top, topDays, atRisk, period };
  }, [allAttendanceQ.data, studentsQ.data, alertQ.data]);

  const save = async () => {
    if (!classId || !firebaseUser) return;
    setSaving(true);
    try {
      const now = Date.now();
      const full: Record<string, AttendanceStatus> = { ...marks };
      let autoCount = 0;
      for (const s of studentsQ.data ?? []) {
        if (!full[s.id]) {
          full[s.id] = "P";
          autoCount++;
        }
      }
      const payload = Object.fromEntries(
        Object.entries(full).map(([uid, s]) => [uid, { status: s, by: firebaseUser.uid, at: now }]),
      );
      await setAttendance(schoolId, classId, date, payload);
      toast.success(
        autoCount > 0
          ? `Frequência salva · ${autoCount} aluno(s) marcado(s) como presente automaticamente.`
          : "Frequência salva com sucesso!",
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
      qc.invalidateQueries({ queryKey: ["attendance", schoolId, classId] });
      qc.invalidateQueries({ queryKey: ["attendance-all", schoolId, classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar chamada.");
    } finally {
      setSaving(false);
    }
  };

  if (classesQ.isLoading || myTaughtQ.isLoading) return <Loading />;
  const taughtIds = new Set((myTaughtQ.data ?? []).map((t) => t.classId));
  const allClasses = classesQ.data ?? [];
  const classes = allClasses.filter((c) => taughtIds.has(c.id));
  if (allClasses.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma para fazer chamada." />;
  }
  if (classes.length === 0) {
    return (
      <EmptyState
        title="Você não leciona nenhuma turma"
        description="Vá em Turmas e marque as turmas em que você dá aula."
      />
    );
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
          <AttendanceDashboard
            schoolId={schoolId}
            classId={classId}
            stats={absenceStats}
            alertMax={alertQ.data?.maxAbsences ?? null}
            alertPeriod={alertQ.data?.period ?? "month"}
            onAlertSaved={() => qc.invalidateQueries({ queryKey: ["att-alert", classId] })}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as "chamada" | "conteudo")}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="chamada">Chamada</TabsTrigger>
              <TabsTrigger value="conteudo">Conteúdo da aula</TabsTrigger>
            </TabsList>

            <TabsContent value="chamada" className="space-y-2 mt-3">
              {studentsQ.isLoading ? (
                <Loading />
              ) : (studentsQ.data ?? []).length === 0 ? (
                <EmptyState title="Sem alunos" description="Adicione alunos a esta turma em Turmas." />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-secondary/20 text-secondary-foreground px-2.5 py-1 font-medium">
                      Presentes: {counts.p}
                    </span>
                    <span className="rounded-full bg-destructive/15 text-destructive px-2.5 py-1 font-medium">
                      Faltas: {counts.f}
                    </span>
                    <span className="rounded-full bg-accent/20 text-accent-foreground px-2.5 py-1 font-medium">
                      Justif.: {counts.j}
                    </span>
                    <span className="ml-auto text-muted-foreground">Total: {counts.total}</span>
                  </div>

                  {studentsQ.data!.map((s, i) => {
                    const status = marks[s.id] ?? "P";
                    return (
                      <div key={s.id} className="rounded-xl border bg-card p-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{s.name}</span>
                          {s.specialNeeds && (
                            <Heart
                              className="size-3.5 text-primary shrink-0"
                              aria-label={s.specialNeedsNote ?? "Necessidade especial"}
                            />
                          )}
                        </div>
                        {(["P", "F", "J"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setMarks((m) => ({ ...m, [s.id]: opt }))}
                            className={`size-9 rounded-lg text-xs font-bold border transition-transform active:scale-95 ${
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

                  <div className="relative">
                    <Button
                      className={`w-full h-12 transition-colors ${
                        savedFlash ? "bg-secondary text-secondary-foreground" : ""
                      }`}
                      onClick={save}
                      disabled={saving}
                    >
                      {savedFlash ? (
                        <>
                          <Check className="size-5 animate-in zoom-in-50 duration-300" /> Salvo!
                        </>
                      ) : saving ? (
                        "Salvando..."
                      ) : (
                        <>
                          <Save className="size-4" /> Salvar chamada
                        </>
                      )}
                    </Button>
                    {savedFlash && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="absolute inline-flex h-16 w-16 rounded-full bg-secondary/40 animate-ping" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Alunos sem marcação serão salvos como Presente.
                  </p>

                  {attendanceQ.data && Object.keys(attendanceQ.data).length > 0 && (
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                      <Check className="size-3" /> Já existe chamada para este dia (você pode editar e salvar de novo).
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="conteudo" className="space-y-3 mt-3">
              <ContentLogPanel schoolId={schoolId} classId={classId} date={date} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}

/* ----------------- Dashboard ----------------- */

function AttendanceDashboard({
  schoolId,
  classId,
  stats,
  alertMax,
  alertPeriod,
  onAlertSaved,
}: {
  schoolId: string;
  classId: string;
  stats: {
    top: { id: string; name: string; total: number; unjustified: number; dates: string[] }[];
    topDays: { date: string; count: number }[];
    atRisk: { id: string; name: string; total: number; unjustified: number; dates: string[] }[];
    period: AlertPeriod;
  };
  alertMax: number | null;
  alertPeriod: AlertPeriod;
  onAlertSaved: () => void;
}) {
  const [openAlert, setOpenAlert] = useState(false);
  const [maxAbs, setMaxAbs] = useState(alertMax ?? 5);
  const [period, setPeriod] = useState<AlertPeriod>(alertPeriod);

  useEffect(() => {
    setMaxAbs(alertMax ?? 5);
    setPeriod(alertPeriod);
  }, [alertMax, alertPeriod]);

  const saveAlert = async () => {
    try {
      await upsertAttendanceAlert(classId, maxAbs, period);
      toast.success("Alerta salvo.");
      setOpenAlert(false);
      onAlertSaved();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar alerta.");
    }
  };

  const notifySecretary = async (studentName: string) => {
    try {
      await createAnnouncement({
        schoolId,
        classId,
        audience: "all",
        title: `Atenção: ${studentName}`,
        body: `O aluno ${studentName} atingiu o limite de faltas configurado. Recomenda-se encaminhamento à secretaria.`,
      });
      toast.success("Aviso enviado para a escola.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar o aviso.");
    }
  };

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <BellRing className="size-4 text-primary" /> Painel da turma
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpenAlert(true)}>
            <Settings2 className="size-4" /> Alerta
          </Button>
        </div>

        {stats.atRisk.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 space-y-1.5">
            <div className="text-xs font-semibold text-destructive flex items-center gap-1">
              <AlertTriangle className="size-3.5" /> {stats.atRisk.length} aluno(s) atingiram o limite
            </div>
            {stats.atRisk.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate">
                  {s.name} · <span className="font-bold">{s.total}</span> faltas
                </span>
                <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => notifySecretary(s.name)}>
                  <Send className="size-3" /> Secretaria
                </Button>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            Mais faltosos ({stats.period === "month" ? "no mês" : stats.period === "bimester" ? "no bimestre" : "no ano"})
          </div>
          {stats.top.length === 0 ? (
            <div className="text-xs text-muted-foreground">Ninguém com faltas — turma cheia!</div>
          ) : (
            <div className="space-y-1">
              {stats.top.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{s.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.total} <span className="opacity-60">({s.unjustified} sem justif.)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {stats.topDays.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Dias com mais faltas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.topDays.map((d) => (
                <span key={d.date} className="text-[11px] rounded-full bg-muted px-2 py-0.5 tabular-nums">
                  {d.date} · {d.count}
                </span>
              ))}
            </div>
          </div>
        )}

        <Dialog open={openAlert} onOpenChange={setOpenAlert}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alerta de faltas</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Limite de faltas</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxAbs}
                  onChange={(e) => setMaxAbs(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Período</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as AlertPeriod)}
                >
                  <option value="month">Por mês</option>
                  <option value="bimester">Por bimestre</option>
                  <option value="year">Por ano</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando um aluno atingir esse limite no período, ele aparece destacado com atalho para
                encaminhar à secretaria.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAlert(false)}>Cancelar</Button>
              <Button onClick={saveAlert}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ----------------- Content log ----------------- */

function ContentLogPanel({
  schoolId,
  classId,
  date,
}: {
  schoolId: string;
  classId: string;
  date: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [reaction, setReaction] = useState("");
  const [success, setSuccess] = useState<SuccessLevel>("yes");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const logsQ = useQuery({
    queryKey: ["content-logs", schoolId, classId],
    queryFn: () => listContentLogs(schoolId, classId),
  });

  const save = async () => {
    if (!title.trim()) {
      toast.error("Adicione um título.");
      return;
    }
    setSaving(true);
    try {
      await createContentLog({
        schoolId, classId, date,
        title, description, objective, reaction, success,
        file,
      });
      toast.success("Conteúdo salvo!");
      setTitle(""); setDescription(""); setObjective(""); setReaction(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["content-logs", schoolId, classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (path: string) => {
    const url = await getContentAttachmentUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Anexo indisponível.");
  };

  const remove = async (id: string, path: string | null) => {
    if (!confirm("Excluir este registro?")) return;
    try {
      await deleteContentLog(id, path);
      qc.invalidateQueries({ queryKey: ["content-logs", schoolId, classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" /> Registrar conteúdo
          </div>
          <Input placeholder="Título (ex: Frações — introdução)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição do que foi trabalhado" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          <Textarea placeholder="Objetivo pedagógico" value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} />
          <Textarea placeholder="Como a turma reagiu?" value={reaction} onChange={(e) => setReaction(e.target.value)} rows={2} />
          <div>
            <Label className="text-xs">Houve êxito?</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["yes", "partial", "no"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSuccess(v)}
                  className={`h-9 rounded-md border text-xs font-medium ${
                    success === v
                      ? v === "yes"
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : v === "partial"
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-destructive text-destructive-foreground border-destructive"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {v === "yes" ? "Sim" : v === "partial" ? "Parcial" : "Não"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Anexo (opcional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            <Paperclip className="size-4" /> {saving ? "Salvando..." : "Salvar registro"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Últimos registros
        </div>
        {logsQ.isLoading ? (
          <Loading />
        ) : (logsQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          logsQ.data!.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-3 pb-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{l.title}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{l.date}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {l.attachmentPath && (
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openAttachment(l.attachmentPath!)}>
                        <Download className="size-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => remove(l.id, l.attachmentPath)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {l.description && <p className="text-xs text-muted-foreground">{l.description}</p>}
                {l.objective && <p className="text-xs"><span className="font-medium">Objetivo:</span> {l.objective}</p>}
                {l.reaction && <p className="text-xs"><span className="font-medium">Reação:</span> {l.reaction}</p>}
                {l.success && (
                  <span className={`inline-block text-[10px] uppercase font-bold rounded px-1.5 py-0.5 ${
                    l.success === "yes" ? "bg-secondary/20 text-secondary-foreground"
                    : l.success === "partial" ? "bg-accent/20 text-accent-foreground"
                    : "bg-destructive/15 text-destructive"
                  }`}>
                    {l.success === "yes" ? "Êxito" : l.success === "partial" ? "Parcial" : "Sem êxito"}
                  </span>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
