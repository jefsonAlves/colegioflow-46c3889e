import type { MembershipStatus, RoleInSchool } from "./types";
import { ROLE_LABEL } from "./roles";

export interface StatusExplanation {
  /** Rótulo curto do estado atual. */
  label: string;
  /** Tom visual sugerido para badges. */
  tone: "pending" | "active" | "blocked";
  /** Por que o acesso está nesse estado. */
  reason: string;
  /** O que ainda falta para o acesso ficar ativo (vazio quando já está concluído). */
  missing: string[];
  /** Quem precisa agir para concluir. */
  responsible: string;
}

/**
 * Explica, em português claro, o motivo do estado do vínculo do usuário com a
 * escola e o que falta para ele ficar ativo/concluído.
 */
export function explainMembershipStatus(
  status: MembershipStatus,
  role?: RoleInSchool | null,
  opts: { profileType?: string | null; onboardingComplete?: boolean } = {},
): StatusExplanation {
  const roleName = role ? ROLE_LABEL[role] : "Professor(a)";
  const isParent = opts.profileType === "parent";

  if (status === "approved") {
    const missing: string[] = [];
    if (opts.onboardingComplete === false) missing.push("Concluir seus dados de perfil (nome e foto).");
    return {
      label: "Ativo",
      tone: "active",
      reason: `Seu vínculo foi aprovado como ${roleName}. Todas as funções liberadas no plano da escola estão disponíveis.`,
      missing,
      responsible: missing.length ? "Você" : "Nada pendente",
    };
  }

  if (status === "pending") {
    return {
      label: "Aguardando aprovação",
      tone: "pending",
      reason: isParent
        ? "Cadastro de responsável só é ativado pela escola: a secretaria precisa vincular você ao aluno."
        : `Você solicitou acesso como ${roleName} a uma escola que já existe no sistema. Por segurança, um administrador da escola precisa confirmar que você faz parte da equipe.`,
      missing: isParent
        ? [
            "A secretaria da escola precisa vincular seu e-mail a um aluno.",
            "Depois disso você verá a turma, notas, avisos e ocorrências do(a) estudante.",
          ]
        : [
            "Aprovação de um administrador da escola (ou do administrador master).",
            "Depois da aprovação: escolher suas turmas e cadastrar horários e matérias no perfil.",
          ],
      responsible: isParent ? "Secretaria da escola" : "Administrador(a) da escola",
    };
  }

  if (status === "rejected") {
    return {
      label: "Recusado",
      tone: "blocked",
      reason: "Um administrador da escola não confirmou seu vínculo.",
      missing: [
        "Confirmar com a secretaria se o e-mail cadastrado é o mesmo usado pela escola.",
        "Solicitar o vínculo novamente após a confirmação.",
      ],
      responsible: "Administrador(a) da escola",
    };
  }

  return {
    label: "Bloqueado",
    tone: "blocked",
    reason: "Seu acesso a esta escola foi bloqueado por um administrador.",
    missing: ["Falar com a administração da escola para reativar o acesso."],
    responsible: "Administrador(a) da escola",
  };
}
