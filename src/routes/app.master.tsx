import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Database, Merge, X } from "lucide-react";

import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { groupPossibleDuplicates, listAllSchoolsForMaster, mergeSchools, setSchoolStatus } from "@/lib/schools";
import { Loading, EmptyState } from "@/components/States";
import type { SchoolDoc } from "@/lib/types";

export const Route = createFileRoute("/app/master")({
  component: MasterPage,
});

function MasterPage() {
  const { userDoc } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (userDoc && userDoc.globalRole !== "master") navigate({ to: "/app" });
  }, [userDoc, navigate]);

  const schoolsQ = useQuery({
    queryKey: ["all-schools"],
    queryFn: () => listAllSchoolsForMaster(),
    enabled: userDoc?.globalRole === "master",
  });

  const schools = schoolsQ.data ?? [];
  const pending = schools.filter((s) => s.status === "pending");
  const active = schools.filter((s) => s.status === "active");
  const blocked = schools.filter((s) => s.status === "blocked");
  const duplicates = useMemo(() => groupPossibleDuplicates(schools), [schools]);

  const decideSchool = async (s: SchoolDoc, status: "active" | "blocked") => {
    try {
      await setSchoolStatus(s.id, status);
      toast.success(status === "active" ? "Escola aprovada." : "Escola bloqueada.");
      qc.invalidateQueries({ queryKey: ["all-schools"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar escola.");
    }
  };

  const doMerge = async (group: SchoolDoc[]) => {
    const [target, ...rest] = group;
    try {
      for (const src of rest) await mergeSchools(src.id, target.id);
      toast.success(`Mescladas em "${target.name}".`);
      qc.invalidateQueries({ queryKey: ["all-schools"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao mesclar.");
    }
  };

  if (!userDoc || userDoc.globalRole !== "master") return null;

  return (
    <AppShell title="Painel Master">
      <Link to="/app/master/migracao" className="block">
        <Card className="border-primary/30 hover:bg-primary/5 transition">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Database className="size-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">Migração de dados</div>
              <div className="text-xs text-muted-foreground">
                Mesclar dados do app antigo (RTDB + Firestore)
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Ativas" value={active.length} />
        <Stat label="Pendentes" value={pending.length} />
        <Stat label="Bloqueadas" value={blocked.length} />
      </div>

      <Section title="Escolas pendentes">
        {schoolsQ.isLoading ? (
          <Loading />
        ) : pending.length === 0 ? (
          <EmptyState title="Nenhuma escola pendente" />
        ) : (
          <div className="space-y-2">
            {pending.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Building2 className="size-5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => decideSchool(s, "blocked")}>
                    <X className="size-4" />
                  </Button>
                  <Button size="sm" onClick={() => decideSchool(s, "active")}>
                    <Check className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Possíveis duplicatas">
        {duplicates.length === 0 ? (
          <EmptyState title="Nenhuma duplicata detectada" />
        ) : (
          <div className="space-y-3">
            {duplicates.map((group, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-4 space-y-2">
                  {group.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">
                        {idx === 0 ? "Manter" : "Mesclar"}
                      </span>
                      <span className="truncate flex-1">{s.name}</span>
                    </div>
                  ))}
                  <Button size="sm" className="w-full" onClick={() => doMerge(group)}>
                    <Merge className="size-4" /> Mesclar em "{group[0].name}"
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Todas as escolas">
        <div className="space-y-2">
          {active.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <Building2 className="size-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{s.status}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => decideSchool(s, "blocked")}>
                  Bloquear
                </Button>
              </CardContent>
            </Card>
          ))}
          {blocked.map((s) => (
            <Card key={s.id} className="opacity-70">
              <CardContent className="pt-3 pb-3 flex items-center gap-3">
                <Building2 className="size-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-destructive">Bloqueada</div>
                </div>
                <Button size="sm" onClick={() => decideSchool(s, "active")}>
                  Reativar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <div className="text-2xl font-bold text-primary">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}
