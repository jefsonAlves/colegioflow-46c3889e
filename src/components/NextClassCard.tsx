import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listSchedulesBySchool, WEEKDAY_LABELS } from "@/lib/classSchedules";
import { listClasses } from "@/lib/classes";

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NextClassCard({ schoolId }: { schoolId: string }) {
  const schedQ = useQuery({
    queryKey: ["class-schedules-school", schoolId],
    queryFn: () => listSchedulesBySchool(schoolId),
  });
  const classesQ = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId),
  });

  const next = useMemo(() => {
    const all = schedQ.data ?? [];
    const today = new Date().getDay();
    const now = nowHM();
    const todays = all
      .filter((s) => s.weekday === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const ongoing = todays.find((s) => s.startTime <= now && now <= s.endTime);
    if (ongoing) return { sched: ongoing, status: "ongoing" as const };
    const upcoming = todays.find((s) => s.startTime > now);
    if (upcoming) return { sched: upcoming, status: "upcoming" as const };
    return null;
  }, [schedQ.data]);

  if (schedQ.isLoading) return null;
  if (!next) return null;

  const cls = (classesQ.data ?? []).find((c) => c.id === next.sched.classId);
  if (!cls) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-4 pb-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Clock className="size-3.5 text-primary" />
          <span className="font-medium text-primary uppercase tracking-wide">
            {next.status === "ongoing" ? "Aula em andamento" : "Próxima aula de hoje"}
          </span>
        </div>
        <div>
          <div className="font-semibold">{cls.name}</div>
          <div className="text-xs text-muted-foreground">
            {WEEKDAY_LABELS[next.sched.weekday]} · {next.sched.startTime} – {next.sched.endTime}
          </div>
        </div>
        <Link
          to="/app/frequencia"
          search={{ classId: next.sched.classId }}
          className="block"
        >
          <Button size="sm" className="w-full">
            <ClipboardCheck className="size-4" /> Fazer chamada agora
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
