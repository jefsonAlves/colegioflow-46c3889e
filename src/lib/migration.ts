// Legacy stub — RTDB/Firestore migration tool no longer used. Kept so the
// Master / Migração page can render without breaking imports.

export interface ScanReport {
  rtdb: Record<string, unknown>;
  firestore: Record<string, unknown>;
}

export type Op =
  | { type: "noop"; reason: string };

export interface ApplyResult {
  total: number;
  applied: number;
  failed: number;
}

export async function scanLegacy(): Promise<ScanReport> {
  return { rtdb: {}, firestore: {} };
}

export async function planMigration(): Promise<Op[]> {
  return [];
}

export async function applyMigration(_ops: Op[]): Promise<ApplyResult> {
  return { total: 0, applied: 0, failed: 0 };
}
