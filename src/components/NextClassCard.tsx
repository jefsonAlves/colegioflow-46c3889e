import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, ClipboardCheck, CalendarX, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listSchedulesBySchool, WEEKDAY_LABELS, type ClassScheduleDoc } from "@/lib/classSchedules";
import { listClasses } from "@/lib/classes";
import { supabase } from "@/integrations/supabase/client";

function nowHM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function minutesUntil(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - Date.now()) / 60000);
}

export function NextClassCard({ schoolId }: { schoolId: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const schedQ = useQuery({
    queryKey: ["class-schedules-school", schoolId],
    queryFn: () => listSchedulesBySchool(schoolId),
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const today = new Date().getDay();
  const now = nowHM();

  const todays = useMemo<ClassScheduleDoc[]>(() => {
    return (schedQ.data ?? [])
      .filter((s) => s.weekday === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedQ.data, today]);

  const featured = useMemo(() => {
    const ongoing = todays.find((s) => s.startTime <= now && now <= s.endTime);
    if (ongoing) return { sched: ongoing, status: "ongoing" as const };
    const upcoming = todays.find((s) => s.startTime > now);
    if (upcoming) return { sched: upcoming, status: "upcoming" as const };
    return null;
  }, [todays, now]);

  const featuredClassId = featured?.sched.classId ?? null;
  const today_ = todayISO();

  // Has any attendance been recorded today for the featured class?
  const attQ = useQuery({
    queryKey: ["attendance-today", schoolId, featuredClassId, today_],
    queryFn: async () => {
      if (!featuredClassId) return 0;
      const { count, error } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("class_id", featuredClassId)
        .eq("date", today_);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!featuredClassId,
  });

  const [expanded, setExpanded] = useState(false);

  if (schedQ.isLoading) return null;

  // No schedules at all in the school yet
  if ((schedQ.data ?? []).length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4 flex items-center gap-3">
          <CalendarX className="size-5 text-muted-foreground shrink-0" />
          <div className="flex-1 text-xs text-muted-foreground">
            Cadastre os horários das turmas para receber lembretes da próxima aula.
          </div>
          <Link to="/app/turmas">
            <Button size="sm" variant="outline">Turmas</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!featured) {
    // Schedules exist but nothing left today
    if (todays.length === 0) return null;
    return (
      <Card>
        <CardContent className="pt-4 pb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarX className="size-4" />
          Sem mais aulas para hoje.
        </CardContent>
      </Card>
    );
  }

  const cls = (classesQ.data ?? []).find((c) => c.id === featured.sched.classId);
  if (!cls) return null;

  const isOngoing = featured.status === "ongoing";
  const minsToStart = isOngoing ? 0 : minutesUntil(featured.sched.startTime);
  const pending = (attQ.data ?? 0) === 0;

  let statusText: string;
  if (isOngoing) statusText = `Em andamento · termina às ${featured.sched.endTime}`;
  else if (minsToStart <= 60) statusText = `Começa em ${minsToStart} min · ${featured.sched.startTime}`;
  else statusText = `Próxima aula às ${featured.sched.startTime}`;

  const others = todays.filter((s) => s.id !== featured.sched.id);

  return (
    <Card
      className={
        isOngoing
          ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm"
          : "border-primary/40 bg-primary/5"
      }
    >
      <CardContent className="pt-4 pb-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="relative flex">
            <Bell className="size-3.5 text-primary" />
            {isOngoing && (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </span>
          <span className="font-semibold text-primary uppercase tracking-wide">
            {isOngoing ? "Aula agora" : "Próxima aula"}
          </span>
          <span className="ml-auto text-muted-foreground">{WEEKDAY_LABELS[featured.sched.weekday]}</span>
        </div>

        <div>
          <div className="font-bold text-base leading-tight">
            {cls.name}
            {featured.sched.subject && (
              <span className="text-muted-foreground font-normal"> · {featured.sched.subject}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{statusText}</div>
        </div>

        {isOngoing && pending && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-2.5 py-1.5 text-xs">
            <AlertCircle className="size-3.5 shrink-0" />
            Chamada de hoje ainda não foi feita
          </div>
        )}

        <Link
          to="/app/frequencia"
          search={{ classId: featured.sched.classId }}
          className="block"
        >
          <Button size="sm" className="w-full">
            <ClipboardCheck className="size-4" />
            {isOngoing ? "Iniciar chamada" : "Abrir chamada"}
          </Button>
        </Link>

        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 pt-1 hover:text-foreground"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Esconder" : `+${others.length} aula(s) hoje`}
          </button>
        )}

        {expanded && others.length > 0 && (
          <ul className="space-y-1 pt-1 border-t">
            {others.map((s) => {
              const c = (classesQ.data ?? []).find((x) => x.id === s.classId);
              return (
                <li key={s.id} className="flex items-center gap-2 text-xs py-1">
                  <span className="font-medium w-12 tabular-nums">{s.startTime}</span>
                  <span className="flex-1 truncate">{c?.name ?? "Turma"}</span>
                  <Link to="/app/frequencia" search={{ classId: s.classId }}>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                      Chamada
                    </Button>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
