import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/integrations/firebase/auth";

export const Route = createFileRoute("/app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { userDoc, firebaseUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  if (!userDoc) return null;

  const profileLabel: Record<string, string> = {
    teacher: "Professor(a)",
    school_admin: "Administrador da Escola",
    parent: "Pai / Responsável",
  };

  return (
    <AppShell title="Meu perfil">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            {firebaseUser?.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt=""
                className="size-14 rounded-full"
              />
            ) : (
              <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {userDoc.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <div className="font-semibold">{userDoc.name}</div>
              <div className="text-sm text-muted-foreground">{userDoc.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Perfil</div>
              <div className="font-medium">
                {userDoc.profileType ? profileLabel[userDoc.profileType] : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Papel global</div>
              <div className="font-medium capitalize">{userDoc.globalRole}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full h-12" onClick={handleLogout}>
        <LogOut className="size-4" /> Sair
      </Button>
    </AppShell>
  );
}
