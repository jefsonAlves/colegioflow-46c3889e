import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Edit3, LogOut, Save, X, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/integrations/firebase/auth";
import { updateUserProfile } from "@/lib/users";
import { listMembershipsForUser, requestMembership } from "@/lib/memberships";
import { getSchool } from "@/lib/schools";
import { listClasses } from "@/lib/classes";
import { listMyTaughtClasses, teachClass, untaughtClass } from "@/lib/classTeachers";
import { SchoolPicker } from "@/components/SchoolPicker";
import type { ProfileType, RoleInSchool, SchoolDoc } from "@/lib/types";

export const Route = createFileRoute("/app/perfil")({
  component: PerfilPage,
});

const PROFILE_LABEL: Record<ProfileType, string> = {
  teacher: "Professor(a)",
  school_admin: "Administrador da Escola",
  parent: "Pai / Responsável",
};

function PerfilPage() {
  const { userDoc, firebaseUser, refresh } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [pickingSchool, setPickingSchool] = useState(false);
  const [name, setName] = useState(userDoc?.name ?? "");
  const [profileType, setProfileType] = useState<ProfileType | undefined>(
    userDoc?.profileType,
  );
  const [saving, setSaving] = useState(false);

  const memQ = useQuery({
    queryKey: ["memberships", firebaseUser?.uid],
    queryFn: () => listMembershipsForUser(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const schoolsQ = useQuery({
    queryKey: ["perfil-schools", memQ.data?.map((m) => m.schoolId).join(",")],
    queryFn: async () => {
      const list = await Promise.all((memQ.data ?? []).map((m) => getSchool(m.schoolId)));
      return list.filter(Boolean) as SchoolDoc[];
    },
    enabled: !!memQ.data,
  });

  if (!userDoc) return null;

  const startEdit = () => {
    setName(userDoc.name);
    setProfileType(userDoc.profileType);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setPickingSchool(false);
  };

  const save = async () => {
    if (!firebaseUser) return;
    if (name.trim().length < 3) {
      toast.error("Informe um nome com pelo menos 3 letras.");
      return;
    }
    if (!profileType) {
      toast.error("Escolha o tipo de perfil.");
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(firebaseUser.uid, {
        name: name.trim(),
        profileType,
        onboardingComplete: true,
      });
      await refresh();
      toast.success("Perfil atualizado!");
      setEditing(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const linkSchool = async (schoolId: string) => {
    if (!firebaseUser || !profileType) return;
    setSaving(true);
    try {
      const role: RoleInSchool = profileType === "school_admin" ? "school_admin" : "teacher";
      await requestMembership({
        schoolId,
        userId: firebaseUser.uid,
        roleInSchool: role,
        autoApprove: userDoc.globalRole === "master",
      });
      toast.success(
        userDoc.globalRole === "master"
          ? "Escola vinculada!"
          : "Solicitação enviada! Aguarde aprovação.",
      );
      setPickingSchool(false);
      qc.invalidateQueries({ queryKey: ["memberships", firebaseUser.uid] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao vincular escola.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const memberships = memQ.data ?? [];
  const schoolById = new Map((schoolsQ.data ?? []).map((s) => [s.id, s] as const));

  return (
    <AppShell title="Meu perfil">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            {firebaseUser?.photoURL ? (
              <img src={firebaseUser.photoURL} alt="" className="size-14 rounded-full" />
            ) : (
              <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {userDoc.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{userDoc.name || "Sem nome"}</div>
              <div className="text-sm text-muted-foreground truncate">{userDoc.email}</div>
            </div>
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Edit3 className="size-4" /> Editar
              </Button>
            )}
          </div>

          {!editing ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Perfil</div>
                <div className="font-medium">
                  {userDoc.profileType ? PROFILE_LABEL[userDoc.profileType] : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Papel global</div>
                <div className="font-medium capitalize">{userDoc.globalRole}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de perfil</Label>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      ["teacher", "Sou Professor(a)"],
                      ["school_admin", "Sou Administrador da Escola"],
                      ["parent", "Sou Pai / Responsável"],
                    ] as [ProfileType, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setProfileType(v)}
                      className={`text-left rounded-lg border p-2.5 text-sm ${
                        profileType === v ? "border-primary bg-primary/5" : "bg-card"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={cancelEdit}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button className="flex-1" disabled={saving} onClick={save}>
                  <Save className="size-4" /> Salvar
                </Button>
              </div>
              {!userDoc.onboardingComplete && (
                <p className="text-xs text-muted-foreground text-center">
                  Salve para concluir seu cadastro.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Escolas
        </h2>
        {memQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : memberships.length === 0 ? (
          <Card>
            <CardContent className="pt-5 pb-5 text-sm text-muted-foreground text-center">
              Você ainda não está vinculado a nenhuma escola.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => {
              const s = schoolById.get(m.schoolId);
              return (
                <Card key={m.id}>
                  <CardContent className="pt-4 pb-4 flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{s?.name ?? "Escola"}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {m.status === "pending"
                          ? "Aguardando aprovação"
                          : m.status === "approved"
                            ? `Ativo · ${m.roleInSchool}`
                            : m.status}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {profileType && profileType !== "parent" && !pickingSchool && (
          <Button variant="outline" className="w-full" onClick={() => setPickingSchool(true)}>
            <Building2 className="size-4" /> Vincular outra escola
          </Button>
        )}

        {pickingSchool && (
          <SchoolPicker
            isMaster={userDoc.globalRole === "master"}
            createdBy={firebaseUser!.uid}
            saving={saving}
            onSelect={linkSchool}
            onCancel={() => setPickingSchool(false)}
          />
        )}
      </section>

      {userDoc.profileType === "teacher" && memberships.some((m) => m.status === "approved") && (
        <MyTaughtClassesSection
          schools={memberships
            .filter((m) => m.status === "approved")
            .map((m) => m.schoolId)}
        />
      )}

      <Button variant="outline" className="w-full h-12" onClick={handleLogout}>
        <LogOut className="size-4" /> Sair
      </Button>
    </AppShell>
  );
}

function MyTaughtClassesSection({ schools }: { schools: string[] }) {
  const { firebaseUser } = useAuth();
  const qc = useQueryClient();

  const allClassesQ = useQuery({
    queryKey: ["all-classes-for-teacher", schools.join(",")],
    queryFn: async () => {
      const lists = await Promise.all(schools.map((sid) => listClasses(sid).then((cs) => cs.map((c) => ({ ...c, schoolId: sid })))));
      return lists.flat();
    },
    enabled: schools.length > 0,
  });

  const taughtQ = useQuery({
    queryKey: ["my-taught-classes", firebaseUser?.uid],
    queryFn: () => listMyTaughtClasses(firebaseUser!.uid),
    enabled: !!firebaseUser,
  });

  const taughtIds = new Set((taughtQ.data ?? []).map((t) => t.classId));

  const toggle = async (classId: string, schoolId: string, on: boolean) => {
    if (!firebaseUser) return;
    try {
      if (on) {
        await teachClass({ classId, schoolId, userId: firebaseUser.uid });
      } else {
        await untaughtClass({ classId, userId: firebaseUser.uid });
      }
      qc.invalidateQueries({ queryKey: ["my-taught-classes", firebaseUser.uid] });
      qc.invalidateQueries({ queryKey: ["class-teachers", classId] });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar.");
    }
  };

  const classes = allClassesQ.data ?? [];

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Minhas turmas
      </h2>
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Marque as turmas em que você dá aula. Depois cadastre matéria e horário em cada
            turma.
          </p>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhuma turma cadastrada na escola ainda.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {classes.map((c) => {
                const on = taughtIds.has(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <GraduationCap className="size-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.gradeLevel ? `${c.gradeLevel} · ` : ""}{c.year}
                      </div>
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => toggle(c.id, c.schoolId, v)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/app/turmas" className="block">
            <Button variant="outline" size="sm" className="w-full mt-1">
              Cadastrar matéria e horários
            </Button>
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
