import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { listMembershipsForUser, listMembershipsForSchool, setMembershipStatus } from "@/lib/memberships";
import { getSchool } from "@/lib/schools";
import { getUserDoc } from "@/lib/users";
import { Loading, EmptyState } from "@/components/States";
import type { MembershipDoc, SchoolDoc, UserDoc } from "@/lib/types";

export const Route = createFileRoute("/app/escola")({
  component: SchoolAdminPage,
});

function SchoolAdminPage() {
  const { firebaseUser, userDoc } = useAuth();
  const qc = useQueryClient();

  // School admin: find the school(s) they admin (approved membership as school_admin)
  const myMemQ = useQuery({
    queryKey: ["my-memberships", firebaseUser?.uid],
    queryFn: () => listMembershipsForUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const adminSchoolIds = (myMemQ.data ?? [])
    .filter((m) => m.roleInSchool === "school_admin")
    .map((m) => m.schoolId);

  const schoolsQ = useQuery({
    queryKey: ["admin-schools", adminSchoolIds.join(",")],
    queryFn: async () =>
      (await Promise.all(adminSchoolIds.map((id) => getSchool(id)))).filter(Boolean) as SchoolDoc[],
    enabled: adminSchoolIds.length > 0,
  });

  if (!userDoc) return null;

  return (
    <AppShell title="Minha escola">
      {myMemQ.isLoading ? (
        <Loading />
      ) : adminSchoolIds.length === 0 ? (
        <EmptyState
          title="Você não administra nenhuma escola"
          description="Para gerenciar uma escola, crie uma nova no cadastro ou peça vínculo como administrador."
        />
      ) : (
        (schoolsQ.data ?? []).map((s) => (
          <SchoolAdminCard key={s.id} school={s} onChanged={() => qc.invalidateQueries()} />
        ))
      )}
    </AppShell>
  );
}

function SchoolAdminCard({ school, onChanged }: { school: SchoolDoc; onChanged: () => void }) {
  const { firebaseUser } = useAuth();
  const memsQ = useQuery({
    queryKey: ["school-memberships", school.id],
    queryFn: () => listMembershipsForSchool(school.id),
  });

  const usersQ = useQuery({
    queryKey: ["mem-users", school.id, memsQ.data?.map((m) => m.userId).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set((memsQ.data ?? []).map((m) => m.userId)));
      const users = await Promise.all(ids.map((id) => getUserDoc(id)));
      return Object.fromEntries(users.filter(Boolean).map((u) => [u!.id, u!])) as Record<string, UserDoc>;
    },
    enabled: !!memsQ.data,
  });

  const pending = (memsQ.data ?? []).filter((m) => m.status === "pending");
  const approved = (memsQ.data ?? []).filter((m) => m.status === "approved");

  const decide = async (m: MembershipDoc, status: "approved" | "rejected") => {
    try {
      await setMembershipStatus(m.id, status, firebaseUser?.uid);
      toast.success(status === "approved" ? "Aprovado!" : "Rejeitado.");
      memsQ.refetch();
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar.");
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-5 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{school.name}</div>
            <div className="text-xs text-muted-foreground capitalize">
              Status: {school.status}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Membros</div>
            <div className="font-bold">{approved.length}</div>
          </div>
        </CardContent>
      </Card>

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Solicitações pendentes
        </h3>
        {memsQ.isLoading ? (
          <Loading />
        ) : pending.length === 0 ? (
          <EmptyState title="Nenhuma solicitação pendente" />
        ) : (
          <div className="space-y-2">
            {pending.map((m) => {
              const u = usersQ.data?.[m.userId];
              return (
                <Card key={m.id}>
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u?.name ?? "Usuário"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u?.email} · {m.roleInSchool}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => decide(m, "rejected")}>
                      <X className="size-4" />
                    </Button>
                    <Button size="sm" onClick={() => decide(m, "approved")}>
                      <Check className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Membros aprovados
        </h3>
        {approved.length === 0 ? (
          <EmptyState title="Ainda sem membros aprovados" />
        ) : (
          <div className="space-y-2">
            {approved.map((m) => {
              const u = usersQ.data?.[m.userId];
              return (
                <Card key={m.id}>
                  <CardContent className="pt-3 pb-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u?.name ?? "Usuário"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u?.email} · {m.roleInSchool}
                      </div>
                    </div>
                    <RemoveAdminButton membership={m} onDone={() => memsQ.refetch()} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function RemoveAdminButton({
  membership,
  onDone,
}: {
  membership: MembershipDoc;
  onDone: () => void;
}) {
  const { userDoc } = useAuth();
  const isMaster = userDoc?.globalRole === "master";
  const isAdminRow = membership.roleInSchool === "school_admin";
  // Master can remove anyone; school_admin can remove non-admin members; admins of the school can't remove other admins.
  const canRemove = isMaster || !isAdminRow;
  if (!canRemove) return null;
  const onClick = async () => {
    if (!confirm("Remover este membro da escola?")) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("school_memberships").delete().eq("id", membership.id);
      if (error) throw error;
      toast.success("Membro removido.");
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover.");
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <X className="size-4" />
    </Button>
  );
}
