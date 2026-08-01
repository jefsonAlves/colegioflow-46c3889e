export type PlanKey = "free" | "essential" | "complete";
export type PlanStatus = "active" | "trial" | "suspended";

export const PLAN_ORDER: PlanKey[] = ["free", "essential", "complete"];

export const PLAN_LABEL: Record<PlanKey, string> = {
  free: "Gratuito",
  essential: "Essencial",
  complete: "Completo",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: "Ativo",
  trial: "Em teste",
  suspended: "Suspenso",
};

export type FeatureKey =
  | "attendance"
  | "grades"
  | "reports"
  | "disciplinary"
  | "announcements"
  | "performance"
  | "certificates"
  | "imports"
  | "agents";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  minPlan: PlanKey;
}

export const FEATURES: FeatureDef[] = [
  { key: "attendance", label: "Frequência e turmas", description: "Chamada diária, turmas e horários", minPlan: "free" },
  { key: "grades", label: "Diário de notas", description: "Colunas personalizadas e médias", minPlan: "free" },
  { key: "reports", label: "Relatórios e boletim", description: "Faltosos, boletim em PDF e CSV", minPlan: "essential" },
  { key: "disciplinary", label: "Advertências", description: "Ocorrências com linha do tempo", minPlan: "essential" },
  { key: "announcements", label: "Avisos e notificações", description: "Comunicados para professores e responsáveis", minPlan: "essential" },
  { key: "performance", label: "Desempenho individual", description: "Registro por aluno e adaptações", minPlan: "essential" },
  { key: "certificates", label: "Atestados automáticos", description: "Justifica faltas automaticamente", minPlan: "complete" },
  { key: "imports", label: "Importação de dados", description: "Integração com sistemas externos", minPlan: "complete" },
  { key: "agents", label: "Integrações com agentes (MCP)", description: "Consultas por assistentes de IA", minPlan: "complete" },
];

export const PLAN_DEFAULT_LIMITS: Record<PlanKey, { maxStaff: number; maxStudents: number }> = {
  free: { maxStaff: 5, maxStudents: 200 },
  essential: { maxStaff: 25, maxStudents: 900 },
  complete: { maxStaff: 200, maxStudents: 5000 },
};

export function isPlanKey(value: string | null | undefined): value is PlanKey {
  return value === "free" || value === "essential" || value === "complete";
}

export function asPlanKey(value: string | null | undefined): PlanKey {
  return isPlanKey(value) ? value : "free";
}

export function asPlanStatus(value: string | null | undefined): PlanStatus {
  return value === "trial" || value === "suspended" ? value : "active";
}

/** A feature is released when the plan reaches its minimum tier and the plan is not suspended. */
export function isFeatureEnabled(plan: PlanKey, status: PlanStatus, feature: FeatureKey): boolean {
  if (status === "suspended") return false;
  const def = FEATURES.find((f) => f.key === feature);
  if (!def) return false;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(def.minPlan);
}

export function usageRatio(used: number, limit: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(1, used / limit);
}

export function usageTone(ratio: number): "ok" | "warn" | "over" {
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warn";
  return "ok";
}
