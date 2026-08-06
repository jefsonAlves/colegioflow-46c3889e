import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import {
  AlertTriangle,
  BellRing,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  Download,
  Heart,
  Paperclip,
  Save,
  Send,
  Settings2,
  Trash2,
  BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AbsenceReportSection } from "@/components/AbsenceReportSection";
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
  getClassRegencyDates,
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
import { listSchedulesByClass } from "@/lib/classSchedules";

export const Route = createFileRoute("/app/frequencia")({
  validateSearch: (s: Record<string, unknown>) => ({
    classId: typeof s.classId === "string" ? s.classId : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    scheduleId: typeof s.scheduleId === "string" ? s.scheduleId : undefined,
  }),
  component: () => {
    const search = Route.useSearch();
    return (
      <AppShell title="Frequência">
        <SchoolGate>{({ schoolId }) => <Frequencia schoolId={schoolId} />}</SchoolGate>
      </AppShell>
    );
  },
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Frequencia({ schoolId }: { schoolId: string }) {
  const { firebaseUser, userDoc } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [classId, setClassId] = useState<string | null>(search.classId ?? null);
  const [date, setDate] = useState(search.date ?? todayISO());
  const [internalDate, setInternalDate] = useState(date);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [individualInterventions, setIndividualInterventions] = useState<Record<string, string>>({});
  const [interventionDialog, setInterventionDialog] = useState<{ sid: string; name: string } | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(search.scheduleId ?? null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [ignoreDirtyForEffect, setIgnoreDirtyForEffect] = useState(false);
  useUnsavedChanges(isDirty);
  const [tab, setTab] = useState<"chamada" | "conteudo" | "faltosos">("chamada");
  const [showPeriodStats, setShowPeriodStats] = useState(false);
  const [statsRefDate, setStatsRefDate] = useState(todayISO());

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
    queryKey: ["attendance", schoolId, classId, date, scheduleId, firebaseUser?.uid],
    queryFn: () => getAttendance(schoolId, classId!, date, scheduleId, firebaseUser?.uid),
    enabled: !!classId && !!firebaseUser,
  });

  const allAttendanceQ = useQuery({
    queryKey: ["attendance-all", schoolId, classId, scheduleId, firebaseUser?.uid],
    queryFn: () => getClassAttendanceAll(schoolId, classId!, scheduleId, firebaseUser?.uid),
    enabled: !!classId && !!firebaseUser,
  });

  const alertQ = useQuery({
    queryKey: ["att-alert", classId, firebaseUser?.uid],
    queryFn: () => getMyAttendanceAlert(classId!),
    enabled: !!classId && !!firebaseUser,
  });

  const regencyDatesQ = useQuery({
    queryKey: ["regency-dates", schoolId, classId, scheduleId, firebaseUser?.uid],
    queryFn: () => getClassRegencyDates(schoolId, classId!, scheduleId, firebaseUser?.uid),
    enabled: !!classId && !!firebaseUser,
  });

  const schedulesQ = useQuery({
    queryKey: ["class-schedules", classId],
    queryFn: () => listSchedulesByClass(classId!),
    enabled: !!classId,
  });

  useEffect(() => {
    if (attendanceQ.data && Object.keys(attendanceQ.data).length > 0) {
      const next: Record<string, AttendanceStatus> = {};
      const nextInt: Record<string, string> = {};
      for (const [uid, v] of Object.entries(attendanceQ.data)) {
        next[uid] = v.status;
        if (v.pedagogicalIntervention) nextInt[uid] = v.pedagogicalIntervention;
      }
      setMarks(next);
      setIndividualInterventions(nextInt);
      setIgnoreDirtyForEffect(true);
    } else if (studentsQ.data) {
      const next: Record<string, AttendanceStatus> = {};
      for (const s of studentsQ.data) next[s.id] = "P";
      setMarks(next);
      setIgnoreDirtyForEffect(true);
    }
  }, [attendanceQ.data, studentsQ.data]);

  useEffect(() => {
    if (ignoreDirtyForEffect) {
      setIsDirty(false);
      setIgnoreDirtyForEffect(false);
    }
  }, [ignoreDirtyForEffect]);

  const counts = useMemo(() => {
    let p = 0, f = 0, j = 0;
    const sids = (studentsQ.data ?? []).map(s => s.id);
    for (const sid of sids) {
      const v = marks[sid] || "P";
      if (v === "P") p++;
      else if (v === "F") f++;
      else if (v === "J") j++;
    }
    return { p, f, j, total: sids.length };
  }, [marks, studentsQ.data]);

  // Absentee analytics for the alert period
  const absenceStats = useMemo(() => {
    const period: AlertPeriod = alertQ.data?.period ?? "month";
    const ref = new Date(statsRefDate + "T12:00:00");
    const start = periodStart(period, ref);
    const startISO = start.toISOString().slice(0, 10);
    // End date for the period - last day of the month/bimester/year
    let endISO = "9999-12-31";
    if (period === "month") {
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      endISO = end.toISOString().slice(0, 10);
    } else if (period === "bimester") {
      const bStart = Math.floor(ref.getMonth() / 2) * 2;
      const end = new Date(ref.getFullYear(), bStart + 2, 0);
      endISO = end.toISOString().slice(0, 10);
    } else if (period === "year") {
      endISO = `${ref.getFullYear()}-12-31`;
    }
    const perStudent: Record<string, { total: number; unjustified: number; dates: string[] }> = {};
    const dayFaults: Record<string, number> = {};
    const selectedDateAbsentees: { id: string; name: string; status: AttendanceStatus }[] = [];

    const nameOf = (id: string) =>
      (studentsQ.data ?? []).find((s) => s.id === id)?.name ?? "Aluno";

    for (const [d, entries] of Object.entries(allAttendanceQ.data ?? {})) {
      if (d === date) {
        for (const [sid, e] of Object.entries(entries)) {
          if (e.status === "F" || e.status === "J") {
            selectedDateAbsentees.push({ id: sid, name: nameOf(sid), status: e.status as AttendanceStatus });
          }
        }
      }

      if (d < startISO || d > endISO) continue;
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
    return { top, topDays, atRisk, period, selectedDateAbsentees };
  }, [allAttendanceQ.data, studentsQ.data, alertQ.data, date]);

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
        Object.entries(full).map(([uid, s]) => [
          uid, 
          { 
            status: s, 
            by: firebaseUser.uid, 
            at: now,
            pedagogicalIntervention: individualInterventions[uid] || null
          }
        ]),
      );
      await setAttendance(schoolId, classId, date, payload, scheduleId, firebaseUser.uid);
      toast.success(
        autoCount > 0
          ? `Frequência salva · ${autoCount} aluno(s) marcado(s) como presente automaticamente.`
          : "Frequência salva com sucesso!",
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
      qc.invalidateQueries({ queryKey: ["attendance", schoolId, classId] });
      qc.invalidateQueries({ queryKey: ["attendance-all", schoolId, classId] });
      qc.invalidateQueries({ queryKey: ["regency-dates", schoolId, classId] });
      setIsDirty(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar chamada.");
    } finally {
      setSaving(false);
    }
  };

  const copyPreviousAttendance = async () => {
    if (!classId || !scheduleId || !schedulesQ.data) return;
    
    // Find current schedule
    const currentIdx = schedulesQ.data.findIndex(s => s.id === scheduleId);
    if (currentIdx === -1) return;
    
    // We look for a previous schedule ON THE SAME DAY
    // The schedules list is already filtered by weekday in the selector, 
    // but the full list might not be.
    const day = new Date(date + "T12:00:00").getDay();
    const daySchedules = schedulesQ.data
      .filter(s => s.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    const dayCurrentIdx = daySchedules.findIndex(s => s.id === scheduleId);
    if (dayCurrentIdx <= 0) {
      toast.error("Não há horário anterior neste dia para repetir.");
      return;
    }
    
    const prevSchedule = daySchedules[dayCurrentIdx - 1];
    
    try {
      setSaving(true);
      const prevData = await getAttendance(schoolId, classId, date, prevSchedule.id, firebaseUser?.uid);
      
      if (Object.keys(prevData).length === 0) {
        toast.error("Nenhuma chamada encontrada no horário anterior para copiar.");
        return;
      }
      
      const next: Record<string, AttendanceStatus> = {};
      for (const [uid, v] of Object.entries(prevData)) {
        next[uid] = v.status;
      }
      
      setMarks(next);
      setIsDirty(true);
      toast.success(`Chamada copiada do horário ${prevSchedule.startTime}. Não esqueça de salvar.`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao copiar chamada anterior.");
    } finally {
      setSaving(false);
    }
  };


  if (classesQ.isLoading || myTaughtQ.isLoading) return <Loading />;
  const taughtIds = new Set((myTaughtQ.data ?? []).map((t) => t.classId));
  const allClasses = classesQ.data ?? [];
  const classes = userDoc?.globalRole === "master" ? allClasses : allClasses.filter((c) => taughtIds.has(c.id));
  if (allClasses.length === 0) {
    return <EmptyState title="Nenhuma turma" description="Crie uma turma para fazer chamada." />;
  }
  if (classes.length === 0 && userDoc?.globalRole !== "master") {
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <div className="relative">
                <Calendar className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="date" 
                  className="pl-9" 
                  value={internalDate} 
                  onChange={(e) => setInternalDate(e.target.value)}
                  onBlur={() => setDate(internalDate)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Datas com regência</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={date}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setInternalDate(e.target.value);
                  }
                }}
              >
                <option value="">Escolha uma data...</option>
                {(regencyDatesQ.data ?? []).map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + "T12:00:00").toLocaleDateString("pt-BR")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {classId && schedulesQ.data && schedulesQ.data.length > 0 && (
            <div className="space-y-1.5">
              <Label>Horário da Aula</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={scheduleId ?? ""}
                onChange={(e) => {
                  setScheduleId(e.target.value || null);
                  setIgnoreDirtyForEffect(true);
                }}
              >
                <option value="">Chamada Padrão (Sem horário)</option>
                {schedulesQ.data
                  .filter((s) => {
                    // Filter by weekday if date is selected
                    const day = new Date(date + "T12:00:00").getDay();
                    return s.weekday === day;
                  })
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.startTime} - {s.endTime} {s.subject ? `(${s.subject})` : ""}
                    </option>
                  ))}
              </select>
              {schedulesQ.data.filter(s => s.weekday === new Date(date + "T12:00:00").getDay()).length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  Nenhum horário cadastrado para este dia da semana.
                </p>
              )}
            </div>
          )}
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
            currentDate={date}
            showStats={showPeriodStats}
            setShowStats={setShowPeriodStats}
            statsRefDate={statsRefDate}
            setStatsRefDate={setStatsRefDate}
            scheduleId={scheduleId}
            schedules={schedulesQ.data ?? []}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as "chamada" | "conteudo" | "faltosos")}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="chamada">Chamada</TabsTrigger>
              <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
              <TabsTrigger value="faltosos">Faltosos</TabsTrigger>
            </TabsList>

            <TabsContent value="chamada" className="space-y-2 mt-3">
              {attendanceQ.data && Object.keys(attendanceQ.data).length > 0 ? (
                <div className="flex flex-col gap-2 p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="size-3 text-secondary" /> Chamada realizada para este horário.
                    </div>
                    {scheduleId && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-[10px] gap-1"
                        onClick={copyPreviousAttendance}
                        disabled={saving}
                      >
                        <Copy className="size-3" /> Repetir chamada anterior
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                scheduleId && (
                  <div className="flex justify-end mb-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-xs gap-1.5"
                      onClick={copyPreviousAttendance}
                      disabled={saving}
                    >
                      <Copy className="size-3.5" /> Repetir chamada anterior
                    </Button>
                  </div>
                )
              )}


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
                          <div className="flex flex-col">
                            <span className="font-medium text-sm truncate">{s.name}</span>
                            {individualInterventions[s.id] && (
                              <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                                <BookOpen className="size-2.5" /> Intervenção registrada
                              </span>
                            )}
                          </div>
                          {s.specialNeeds && (
                            <Heart
                              className="size-3.5 text-primary shrink-0"
                              aria-label={s.specialNeedsNote ?? "Necessidade especial"}
                            />
                          )}
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`size-9 shrink-0 ${individualInterventions[s.id] ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}
                          onClick={() => setInterventionDialog({ sid: s.id, name: s.name })}
                          title="Intervenção Pedagógica Individual"
                        >
                          <BookOpen className="size-4" />
                        </Button>

                        {(["P", "F", "J"] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => { setMarks((m) => ({ ...m, [s.id]: opt })); setIsDirty(true); }}
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

                </div>
              )}
            </TabsContent>

            <TabsContent value="conteudo" className="space-y-3 mt-3">
              <ContentLogPanel schoolId={schoolId} classId={classId} date={date} />
            </TabsContent>

            <TabsContent value="faltosos" className="space-y-3 mt-3">
              <AbsenceReportSection
                schoolId={schoolId}
                defaultClassId={classId}
                classOptions={classes.map((c) => ({ id: c.id, name: c.name }))}
                title="Relatório de faltosos"
              />
            </TabsContent>
          </Tabs>

          <Dialog open={!!interventionDialog} onOpenChange={(o) => !o && setInterventionDialog(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="size-5 text-primary" />
                  Intervenção Pedagógica
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Registrar acompanhamento individual para <span className="font-bold">{interventionDialog?.name}</span>
                </p>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="intervention-text" className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Descreva a intervenção realizada
                </Label>
                <Textarea
                  id="intervention-text"
                  placeholder="Ex: Reforço em leitura silábica, acompanhamento diferenciado durante atividade..."
                  className="min-h-[120px] resize-none"
                  value={interventionDialog ? (individualInterventions[interventionDialog.sid] || "") : ""}
                  onChange={(e) => {
                    if (interventionDialog) {
                      setIndividualInterventions(prev => ({ ...prev, [interventionDialog.sid]: e.target.value }));
                      setIsDirty(true);
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInterventionDialog(null)}>Fechar</Button>
                <Button onClick={() => setInterventionDialog(null)}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
  currentDate,
  showStats,
  setShowStats,
  statsRefDate,
  setStatsRefDate,
  scheduleId,
  schedules,
}: {
  schoolId: string;
  classId: string;
  stats: {
    top: { id: string; name: string; total: number; unjustified: number; dates: string[] }[];
    topDays: { date: string; count: number }[];
    atRisk: { id: string; name: string; total: number; unjustified: number; dates: string[] }[];
    period: AlertPeriod;
    selectedDateAbsentees: { id: string; name: string; status: AttendanceStatus }[];
  };
  alertMax: number | null;
  alertPeriod: AlertPeriod;
  onAlertSaved: () => void;
  currentDate: string;
  showStats: boolean;
  setShowStats: (v: boolean) => void;
  statsRefDate: string;
  setStatsRefDate: (v: string) => void;
  scheduleId?: string | null;
  schedules?: any[];
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
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant={showStats ? "secondary" : "ghost"} 
              className="h-8 text-xs gap-1"
              onClick={() => setShowStats(!showStats)}
            >
              <Settings2 className="size-3.5" /> Estatísticas
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => setOpenAlert(true)}>
              Alerta
            </Button>
          </div>
        </div>

        {showStats && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border border-muted-foreground/10 animate-in fade-in slide-in-from-top-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Filtrar período para estatísticas</Label>
            <div className="flex items-center gap-2">
              <Input 
                type={alertPeriod === "month" ? "month" : "date"} 
                className="h-8 text-xs" 
                value={alertPeriod === "month" ? statsRefDate.slice(0, 7) : statsRefDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatsRefDate(val.length === 7 ? `${val}-01` : val);
                }}
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-background px-2 py-1 rounded border">
                {alertPeriod === "month" ? "Mensal" : alertPeriod === "bimester" ? "Bimestral" : "Anual"}
              </span>
            </div>
          </div>
        )}

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
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center justify-between">
            <span>Faltosos ({currentDate}{scheduleId ? ` · ${schedules?.find((s: any) => s.id === scheduleId)?.startTime}` : ""})</span>
            {stats.selectedDateAbsentees.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 px-2"
                onClick={async () => {
                  const { buildAbsenceReport } = await import("@/lib/absenceReport");
                  const { generateAbsenceReportPDF } = await import("@/lib/pdf/faltosos");
                  const report = await buildAbsenceReport({
                    schoolId,
                    from: currentDate,
                    to: currentDate,
                    classId,
                    minAbsences: 1,
                  });
                  generateAbsenceReportPDF(report);
                }}
              >
                <Download className="size-4" /> PDF
              </Button>
            )}
          </div>
          {stats.selectedDateAbsentees.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nenhuma falta registrada nesta data.</div>
          ) : (
            <div className="space-y-1">
              {stats.selectedDateAbsentees.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{s.name}</span>
                  <span className={`font-bold ${s.status === "J" ? "text-accent" : "text-destructive"}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {showStats && (
          <div className="space-y-4 pt-2 border-t border-muted/20 animate-in fade-in duration-500">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Mais faltosos ({stats.period === "month" ? "no mês" : stats.period === "bimester" ? "no bimestre" : "no ano"})
              </div>
              {stats.top.length === 0 ? (
                <div className="text-xs text-muted-foreground italic bg-muted/10 p-2 rounded">Ninguém com faltas no período selecionado.</div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {stats.top.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/20 hover:bg-muted/30 transition-colors">
                      <span className="truncate flex-1 font-medium">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-destructive">
                          {s.total} <span className="text-[9px] font-normal opacity-70">faltas</span>
                        </span>
                        {s.unjustified > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">
                            {s.unjustified} sem justif.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stats.topDays.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Dias com mais faltas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.topDays.map((d) => (
                    <div key={d.date} className="flex flex-col items-center bg-muted/20 rounded-md p-2 min-w-[60px] border border-muted/30 hover:border-primary/30 transition-all">
                      <span className="text-[10px] font-bold text-primary">{d.date.split('-').reverse().slice(0, 2).join('/')}</span>
                      <span className="text-[11px] font-black text-destructive">{d.count}</span>
                      <span className="text-[8px] uppercase opacity-60">faltas</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
  const [pedagogicalIntervention, setPedagogicalIntervention] = useState("");
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
        pedagogicalIntervention,
        file,
      });
      toast.success("Conteúdo salvo!");
      setTitle(""); setDescription(""); setObjective(""); setReaction(""); setPedagogicalIntervention(""); setFile(null);
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
          <Textarea placeholder="Intervenção pedagógica realizada" value={pedagogicalIntervention} onChange={(e) => setPedagogicalIntervention(e.target.value)} rows={2} />
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
                {l.pedagogicalIntervention && <p className="text-xs text-primary font-medium"><span className="font-bold">Intervenção:</span> {l.pedagogicalIntervention}</p>}
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
