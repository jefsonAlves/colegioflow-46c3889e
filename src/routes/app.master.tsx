import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, Database, Download, Merge, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  groupPossibleDuplicates,
  listAllSchoolsForMaster,
  mergeSchools,
  setSchoolStatus,
} from "@/lib/schools";
import { Loading, EmptyState } from "@/components/States";
import { importExternalData } from "@/lib/import.functions";
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

      <ImportExternalCard schools={active} />

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

function ImportExternalCard({ schools }: { schools: SchoolDoc[] }) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const runImport = useServerFn(importExternalData);

  const mut = useMutation({
    mutationFn: async (dryRun: boolean) => {
      if (!schoolId) throw new Error("Selecione uma escola de destino.");
      return runImport({ data: { baseUrl, apiKey, schoolId, dryRun } });
    },
    onSuccess: (res) => {
      setReport(JSON.stringify(res.report, null, 2));
      toast.success(res.dryRun ? "Pré-visualização gerada." : "Importação concluída.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4 pb-4 space-y-3">
        <button
          className="w-full flex items-center gap-3 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <Download className="size-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Importar dados externos</div>
            <div className="text-xs text-muted-foreground">
              Trazer alunos, frequências e notas de outro sistema via API
            </div>
          </div>
        </button>

        {open && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label>Endpoint (URL JSON)</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.exemplo.com/exportar"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Key (Bearer)</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Escola de destino</Label>
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="w-full border rounded-md h-10 px-3 bg-background"
              >
                <option value="">— escolha —</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato esperado: <code>{`{ students:[{external_id,name,...}], attendance:[...], grades:[...] }`}</code>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={mut.isPending} onClick={() => mut.mutate(true)}>
                Pré-visualizar
              </Button>
              <Button className="flex-1" disabled={mut.isPending} onClick={() => mut.mutate(false)}>
                Importar
              </Button>
            </div>
            {report && (
              <Textarea readOnly value={report} className="font-mono text-xs h-48" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
