import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users, ShieldCheck, GraduationCap, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/States";
import { listSchoolStaff, setMembershipRole, getMySchoolRole } from "@/lib/schoolAdmin";
import { ROLE_LABEL, SCHOOL_ROLES, roleLabel, type SchoolRole } from "@/lib/roles";

const STATUS_LABEL: Record<string, string> = {
  approved: "Ativo",
  pending: "Pendente",
  rejected: "Recusado",
  blocked: "Bloqueado",
};

export function SchoolStaffSection({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const staffQ = useQuery({
    queryKey: ["school-staff", schoolId],
    queryFn: () => listSchoolStaff(schoolId),
    staleTime: 30_000,
  });

  const myRoleQ = useQuery({
    queryKey: ["my-school-role", schoolId],
    queryFn: () => getMySchoolRole(schoolId),
    staleTime: 60_000,
  });

  const canManage = myRoleQ.data === "school_admin" || myRoleQ.data === "master";

  const staff = staffQ.data ?? [];
  const approved = staff.filter((s) => s.status === "approved");
  const admins = approved.filter((s) => s.roleInSchool === "school_admin");
  const coordinators = approved.filter((s) => s.roleInSchool === "coordinator");
  const teachers = approved.filter((s) => s.roleInSchool === "teacher");
  const pending = staff.filter((s) => s.status === "pending");

  const changeRole = async (membershipId: string, role: SchoolRole) => {
    setSavingId(membershipId);
    try {
      await setMembershipRole(membershipId, role);
      toast.success(`Papel alterado para ${ROLE_LABEL[role]}.`);
      await qc.invalidateQueries({ queryKey: ["school-staff", schoolId] });
      await qc.invalidateQueries({ queryKey: ["school-usage", schoolId] });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o papel.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <Users className="size-4" aria-hidden /> Funcionários vinculados
      </h3>

      <p className="text-xs text-muted-foreground mb-2">
        Seu acesso nesta escola: <strong>{roleLabel(myRoleQ.data)}</strong>
      </p>

      <div className="grid grid-cols-4 gap-2 mb-2">
        <MiniStat icon={ShieldCheck} label="Admins" value={admins.length} />
        <MiniStat icon={Users} label="Coord." value={coordinators.length} />
        <MiniStat icon={GraduationCap} label="Prof." value={teachers.length} />
        <MiniStat icon={Clock} label="Pend." value={pending.length} />
      </div>

      {staffQ.isLoading ? (
        <Loading />
      ) : staff.length === 0 ? (
        <EmptyState title="Nenhum funcionário vinculado" />
      ) : (
        <ul className="space-y-1">
          {staff.map((s) => (
            <li key={s.membershipId} className="rounded-lg border bg-card p-2.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.name || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                </div>
                {!canManage && (
                  <Badge variant="outline" className="text-[11px]">
                    {roleLabel(s.roleInSchool)}
                  </Badge>
                )}
                <Badge
                  variant={
                    s.status === "approved" ? "default" : s.status === "pending" ? "secondary" : "destructive"
                  }
                  className="text-[11px]"
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </Badge>
              </div>

              {canManage && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0">Papel</span>
                  <select
                    className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
                    aria-label={`Papel de ${s.name || s.email}`}
                    value={s.roleInSchool}
                    disabled={savingId === s.membershipId}
                    onChange={(e) => changeRole(s.membershipId, e.target.value as SchoolRole)}
                  >
                    {SCHOOL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
