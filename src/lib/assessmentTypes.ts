import { supabase } from "@/integrations/supabase/client";

export interface AssessmentType {
  id: string;
  teacherId: string;
  classId: string | null;
  schoolId: string;
  name: string;
  weight: number;
  bimester: number;
}

type Row = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  school_id: string;
  name: string;
  weight: number;
  bimester: number;
};

const toDoc = (r: Row): AssessmentType => ({
  id: r.id,
  teacherId: r.teacher_id,
  classId: r.class_id,
  schoolId: r.school_id,
  name: r.name,
  weight: Number(r.weight ?? 1),
  bimester: r.bimester,
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
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createAssessmentType(input: {
  schoolId: string;
  classId: string | null; // null = applies to all teacher's classes
  name: string;
  weight: number;
  bimester: number;
}): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");

  if (input.classId === null) {
    // Replicate for all teacher's classes in this school
    const { data: taught } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("user_id", uid)
      .eq("school_id", input.schoolId);
    const rows = (taught ?? []).map((t) => ({
      teacher_id: uid,
      class_id: t.class_id as string,
      school_id: input.schoolId,
      name: input.name.trim(),
      weight: input.weight,
      bimester: input.bimester,
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("assessment_types").insert(rows);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("assessment_types").insert({
    teacher_id: uid,
    class_id: input.classId,
    school_id: input.schoolId,
    name: input.name.trim(),
    weight: input.weight,
    bimester: input.bimester,
  });
  if (error) throw error;
}

export async function deleteAssessmentType(id: string): Promise<void> {
  const { error } = await supabase.from("assessment_types").delete().eq("id", id);
  if (error) throw error;
}
