import { supabase } from "@/integrations/supabase/client";

export interface StudentDoc {
  id: string;
  name: string;
  classId: string;
  parentUid?: string | null;
  active: boolean;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string | null;
  name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

const toDoc = (r: Row): StudentDoc => ({
  id: r.id,
  name: r.name,
  classId: r.class_id ?? "",
  parentUid: null,
  active: true,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listStudents(schoolId: string): Promise<StudentDoc[]> {
  const { data, error } = await supabase.from("students").select("*").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function listStudentsByClass(schoolId: string, classId: string): Promise<StudentDoc[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createStudent(
  schoolId: string,
  input: { name: string; classId: string; parentUid?: string; createdBy?: string },
): Promise<StudentDoc> {
  const createdBy = input.createdBy ?? (await supabase.auth.getUser()).data.user?.id ?? "";
  const { data, error } = await supabase
    .from("students")
    .insert({
      school_id: schoolId,
      class_id: input.classId,
      name: input.name.trim(),
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  patch: Partial<Omit<StudentDoc, "id">>,
) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.classId !== undefined) row.class_id = patch.classId;
  const { error } = await supabase.from("students").update(row).eq("school_id", schoolId).eq("id", studentId);
  if (error) throw error;
}
