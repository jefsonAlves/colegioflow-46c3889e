import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, GraduationCap, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/States";
import { listSchoolStaff } from "@/lib/schoolAdmin";

const ROLE_LABEL: Record<string, string> = {
  school_admin: "Administrador",
  teacher: "Professor(a)",
  coordinator: "Coordenador(a)",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Ativo",
  pending: "Pendente",
  rejected: "Recusado",
  blocked: "Bloqueado",
};

export function SchoolStaffSection({ schoolId }: { schoolId: string }) {
  const staffQ = useQuery({
    queryKey: ["school-staff", schoolId],
    queryFn: () => listSchoolStaff(schoolId),
    staleTime: 30_000,
  });

  const staff = staffQ.data ?? [];
  const approved = staff.filter((s) => s.status === "approved");
  const admins = approved.filter((s) => s.roleInSchool === "school_admin");
  const teachers = approved.filter((s) => s.roleInSchool !== "school_admin");
  const pending = staff.filter((s) => s.status === "pending");

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <Users className="size-4" aria-hidden /> Funcionários vinculados
      </h3>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <MiniStat icon={ShieldCheck} label="Admins" value={admins.length} />
        <MiniStat icon={GraduationCap} label="Professores" value={teachers.length} />
        <MiniStat icon={Clock} label="Pendentes" value={pending.length} />
      </div>

      {staffQ.isLoading ? (
        <Loading />
      ) : staff.length === 0 ? (
        <EmptyState title="Nenhum funcionário vinculado" />
      ) : (
        <ul className="space-y-1">
          {staff.map((s) => (
            <li key={s.membershipId} className="flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.name || "Sem nome"}</div>
                <div className="text-xs text-muted-foreground truncate">{s.email}</div>
              </div>
              <Badge variant="outline" className="text-[11px]">
                {ROLE_LABEL[s.roleInSchool] ?? s.roleInSchool}
              </Badge>
              <Badge
                variant={s.status === "approved" ? "default" : s.status === "pending" ? "secondary" : "destructive"}
                className="text-[11px]"
              >
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3 text-center">
        <Icon className="size-4 mx-auto text-primary mb-1" aria-hidden />
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
