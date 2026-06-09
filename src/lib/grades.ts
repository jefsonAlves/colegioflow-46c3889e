import { get, ref, set } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";

export interface GradeEntry {
  p1?: number | null;
  p2?: number | null;
  atividade?: number | null;
  media?: number;
  by?: string;
  at?: number;
}

export function calcMedia(g: Pick<GradeEntry, "p1" | "p2" | "atividade">): number {
  const vals = [g.p1, g.p2, g.atividade].filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v),
  );
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export async function getGrades(
  schoolId: string,
  classId: string,
  bimestre: number,
): Promise<Record<string, GradeEntry>> {
  const snap = await get(ref(rtdb, `grades/${schoolId}/${classId}/${bimestre}`));
  return snap.exists() ? (snap.val() as Record<string, GradeEntry>) : {};
}

export async function setStudentGrade(
  schoolId: string,
  classId: string,
  bimestre: number,
  studentId: string,
  entry: GradeEntry,
) {
  const full: GradeEntry = {
    p1: entry.p1 ?? null,
    p2: entry.p2 ?? null,
    atividade: entry.atividade ?? null,
    media: calcMedia(entry),
    by: entry.by,
    at: Date.now(),
  };
  await set(ref(rtdb, `grades/${schoolId}/${classId}/${bimestre}/${studentId}`), full);
}

export async function getStudentAllBimesters(
  schoolId: string,
  classId: string,
  studentId: string,
): Promise<Record<number, GradeEntry>> {
  const snap = await get(ref(rtdb, `grades/${schoolId}/${classId}`));
  if (!snap.exists()) return {};
  const out: Record<number, GradeEntry> = {};
  snap.forEach((bimSnap) => {
    const bim = Number(bimSnap.key);
    const studentGrade = bimSnap.child(studentId);
    if (studentGrade.exists()) out[bim] = studentGrade.val() as GradeEntry;
  });
  return out;
}
