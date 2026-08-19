import { supabase } from "@/integrations/supabase/client";

export interface StudentDoc {
  id: string;
  name: string;
  classId: string;
  parentUid?: string | null;
  active: boolean;
  status: "active" | "transferred" | "school_transfer";
  transferReason?: string | null;
  transferDate?: number | null;
  specialNeeds: boolean;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string | null;
  name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  special_needs: boolean;
  special_needs_note: string | null;
  created_by: string;
  status: string | null;
  transfer_reason: string | null;
  transfer_date: string | null;
  created_at: string;
};

const toDoc = (r: Row): StudentDoc => ({
  id: r.id,
  name: r.name,
  classId: r.class_id ?? "",
  parentUid: null,
  active: true,
  status: (r.status as any) || "active",
  transferReason: r.transfer_reason,
  transferDate: r.transfer_date ? new Date(r.transfer_date).getTime() : null,
  specialNeeds: !!r.special_needs,
  specialNeedsNote: r.special_needs_note ?? null,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listStudents(schoolId: string): Promise<StudentDoc[]> {
  const { data, error } = await supabase.from("students").select("*").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => toDoc(r as Row));
}

export async function listStudentsByClass(schoolId: string, classId: string): Promise<StudentDoc[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => toDoc(r as Row));
}

export async function countStudentsBySchool(schoolId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    const cid = (r as { class_id: string | null }).class_id;
    if (!cid) continue;
    out[cid] = (out[cid] ?? 0) + 1;
  }
  return out;
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
  return toDoc(data as any as Row);
}

export async function createStudentsBulk(
  schoolId: string,
  classId: string,
  names: string[],
  createdBy?: string,
): Promise<StudentDoc[]> {
  if (names.length === 0) return [];
  const by = createdBy ?? (await supabase.auth.getUser()).data.user?.id ?? "";
  const rows = names.map((name) => ({
    school_id: schoolId,
    class_id: classId,
    name: name.trim(),
    created_by: by,
  }));
  const { data, error } = await supabase.from("students").insert(rows as any).select("*");
  if (error) throw error;
  return (data ?? []).map((r: any) => toDoc(r as Row));
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  patch: Partial<Omit<StudentDoc, "id">>,
) {
  const row: Partial<Row> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.classId !== undefined) row.class_id = patch.classId;
  if (patch.specialNeeds !== undefined) row.special_needs = patch.specialNeeds;
  if (patch.specialNeedsNote !== undefined) row.special_needs_note = patch.specialNeedsNote;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.transferReason !== undefined) row.transfer_reason = patch.transferReason;
  if (patch.transferDate !== undefined) row.transfer_date = patch.transferDate ? new Date(patch.transferDate).toISOString() : null;
  const { error } = await supabase.from("students").update(row as any).eq("school_id", schoolId).eq("id", studentId);
  if (error) throw error;
}

export async function deleteStudent(schoolId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("school_id", schoolId)
    .eq("id", studentId);
  if (error) throw error;
}
