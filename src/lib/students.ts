import { supabase } from "@/integrations/supabase/client";

export interface StudentDoc {
  id: string;
  name: string;
  classId: string;
  parentUid?: string | null;
  active: boolean;
  createdAt: number;
}

function rowTo(r: Record<string, unknown>): StudentDoc {
  return {
    id: r.id as string,
    name: r.name as string,
    classId: (r.class_id as string) ?? "",
    parentUid: null,
    active: true,
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
}

export async function listStudents(schoolId: string): Promise<StudentDoc[]> {
  const { data } = await supabase.from("students").select("*").eq("school_id", schoolId);
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
}

export async function listStudentsByClass(_schoolId: string, classId: string): Promise<StudentDoc[]> {
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("class_id", classId)
    .order("name");
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
}

export async function createStudent(
  schoolId: string,
  input: { name: string; classId: string; parentUid?: string },
): Promise<StudentDoc> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      class_id: input.classId,
      name: input.name.trim(),
      created_by: uid,
    })
    .select()
    .single();
  if (error) throw error;
  return rowTo(data as Record<string, unknown>);
}

export async function updateStudent(_schoolId: string, studentId: string, patch: Partial<Omit<StudentDoc, "id">>) {
  const u: Record<string, unknown> = {};
  if (patch.name !== undefined) u.name = patch.name;
  if (patch.classId !== undefined) u.class_id = patch.classId;
  await supabase.from("students").update(u as never).eq("id", studentId);
}
