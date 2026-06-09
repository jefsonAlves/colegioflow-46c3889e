import { supabase } from "@/integrations/supabase/client";

export interface ClassDoc {
  id: string;
  name: string;
  year: number;
  teacherUid: string | null;
  createdBy: string;
  createdAt: number;
}

function rowTo(r: Record<string, unknown>): ClassDoc {
  return {
    id: r.id as string,
    name: r.name as string,
    year: r.year as number,
    teacherUid: (r.teacher_uid as string | null) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
}

export async function listClasses(schoolId: string): Promise<ClassDoc[]> {
  const { data } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("year")
    .order("name");
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
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
    .select()
    .single();
  if (error) throw error;
  return rowTo(data as Record<string, unknown>);
}

export async function getClass(_schoolId: string, classId: string): Promise<ClassDoc | null> {
  const { data } = await supabase.from("classes").select("*").eq("id", classId).maybeSingle();
  return data ? rowTo(data as Record<string, unknown>) : null;
}

export async function updateClass(_schoolId: string, classId: string, patch: Partial<Omit<ClassDoc, "id">>) {
  const u: Record<string, unknown> = {};
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.year !== undefined) u.year = patch.year;
  if (patch.teacherUid !== undefined) u.teacher_uid = patch.teacherUid;
  await supabase.from("classes").update(u).eq("id", classId);
}

export async function deleteClass(_schoolId: string, classId: string) {
  await supabase.from("classes").delete().eq("id", classId);
}
