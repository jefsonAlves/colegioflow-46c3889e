import { supabase } from "@/integrations/supabase/client";

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

const SUBJECTS = ["p1", "p2", "atividade"] as const;

function rowsToEntry(rows: Record<string, unknown>[]): GradeEntry {
  const e: GradeEntry = {};
  for (const r of rows) {
    const subj = (r.subject as string) ?? "";
    const v = Number(r.value);
    if (subj === "p1") e.p1 = v;
    else if (subj === "p2") e.p2 = v;
    else if (subj === "atividade") e.atividade = v;
  }
  e.media = calcMedia(e);
  return e;
}

export async function getGrades(
  _schoolId: string,
  classId: string,
  bimestre: number,
): Promise<Record<string, GradeEntry>> {
  const { data } = await supabase
    .from("grades")
    .select("*")
    .eq("class_id", classId)
    .eq("trimester", bimestre);
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    const sid = row.student_id as string;
    const arr = grouped.get(sid) ?? [];
    arr.push(row);
    grouped.set(sid, arr);
  }
  const out: Record<string, GradeEntry> = {};
  for (const [sid, rs] of grouped) out[sid] = rowsToEntry(rs);
  return out;
}

export async function setStudentGrade(
  schoolId: string,
  classId: string,
  bimestre: number,
  studentId: string,
  entry: GradeEntry,
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Não autenticado");

  const upserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  for (const k of SUBJECTS) {
    const v = entry[k];
    if (v == null) deletes.push(k);
    else
      upserts.push({
        school_id: schoolId,
        class_id: classId,
        student_id: studentId,
        trimester: bimestre,
        subject: k,
        value: v,
        recorded_by: entry.by ?? uid,
      });
  }
  if (upserts.length > 0) {
    const { error } = await supabase
      .from("grades")
      .upsert(upserts as never, { onConflict: "class_id,student_id,trimester,subject" });
    if (error) throw error;
  }
  if (deletes.length > 0) {
    await supabase
      .from("grades")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .eq("trimester", bimestre)
      .in("subject", deletes);
  }
}

export async function getStudentAllBimesters(
  _schoolId: string,
  classId: string,
  studentId: string,
): Promise<Record<number, GradeEntry>> {
  const { data } = await supabase
    .from("grades")
    .select("*")
    .eq("class_id", classId)
    .eq("student_id", studentId);
  const grouped = new Map<number, Record<string, unknown>[]>();
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    const t = Number(row.trimester);
    const arr = grouped.get(t) ?? [];
    arr.push(row);
    grouped.set(t, arr);
  }
  const out: Record<number, GradeEntry> = {};
  for (const [t, rs] of grouped) out[t] = rowsToEntry(rs);
  return out;
}
