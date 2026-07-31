import { supabase } from "@/integrations/supabase/client";

export interface AssessmentType {
  id: string;
  teacherId: string;
  classId: string | null;
  schoolId: string;
  name: string;
  weight: number;
  bimester: number;
  subjectKey: string;
  position: number;
  maxValue: number;
}

type Row = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  school_id: string;
  name: string;
  weight: number;
  bimester: number;
  subject_key: string;
  position: number;
  max_value: number;
};

/** Legacy columns kept so grades saved before customization keep showing up. */
export const LEGACY_TYPES = [
  { key: "P1", name: "P1" },
  { key: "P2", name: "P2" },
  { key: "ATIVIDADE", name: "Ativ." },
] as const;

const toDoc = (r: Row): AssessmentType => ({
  id: r.id,
  teacherId: r.teacher_id,
  classId: r.class_id,
  schoolId: r.school_id,
  name: r.name,
  weight: Number(r.weight ?? 1),
  bimester: r.bimester,
  subjectKey: r.subject_key,
  position: Number(r.position ?? 0),
  maxValue: Number(r.max_value ?? 10),
});

export async function listAssessmentTypes(
  schoolId: string,
  classId: string,
  bimester: number,
): Promise<AssessmentType[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("assessment_types")
    .select("*")
    .eq("school_id", schoolId)
    .eq("teacher_id", uid)
    .eq("bimester", bimester)
    .or(`class_id.eq.${classId},class_id.is.null`)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as unknown as Row));
}

/**
 * Returns the teacher's columns for a class/bimester, creating the classic
 * P1 / P2 / Ativ. columns the first time so existing grades stay visible.
 */
export async function ensureAssessmentTypes(
  schoolId: string,
  classId: string,
  bimester: number,
): Promise<AssessmentType[]> {
  const existing = await listAssessmentTypes(schoolId, classId, bimester);
  if (existing.length > 0) return existing;
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const rows = LEGACY_TYPES.map((t, i) => ({
    teacher_id: uid,
    class_id: classId,
    school_id: schoolId,
    name: t.name,
    weight: 1,
    bimester,
    subject_key: t.key,
    position: i,
    max_value: 10,
  }));
  const { error } = await supabase.from("assessment_types").insert(rows);
  if (error && error.code !== "23505") throw error;
  return listAssessmentTypes(schoolId, classId, bimester);
}

export async function createAssessmentType(input: {
  schoolId: string;
  classId: string | null; // null = applies to all teacher's classes
  name: string;
  weight: number;
  bimester: number;
  maxValue?: number;
  position?: number;
}): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");

  const subjectKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `k_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const base = {
    teacher_id: uid,
    school_id: input.schoolId,
    name: input.name.trim(),
    weight: input.weight,
    bimester: input.bimester,
    subject_key: subjectKey,
    position: input.position ?? 99,
    max_value: input.maxValue ?? 10,
  };

  if (input.classId === null) {
    const { data: taught } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("user_id", uid)
      .eq("school_id", input.schoolId);
    const rows = (taught ?? []).map((t) => ({ ...base, class_id: t.class_id as string }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("assessment_types").insert(rows);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("assessment_types")
    .insert({ ...base, class_id: input.classId });
  if (error) throw error;
}

export async function updateAssessmentType(
  id: string,
  patch: { name?: string; weight?: number; maxValue?: number; position?: number },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.weight !== undefined) payload.weight = patch.weight;
  if (patch.maxValue !== undefined) payload.max_value = patch.maxValue;
  if (patch.position !== undefined) payload.position = patch.position;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("assessment_types").update(payload).eq("id", id);
  if (error) throw error;
}

export async function reorderAssessmentTypes(ordered: AssessmentType[]): Promise<void> {
  await Promise.all(ordered.map((t, i) => updateAssessmentType(t.id, { position: i })));
}

export async function deleteAssessmentType(id: string): Promise<void> {
  const { error } = await supabase.from("assessment_types").delete().eq("id", id);
  if (error) throw error;
}
