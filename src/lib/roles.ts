/**
 * Os 4 níveis de acesso do sistema.
 * - master: administrador geral do sistema (visão de todas as escolas)
 * - school_admin: administrador/secretaria de uma escola
 * - coordinator: coordenação pedagógica da escola
 * - teacher: professor(a) — vê apenas suas turmas e seus registros
 */
export type AccessRole = "master" | "school_admin" | "coordinator" | "teacher";

/** Papéis atribuíveis dentro de uma escola (o master é global). */
export const SCHOOL_ROLES = ["school_admin", "coordinator", "teacher"] as const;
export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export const ROLE_LABEL: Record<AccessRole, string> = {
  master: "Master",
  school_admin: "Administrador(a)",
  coordinator: "Coordenador(a)",
  teacher: "Professor(a)",
};

export const ROLE_DESCRIPTION: Record<AccessRole, string> = {
  master: "Acesso total ao sistema e a todas as escolas, planos e limites.",
  school_admin: "Gerencia a escola: alunos, turmas, funcionários, atestados e avisos.",
  coordinator: "Acompanha turmas, frequência, notas e relatórios da escola.",
  teacher: "Registra chamada, notas, conteúdos e advertências das suas turmas.",
};

export function roleLabel(role: string | null | undefined): string {
  return ROLE_LABEL[(role ?? "") as AccessRole] ?? "Sem acesso";
}
