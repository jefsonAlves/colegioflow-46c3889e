import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Loading } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOut } from "@/integrations/firebase/auth";
import { RTDB_RULES_JSON } from "@/lib/rtdb-rules";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, firebaseUser, userDoc, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      navigate({ to: "/login" });
      return;
    }
    if (userDoc && !userDoc.onboardingComplete) {
      navigate({ to: "/onboarding" });
    }
  }, [loading, firebaseUser, userDoc, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Carregando seu perfil..." />
      </div>
    );
  }

  if (firebaseUser && bootError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 py-8 bg-muted/30">
        <Card className="w-full max-w-md border-destructive/40">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-lg">Não consegui carregar seu perfil</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {bootError.firestoreMissing
                    ? "O banco de dados Firestore ainda não foi ativado neste projeto Firebase. Peça ao administrador para ativá-lo."
                    : bootError.message}
                </p>
              </div>
            </div>

            {bootError.firestoreMissing && (
              <div className="rounded-lg bg-muted p-3 text-xs space-y-2">
                <p className="font-medium">Como ativar (administrador):</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                  <li>Abrir o Console do Firebase do projeto.</li>
                  <li>Menu lateral → <b>Firestore Database</b> → <b>Criar banco</b>.</li>
                  <li>Modo <b>Produção</b>, local <b>southamerica-east1</b> ou <b>eur3</b>.</li>
                  <li>Aba <b>Regras</b> → publicar o conteúdo de <code>firestore.rules</code>.</li>
                </ol>
                <a
                  href="https://console.firebase.google.com/project/projetojefson/firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Abrir Firebase Console <ExternalLink className="size-3" />
                </a>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => retryBoot()} className="flex-1">
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!firebaseUser || !userDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading label="Carregando..." />
      </div>
    );
  }

  return <Outlet />;
}
