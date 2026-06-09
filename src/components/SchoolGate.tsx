import { Link } from "@tanstack/react-router";
import { AlertCircle, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/States";
import { useActiveSchool } from "@/hooks/useActiveSchool";

interface Props {
  children: (ctx: { schoolId: string }) => React.ReactNode;
}

export function SchoolGate({ children }: Props) {
  const { schoolId, school, approvedSchools, pendingSchools, isLoading, setActive } = useActiveSchool();

  if (isLoading) return <Loading label="Carregando escola..." />;

  if (approvedSchools.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
          <AlertCircle className="size-10 text-muted-foreground" />
          <h3 className="font-semibold">Você ainda não tem escola ativa</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {pendingSchools.length > 0
              ? "Sua solicitação está aguardando aprovação do administrador da escola."
              : "Vincule-se a uma escola no seu perfil para começar."}
          </p>
          <Link to="/app/perfil">
            <Button>Ir para o perfil</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {approvedSchools.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {approvedSchools.map(({ school: s }) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                schoolId === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground"
              }`}
            >
              <Building2 className="size-3.5" />
              {s.name}
            </button>
          ))}
        </div>
      )}
      {schoolId && school ? children({ schoolId }) : null}
    </div>
  );
}
