import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, LogIn, Mail, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from "@/integrations/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Entrar` },
      { name: "description", content: "Acesse o Colégio em Movimento com sua conta Google ou e-mail." },
    ],
  }),
  component: LoginPage,
});

interface AuthError {
  code?: string;
  message?: string;
}

function translateError(code?: string, message?: string): string {
  if (message && /invalid login/i.test(message)) return "E-mail ou senha incorretos.";
  if (message && /already registered/i.test(message)) return "Este e-mail já está cadastrado. Faça login.";
  if (message && /weak.password/i.test(message)) return "Senha muito fraca. Use 6+ caracteres.";
  switch (code) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/network-request-failed":
      return "Sem conexão. Verifique sua internet.";
    default:
      return message || "Não foi possível entrar. Tente novamente.";
  }
}

function LoginPage() {
  const { loading, firebaseUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && userDoc) {
      navigate({ to: userDoc.onboardingComplete ? "/app" : "/onboarding" });
    }
  }, [loading, firebaseUser, userDoc, navigate]);

  const handleGoogle = async () => {
    try {
      setSubmitting(true);
      await signInWithGoogle();
    } catch (e) {
      const err = e as AuthError;
      console.error(err);
      toast.error(translateError(err.code, err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmail = async (mode: "signin" | "signup") => {
    if (!email || password.length < 6) {
      toast.error("Informe e-mail e senha (6+ caracteres).");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (e) {
      const err = e as AuthError;
      console.error(err);
      toast.error(translateError(err.code, err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const copyDomain = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      toast.success("Domínio copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        <div className="size-20 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          <GraduationCap className="size-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-muted-foreground text-sm">
            Gestão escolar simples para professores, escolas e famílias.
          </p>
        </div>

        {unauthorizedDomain && (
          <Card className="border-destructive/40 bg-destructive/5 w-full text-left">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold">Domínio não autorizado</div>
                  <p className="text-muted-foreground mt-1">
                    Adicione este domínio em <b>Firebase Console → Authentication → Settings → Authorized domains</b>:
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-background p-2 font-mono text-xs break-all">
                <span className="flex-1">{unauthorizedDomain}</span>
                <Button size="sm" variant="ghost" onClick={copyDomain}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <a
                href="https://console.firebase.google.com/project/projetojefson/authentication/settings"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Abrir Firebase Console <ExternalLink className="size-3" />
              </a>
            </CardContent>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={handleGoogle}
          disabled={submitting || loading}
        >
          <LogIn className="size-5" />
          {submitting ? "Entrando..." : "Entrar com Google"}
        </Button>

        <div className="w-full flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">ou com e-mail</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <Card className="w-full">
          <CardContent className="pt-4">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <div className="space-y-3 pt-4 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@escola.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
              </div>

              <TabsContent value="signin" className="pt-3">
                <Button
                  className="w-full h-12"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleEmail("signin")}
                >
                  <Mail className="size-4" /> Entrar
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="pt-3">
                <Button
                  className="w-full h-12"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => handleEmail("signup")}
                >
                  <Mail className="size-4" /> Criar conta
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Ao continuar você concorda em ter seus dados gerenciados pela sua instituição.
        </p>
      </div>
    </div>
  );
}
