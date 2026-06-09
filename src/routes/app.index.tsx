import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, ClipboardList, GraduationCap, Megaphone, NotebookPen, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { listMembershipsForUser } from "@/lib/memberships";
import { getSchool } from "@/lib/schools";
import { Loading, EmptyState } from "@/components/States";
import type { MembershipDoc, SchoolDoc } from "@/lib/types";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const { userDoc } = useAuth();

  if (!userDoc) return null;

  if (userDoc.profileType === "parent") return <ParentDashboard />;
  // Teacher and school_admin both see teacher-style home (admin also has /app/escola)
  return <TeacherDashboard />;
}

function TeacherDashboard() {
  const { firebaseUser, userDoc } = useAuth();
  const [activeSchool, setActiveSchool] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem("activeSchool") : null),
  );

  const memQ = useQuery({
    queryKey: ["memberships", firebaseUser?.uid],
    queryFn: () => listMembershipsForUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const schoolsQ = useQuery({
    queryKey: ["schools-from-memberships", memQ.data?.map((m) => m.schoolId).join(",")],
    queryFn: async () => {
      const list = await Promise.all((memQ.data ?? []).map((m) => getSchool(m.schoolId)));
      return list.filter(Boolean) as SchoolDoc[];
    },
    enabled: !!memQ.data,
  });

  useEffect(() => {
    if (activeSchool) localStorage.setItem("activeSchool", activeSchool);
  }, [activeSchool]);

  const approved = (memQ.data ?? []).filter((m) => m.status === "approved");
  const pending = (memQ.data ?? []).filter((m) => m.status === "pending");

  return (
    <AppShell title={`Olá, ${userDoc?.name.split(" ")[0] ?? ""}`}>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Minhas escolas
        </h2>
        {memQ.isLoading ? (
          <Loading />
        ) : (memQ.data ?? []).length === 0 ? (
          <EmptyState
            title="Sem escolas ainda"
            description="Você ainda não está vinculado a nenhuma escola."
          />
        ) : (
          <div className="space-y-2">
            {(schoolsQ.data ?? []).map((s) => {
              const mem = (memQ.data ?? []).find((m) => m.schoolId === s.id);
              const isActive = activeSchool === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => mem?.status === "approved" && setActiveSchool(s.id)}
                  className={`w-full text-left rounded-xl border p-4 transition flex items-center gap-3 ${
                    isActive ? "border-primary bg-primary/5" : "bg-card"
                  }`}
                >
                  <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {mem?.status === "approved"
                        ? isActive
                          ? "Escola ativa"
                          : "Toque para ativar"
                        : mem?.status === "pending"
                          ? "Aguardando aprovação"
                          : mem?.status}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {pending.length > 0 && approved.length === 0 && (
          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="pt-4 text-sm">
              Suas solicitações estão aguardando aprovação do administrador da escola.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Ações
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: "Turmas" },
            { icon: ClipboardList, label: "Chamada" },
            { icon: NotebookPen, label: "Notas" },
            { icon: GraduationCap, label: "Relatórios" },
            { icon: Megaphone, label: "Avisos" },
          ].map((a) => (
            <Card key={a.label} className="opacity-60">
              <CardContent className="pt-4 pb-4 flex flex-col gap-2 items-start">
                <a.icon className="size-6 text-primary" />
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">Em breve</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function ParentDashboard() {
  return (
    <AppShell title="Família">
      <EmptyState
        title="Vínculo com aluno em breve"
        description="O vínculo com seus filhos será liberado na próxima atualização do aplicativo."
      />
    </AppShell>
  );
}
