import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Building2, Check, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/lib/users";
import {
  createSchool,
  findSimilarSchools,
  searchSchoolsByPrefix,
} from "@/lib/schools";
import { requestMembership } from "@/lib/memberships";
import type { ProfileType, RoleInSchool, SchoolDoc } from "@/lib/types";
import { APP_NAME } from "@/lib/constants";
import { Loading } from "@/components/States";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: `${APP_NAME} — Cadastro` }] }),
  component: Onboarding,
});

type Step = 1 | 2 | 3;

function Onboarding() {
  const { loading, firebaseUser, userDoc, refresh } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      navigate({ to: "/login" });
      return;
    }
    if (userDoc?.onboardingComplete) {
      navigate({ to: "/app" });
      return;
    }
    if (userDoc && !name) setName(userDoc.name);
  }, [loading, firebaseUser, userDoc, navigate, name]);

  if (loading || !userDoc) return <Loading />;

  const finishWithoutSchool = async () => {
    if (!firebaseUser || !profileType) return;
    setSaving(true);
    try {
      await updateUserProfile(firebaseUser.uid, {
        name: name.trim(),
        profileType,
        onboardingComplete: true,
      });
      await refresh();
      toast.success("Cadastro concluído!");
      navigate({ to: "/app" });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar cadastro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 px-5 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Passo {step} de 3
          </p>
          <h1 className="text-2xl font-bold">Vamos conhecer você</h1>
        </header>

        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoFocus
                />
              </div>
              <Button
                className="w-full h-12"
                disabled={name.trim().length < 3}
                onClick={() => setStep(2)}
              >
                Continuar <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {[
              { v: "teacher" as const, label: "Sou Professor(a)", desc: "Faço chamada, lanço notas e relatórios." },
              { v: "school_admin" as const, label: "Sou Administrador da Escola", desc: "Gerencio professores, turmas e a escola." },
              { v: "parent" as const, label: "Sou Pai / Responsável", desc: "Acompanho meus filhos." },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setProfileType(opt.v)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  profileType === opt.v
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-sm text-muted-foreground">{opt.desc}</div>
                  </div>
                  {profileType === opt.v && <Check className="size-5 text-primary" />}
                </div>
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                className="flex-1 h-12"
                disabled={!profileType}
                onClick={() => {
                  if (profileType === "parent") {
                    finishWithoutSchool();
                  } else {
                    setStep(3);
                  }
                }}
              >
                {profileType === "parent" ? "Concluir" : "Continuar"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && profileType && profileType !== "parent" && (
          <SchoolStep
            profileType={profileType}
            onBack={() => setStep(2)}
            onDone={async (schoolId) => {
              if (!firebaseUser) return;
              setSaving(true);
              try {
                const role: RoleInSchool =
                  profileType === "school_admin" ? "school_admin" : "teacher";
                await requestMembership({
                  schoolId,
                  userId: firebaseUser.uid,
                  roleInSchool: role,
                });
                await updateUserProfile(firebaseUser.uid, {
                  name: name.trim(),
                  profileType,
                  onboardingComplete: true,
                });
                await refresh();
                toast.success("Solicitação enviada! Aguarde aprovação.");
                navigate({ to: "/app" });
              } catch (e) {
                console.error(e);
                toast.error("Erro ao vincular escola.");
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
            isMaster={userDoc.globalRole === "master"}
            createdBy={firebaseUser!.uid}
          />
        )}
      </div>
    </div>
  );
}

function SchoolStep({
  profileType,
  onBack,
  onDone,
  saving,
  isMaster,
  createdBy,
}: {
  profileType: ProfileType;
  onBack: () => void;
  onDone: (schoolId: string) => void;
  saving: boolean;
  isMaster: boolean;
  createdBy: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SchoolDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState<SchoolDoc[]>([]);
  const [confirmCreate, setConfirmCreate] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchSchoolsByPrefix(term, 20);
        setResults(r);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const startCreate = async () => {
    setNewName(term);
    setCreating(true);
    const sim = await findSimilarSchools(term);
    setSimilar(sim);
    setConfirmCreate(sim.length === 0);
  };

  const doCreate = async () => {
    const s = await createSchool({
      name: newName,
      createdBy,
      isMaster,
    });
    onDone(s.id);
  };

  if (creating) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label>Nome da escola</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          {similar.length > 0 && !confirmCreate && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Estas escolas parecem similares. É alguma delas?
              </p>
              <div className="space-y-2">
                {similar.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onDone(s.id)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted"
                  >
                    <div className="font-medium">{s.name}</div>
                    {(s.city || s.state) && (
                      <div className="text-xs text-muted-foreground">
                        {[s.city, s.state].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setConfirmCreate(true)}
              >
                Nenhuma destas — criar nova
              </Button>
            </div>
          )}
          {confirmCreate && (
            <Button className="w-full h-12" disabled={saving || newName.trim().length < 3} onClick={doCreate}>
              <Plus className="size-4" /> Criar escola
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setCreating(false)}>
            Voltar para a busca
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label>Busque sua escola</Label>
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome da escola"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {loading ? (
          <Loading label="Buscando..." />
        ) : results.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((s) => (
              <button
                key={s.id}
                disabled={saving}
                onClick={() => onDone(s.id)}
                className="w-full text-left rounded-lg border p-3 hover:bg-muted flex items-center gap-3"
              >
                <Building2 className="size-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {s.status === "pending" ? "Aguardando aprovação" : s.status}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : term.trim().length > 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma escola encontrada com este nome.
          </p>
        ) : null}

        {term.trim().length >= 3 && (
          <Button variant="outline" className="w-full" onClick={startCreate}>
            <Plus className="size-4" /> Criar "{term.trim()}"
          </Button>
        )}

        <Button variant="ghost" className="w-full" onClick={onBack}>
          Voltar
        </Button>
      </CardContent>
    </Card>
  );
}

// keep unused import warning at bay
void useMemo;
