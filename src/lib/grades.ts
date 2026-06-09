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

  const rows: Array<{ school_id: string; class_id: string; student_id: string; trimester: number; subject: string; value: number; recorded_by: string }> = [];
  const push = (subject: string, val: number | null | undefined) => {
    if (typeof val === "number" && !Number.isNaN(val)) {
      rows.push({ school_id: schoolId, class_id: classId, student_id: studentId, trimester: bimestre, subject, value: val, recorded_by: uid });
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
