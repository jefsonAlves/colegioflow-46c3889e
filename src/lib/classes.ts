import { supabase } from "@/integrations/supabase/client";

export interface ClassDoc {
  id: string;
  name: string;
  year: number;
  teacherUid: string | null;
  createdBy: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  name: string;
  year: number;
  teacher_uid: string | null;
  created_by: string;
  created_at: string;
};

const toDoc = (r: Row): ClassDoc => ({
  id: r.id,
  name: r.name,
  year: r.year,
  teacherUid: r.teacher_uid,
  createdBy: r.created_by,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listClasses(schoolId: string): Promise<ClassDoc[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("year")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createClass(
  schoolId: string,
  input: { name: string; year: number; teacherUid?: string | null; createdBy: string },
): Promise<ClassDoc> {
  const { data, error } = await supabase
    .from("classes")
    .insert({
      school_id: schoolId,
      name: input.name.trim(),
      year: input.year,
      teacher_uid: input.teacherUid ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function getClass(schoolId: string, classId: string): Promise<ClassDoc | null> {
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .eq("id", classId)
    .maybeSingle();
  return data ? toDoc(data as Row) : null;
}

export async function updateClass(
  schoolId: string,
  classId: string,
  patch: Partial<Omit<ClassDoc, "id">>,
) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.year !== undefined) row.year = patch.year;
  if (patch.teacherUid !== undefined) row.teacher_uid = patch.teacherUid;
  const { error } = await supabase.from("classes").update(row).eq("school_id", schoolId).eq("id", classId);
  if (error) throw error;
}

export async function deleteClass(schoolId: string, classId: string) {
  const { error } = await supabase.from("classes").delete().eq("school_id", schoolId).eq("id", classId);
  if (error) throw error;
}
