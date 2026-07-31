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

// Grades schema stores one row per (student, trimester, subject). We model the
// classic p1/p2/atividade triplet by using subject = "P1" | "P2" | "ATIVIDADE"
// per student/bimester, and compute média on the client.
const SUBJECTS = ["P1", "P2", "ATIVIDADE"] as const;

export async function getGrades(
  schoolId: string,
  classId: string,
  bimestre: number,
): Promise<Record<string, GradeEntry>> {
  const { data, error } = await supabase
    .from("grades")
    .select("student_id, subject, value, recorded_by, created_at")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("trimester", bimestre);
  if (error) throw error;
  const out: Record<string, GradeEntry> = {};
  for (const r of data ?? []) {
    const sid = r.student_id as string;
    const e = (out[sid] ??= {});
    const v = Number(r.value);
    if (r.subject === "P1") e.p1 = v;
    else if (r.subject === "P2") e.p2 = v;
    else if (r.subject === "ATIVIDADE") e.atividade = v;
    e.by = (r.recorded_by as string) ?? e.by;
    e.at = r.created_at ? new Date(r.created_at as string).getTime() : e.at;
  }
  for (const sid of Object.keys(out)) out[sid].media = calcMedia(out[sid]);
  return out;
}

export async function setStudentGrade(
  schoolId: string,
  classId: string,
  bimestre: number,
  studentId: string,
  entry: GradeEntry,
) {
  const uid = entry.by ?? (await supabase.auth.getUser()).data.user?.id ?? "";
  await supabase
    .from("grades")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .eq("trimester", bimestre)
    .in("subject", SUBJECTS as unknown as string[]);

  const rows: Array<{ school_id: string; class_id: string; student_id: string; trimester: number; subject: string; value: number; recorded_by: string; updated_by: string }> = [];
  const push = (subject: string, val: number | null | undefined) => {
    if (typeof val === "number" && !Number.isNaN(val)) {
      rows.push({ school_id: schoolId, class_id: classId, student_id: studentId, trimester: bimestre, subject, value: val, recorded_by: uid, updated_by: uid });
    }
  };
  push("P1", entry.p1);
  push("P2", entry.p2);
  push("ATIVIDADE", entry.atividade);
  if (rows.length === 0) return;
  const { error } = await supabase.from("grades").insert(rows);
  if (error) throw error;
}

export async function getStudentAllBimesters(
  schoolId: string,
  classId: string,
  studentId: string,
): Promise<Record<number, GradeEntry>> {
  const { data, error } = await supabase
    .from("grades")
    .select("trimester, subject, value")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("student_id", studentId);
  if (error) throw error;
  const out: Record<number, GradeEntry> = {};
  for (const r of data ?? []) {
    const bim = Number(r.trimester);
    const e = (out[bim] ??= {});
    const v = Number(r.value);
    if (r.subject === "P1") e.p1 = v;
    else if (r.subject === "P2") e.p2 = v;
    else if (r.subject === "ATIVIDADE") e.atividade = v;
  }
  for (const k of Object.keys(out)) out[Number(k)].media = calcMedia(out[Number(k)]);
  return out;
}

/* ------------------------------------------------------------------ *
 * Dynamic columns (diário): grades are stored one row per subject key.
 * A subject key is either a legacy key (P1 / P2 / ATIVIDADE) or the
 * generated key of a teacher-defined assessment column.
 * ------------------------------------------------------------------ */

export type GradeMap = Record<string, number>; // subjectKey -> value
export type ClassGradeMap = Record<string, GradeMap>; // studentId -> GradeMap

export interface WeightedColumn {
  subjectKey: string;
  weight: number;
}

/** Weighted average over the columns that actually have a value. */
export function calcWeightedMedia(values: GradeMap, columns: WeightedColumn[]): number {
  let sum = 0;
  let weights = 0;
  for (const c of columns) {
    const v = values[c.subjectKey];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    const w = c.weight > 0 ? c.weight : 1;
    sum += v * w;
    weights += w;
  }
  if (weights === 0) return 0;
  return Math.round((sum / weights) * 10) / 10;
}

export async function getClassGradeMap(
  schoolId: string,
  classId: string,
  bimestre: number,
): Promise<ClassGradeMap> {
  const { data, error } = await supabase
    .from("grades")
    .select("student_id, subject, value")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("trimester", bimestre);
  if (error) throw error;
  const out: ClassGradeMap = {};
  for (const r of data ?? []) {
    const sid = r.student_id as string;
    (out[sid] ??= {})[r.subject as string] = Number(r.value);
  }
  return out;
}

/** Replaces the values of the given subject keys for one student. */
export async function setStudentGradeMap(input: {
  schoolId: string;
  classId: string;
  bimestre: number;
  studentId: string;
  subjectKeys: string[];
  values: Record<string, number | null>;
}): Promise<void> {
  const { schoolId, classId, bimestre, studentId, subjectKeys, values } = input;
  if (subjectKeys.length === 0) return;
  const uid = (await supabase.auth.getUser()).data.user?.id ?? "";

  const { error: delError } = await supabase
    .from("grades")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .eq("trimester", bimestre)
    .in("subject", subjectKeys);
  if (delError) throw delError;

  const rows = subjectKeys
    .filter((k) => typeof values[k] === "number" && !Number.isNaN(values[k] as number))
    .map((k) => ({
      school_id: schoolId,
      class_id: classId,
      student_id: studentId,
      trimester: bimestre,
      subject: k,
      value: values[k] as number,
      recorded_by: uid,
      updated_by: uid,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("grades").insert(rows);
  if (error) throw error;
}
