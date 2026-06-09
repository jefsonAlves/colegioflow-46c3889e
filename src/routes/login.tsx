import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/integrations/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Entrar` },
      { name: "description", content: "Acesse o Colégio em Movimento com sua conta Google." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { loading, firebaseUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && userDoc) {
      navigate({ to: userDoc.onboardingComplete ? "/app" : "/onboarding" });
    }
  }, [loading, firebaseUser, userDoc, navigate]);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-8">
        <div className="size-20 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          <GraduationCap className="size-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-muted-foreground">
            Gestão escolar simples para professores, escolas e famílias.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={handleLogin}
          disabled={submitting || loading}
        >
          <LogIn className="size-5" />
          {submitting ? "Entrando..." : "Entrar com Google"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Ao continuar você concorda em ter seus dados gerenciados pela sua instituição.
        </p>
      </div>
    </div>
  );
}
