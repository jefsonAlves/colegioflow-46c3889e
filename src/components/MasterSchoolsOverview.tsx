import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Search, Save, Users, GraduationCap, Layers, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loading, EmptyState } from "@/components/States";
import { PlanUsageCard } from "@/components/PlanUsageCard";
import { SchoolStaffSection } from "@/components/SchoolStaffSection";
import { listMasterSchoolsOverview, setSchoolPlan, type SchoolOverview } from "@/lib/schoolAdmin";
import {
  PLAN_DEFAULT_LIMITS,
  PLAN_LABEL,
  PLAN_ORDER,
  PLAN_STATUS_LABEL,
  type PlanKey,
  type PlanStatus,
} from "@/lib/plans";

export function MasterSchoolsOverview() {
  const overviewQ = useQuery({
    queryKey: ["master-schools-overview"],
    queryFn: () => listMasterSchoolsOverview(),
    staleTime: 30_000,
  });
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = overviewQ.data ?? [];
    const term = filter.trim().toLocaleLowerCase("pt-BR");
    if (!term) return list;
    return list.filter((r) => r.name.toLocaleLowerCase("pt-BR").includes(term));
  }, [overviewQ.data, filter]);

  const totals = useMemo(() => {
    const list = overviewQ.data ?? [];
    return {
      schools: list.length,
      staff: list.reduce((a, r) => a + r.staffCount, 0),
      students: list.reduce((a, r) => a + r.studentCount, 0),
      pending: list.reduce((a, r) => a + r.pendingCount, 0),
    };
  }, [overviewQ.data]);

  return (
    <section>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Acompanhamento das escolas
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <Total icon={Building2} label="Escolas" value={totals.schools} />
        <Total icon={Users} label="Funcionários" value={totals.staff} />
        <Total icon={GraduationCap} label="Alunos" value={totals.students} />
        <Total icon={Clock} label="Pendências" value={totals.pending} />
      </div>

      <div className="relative mb-2">
        <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="pl-8"
          placeholder="Buscar escola..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Buscar escola"
        />
      </div>

      {overviewQ.isLoading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhuma escola encontrada" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.schoolId}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <button
                  type="button"
                  className="w-full text-left flex items-start gap-3"
                  onClick={() => setOpenId(openId === r.schoolId ? null : r.schoolId)}
                  aria-expanded={openId === r.schoolId}
                >
                  <Building2 className="size-5 text-primary mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[r.city, r.state].filter(Boolean).join(" / ") || "Sem localização"}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant={r.planStatus === "suspended" ? "destructive" : "default"} className="text-[11px]">
                        {PLAN_LABEL[r.plan]} · {PLAN_STATUS_LABEL[r.planStatus]}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        <Users className="size-3 mr-1" aria-hidden /> {r.staffCount}/{r.maxStaff}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        <GraduationCap className="size-3 mr-1" aria-hidden /> {r.studentCount}/{r.maxStudents}
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        <Layers className="size-3 mr-1" aria-hidden /> {r.classCount}
                      </Badge>
                      {r.pendingCount > 0 && (
                        <Badge variant="secondary" className="text-[11px]">
                          {r.pendingCount} pendente(s)
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>

                {openId === r.schoolId && (
                  <div className="space-y-3 border-t pt-3">
                    <PlanUsageCard
                      plan={r.plan}
                      planStatus={r.planStatus}
                      planExpiresAt={r.planExpiresAt}
                      staffCount={r.staffCount}
                      maxStaff={r.maxStaff}
                      studentCount={r.studentCount}
                      maxStudents={r.maxStudents}
                      classCount={r.classCount}
                      pendingCount={r.pendingCount}
                    />
                    <PlanEditor row={r} />
                    <SchoolStaffSection schoolId={r.schoolId} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function PlanEditor({ row }: { row: SchoolOverview }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<PlanKey>(row.plan);
  const [status, setStatus] = useState<PlanStatus>(row.planStatus);
  const [expires, setExpires] = useState(row.planExpiresAt ?? "");
  const [maxStaff, setMaxStaff] = useState(String(row.maxStaff));
  const [maxStudents, setMaxStudents] = useState(String(row.maxStudents));
  const [notes, setNotes] = useState(row.masterNotes ?? "");
  const [saving, setSaving] = useState(false);

  const applyPlanDefaults = (next: PlanKey) => {
    setPlan(next);
    setMaxStaff(String(PLAN_DEFAULT_LIMITS[next].maxStaff));
    setMaxStudents(String(PLAN_DEFAULT_LIMITS[next].maxStudents));
  };

  const save = async () => {
    setSaving(true);
    try {
      await setSchoolPlan({
        schoolId: row.schoolId,
        plan,
        planStatus: status,
        planExpiresAt: expires || null,
        maxStaff: Number(maxStaff) || PLAN_DEFAULT_LIMITS[plan].maxStaff,
        maxStudents: Number(maxStudents) || PLAN_DEFAULT_LIMITS[plan].maxStudents,
        masterNotes: notes.trim() || null,
      });
      toast.success("Plano atualizado.");
      qc.invalidateQueries({ queryKey: ["master-schools-overview"] });
      qc.invalidateQueries({ queryKey: ["school-usage", row.schoolId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`plan-${row.schoolId}`}>Plano</Label>
          <select
            id={`plan-${row.schoolId}`}
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={plan}
            onChange={(e) => applyPlanDefaults(e.target.value as PlanKey)}
          >
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`status-${row.schoolId}`}>Situação</Label>
          <select
            id={`status-${row.schoolId}`}
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as PlanStatus)}
          >
            {(["active", "trial", "suspended"] as PlanStatus[]).map((s) => (
              <option key={s} value={s}>
                {PLAN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`exp-${row.schoolId}`}>Validade</Label>
          <Input id={`exp-${row.schoolId}`} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`ms-${row.schoolId}`}>Máx. funcionários</Label>
            <Input
              id={`ms-${row.schoolId}`}
              type="number"
              min={1}
              value={maxStaff}
              onChange={(e) => setMaxStaff(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`mst-${row.schoolId}`}>Máx. alunos</Label>
            <Input
              id={`mst-${row.schoolId}`}
              type="number"
              min={1}
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`notes-${row.schoolId}`}>Observações internas</Label>
        <Textarea
          id={`notes-${row.schoolId}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contato, cobrança, combinados..."
        />
      </div>
      <Button className="w-full" onClick={save} disabled={saving}>
        <Save className="size-4" /> {saving ? "Salvando..." : "Salvar plano"}
      </Button>
    </div>
  );
}

function Total({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
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
