import { AlertCircle, CheckCircle2, Clock, ListChecks, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { explainMembershipStatus } from "@/lib/membershipStatus";
import type { MembershipStatus, RoleInSchool } from "@/lib/types";

interface Props {
  status: MembershipStatus;
  role?: RoleInSchool | null;
  schoolName?: string;
  profileType?: string | null;
  onboardingComplete?: boolean;
}

/** Cartão que explica o motivo do estado do vínculo e o que falta para concluir. */
export function MembershipStatusCard({
  status,
  role,
  schoolName,
  profileType,
  onboardingComplete,
}: Props) {
  const info = explainMembershipStatus(status, role, { profileType, onboardingComplete });
  const Icon = info.tone === "active" ? CheckCircle2 : info.tone === "pending" ? Clock : AlertCircle;

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2.5">
        <div className="flex items-start gap-2">
          <Icon
            className={`size-5 shrink-0 mt-0.5 ${
              info.tone === "active"
                ? "text-primary"
                : info.tone === "pending"
                  ? "text-secondary-foreground"
                  : "text-destructive"
            }`}
            aria-hidden
          />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {schoolName && <span className="font-medium truncate">{schoolName}</span>}
              <Badge
                variant={
                  info.tone === "active" ? "default" : info.tone === "pending" ? "secondary" : "destructive"
                }
                className="text-[11px]"
              >
                {info.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{info.reason}</p>
          </div>
        </div>

        {info.missing.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <ListChecks className="size-3.5" aria-hidden /> O que falta para ficar ativo
            </p>
            <ul className="space-y-1">
              {info.missing.map((step) => (
                <li key={step} className="text-xs flex gap-1.5">
                  <span aria-hidden className="text-muted-foreground">
                    •
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="size-3.5" aria-hidden /> Responsável por concluir: {info.responsible}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
