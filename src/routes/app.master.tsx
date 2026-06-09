import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Check,
  Database,
  Download,
  Merge,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
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
  getSchool,
} from "@/lib/schools";
import { Loading, EmptyState } from "@/components/States";
import {
  deleteImportSource,
  importExternalData,
  listImportSources,
  previewExternalData,
  previewImportSource,
  runImportSource,
  upsertImportSource,
  type ImportSourceRow,
} from "@/lib/import.functions";
import { supabase } from "@/integrations/supabase/client";
import { setMembershipStatus } from "@/lib/memberships";
import { getUserDoc } from "@/lib/users";
import type { MembershipDoc, SchoolDoc, UserDoc } from "@/lib/types";

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

      <AdminRequestsSection />

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

function AdminRequestsSection() {
  const qc = useQueryClient();
  const reqQ = useQuery({
    queryKey: ["master-admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_memberships")
        .select("*")
        .eq("status", "pending")
        .eq("role_in_school", "school_admin");
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        school_id: string;
        user_id: string;
        role_in_school: string;
        status: string;
        approved_by: string | null;
        created_at: string;
      }>;
      const memberships: MembershipDoc[] = rows.map((r) => ({
        id: r.id,
        schoolId: r.school_id,
        userId: r.user_id,
        roleInSchool: r.role_in_school as MembershipDoc["roleInSchool"],
        status: r.status as MembershipDoc["status"],
        approvedBy: r.approved_by ?? undefined,
        createdAt: new Date(r.created_at).getTime(),
      }));
      const userIds = Array.from(new Set(memberships.map((m) => m.userId)));
      const schoolIds = Array.from(new Set(memberships.map((m) => m.schoolId)));
      const [users, schools] = await Promise.all([
        Promise.all(userIds.map((id) => getUserDoc(id))),
        Promise.all(schoolIds.map((id) => getSchool(id))),
      ]);
      const usersById = Object.fromEntries(
        users.filter(Boolean).map((u) => [u!.id, u!]),
      ) as Record<string, UserDoc>;
      const schoolsById = Object.fromEntries(
        schools.filter(Boolean).map((s) => [s!.id, s!]),
      ) as Record<string, SchoolDoc>;
      return memberships.map((m) => ({
        m,
        user: usersById[m.userId],
        school: schoolsById[m.schoolId],
      }));
    },
  });

  const decide = async (id: string, status: "approved" | "rejected") => {
    try {
      await setMembershipStatus(id, status);
      toast.success(status === "approved" ? "Administrador aprovado." : "Solicitação rejeitada.");
      qc.invalidateQueries({ queryKey: ["master-admin-requests"] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar.");
    }
  };

  const items = reqQ.data ?? [];
  return (
    <Section title="Pedidos de admin de escola">
      {reqQ.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="Nenhum pedido pendente" />
      ) : (
        <div className="space-y-2">
          {items.map(({ m, user, school }) => (
            <Card key={m.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <ShieldCheck className="size-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user?.name ?? "Usuário"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user?.email} · {school?.name ?? "Escola"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => decide(m.id, "rejected")}>
                  <X className="size-4" />
                </Button>
                <Button size="sm" onClick={() => decide(m.id, "approved")}>
                  <Check className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

type PreviewResult = Awaited<ReturnType<typeof previewExternalData>>;

function ImportExternalCard({ schools }: { schools: SchoolDoc[] }) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const runPreview = useServerFn(previewExternalData);
  const runImport = useServerFn(importExternalData);

  const previewMut = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("Selecione uma escola de destino.");
      return runPreview({ data: { baseUrl, apiKey, schoolId } });
    },
    onSuccess: (res) => {
      setPreview(res);
      toast.success("Prévia carregada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Carregue a prévia antes de aplicar.");
      if (!confirm("Aplicar a importação? Esta ação não pode ser desfeita.")) {
        throw new Error("Importação cancelada.");
      }
      return runImport({ data: { baseUrl, apiKey, schoolId } });
    },
    onSuccess: (res) => {
      toast.success(
        `Importação concluída: ${res.report.students.linked} vinculados, ${res.report.students.created} criados.`,
      );
      setPreview(null);
    },
    onError: (e: Error) => {
      if (e.message !== "Importação cancelada.") toast.error(e.message);
    },
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
              Vincular alunos existentes por matrícula e trazer frequências/notas
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
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setPreview(null);
                }}
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
              Esperado:{" "}
              <code>
                {`{ students:[{matricula,external_id,name}], attendance:[{student_matricula,date,present}], grades:[{student_matricula,subject,value,trimester}] }`}
              </code>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={previewMut.isPending}
                onClick={() => previewMut.mutate()}
              >
                Carregar prévia
              </Button>
              <Button
                className="flex-1"
                disabled={!preview || importMut.isPending}
                onClick={() => importMut.mutate()}
              >
                Aplicar importação
              </Button>
            </div>

            {preview && <PreviewView preview={preview} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewView({ preview }: { preview: PreviewResult }) {
  return (
    <div className="space-y-3 pt-2 border-t">
      <div>
        <h4 className="text-sm font-semibold mb-1">
          Alunos a vincular ({preview.students.toLink.length})
        </h4>
        {preview.students.toLink.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum</p>
        ) : (
          <ul className="text-xs space-y-1 max-h-40 overflow-auto">
            {preview.students.toLink.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {l.existingName} ← {l.payloadName}
                </span>
                <span className="text-muted-foreground shrink-0">{l.matchedBy}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-1">
          Alunos novos a criar ({preview.students.toCreate.length})
        </h4>
        {preview.students.toCreate.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum</p>
        ) : (
          <ul className="text-xs space-y-1 max-h-40 overflow-auto">
            {preview.students.toCreate.map((s, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{s.name}</span>
                <span className="text-muted-foreground shrink-0">{s.matricula ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="font-semibold mb-1">Frequência</div>
            <div>Total: {preview.attendance.total}</div>
            <div>Resolvido: {preview.attendance.resolved + preview.attendance.willResolve}</div>
            <div className="text-destructive">Órfão: {preview.attendance.orphan}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="font-semibold mb-1">Notas</div>
            <div>Total: {preview.grades.total}</div>
            <div>Resolvido: {preview.grades.resolved + preview.grades.willResolve}</div>
            <div className="text-destructive">Órfão: {preview.grades.orphan}</div>
          </CardContent>
        </Card>
      </div>
      <Textarea
        readOnly
        value={JSON.stringify(preview, null, 2)}
        className="font-mono text-xs h-32"
      />
    </div>
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
