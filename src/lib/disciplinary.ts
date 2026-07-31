import { supabase } from "@/integrations/supabase/client";

export type DisciplinaryType = "verbal" | "escrita" | "grave";

export interface DisciplinaryDoc {
  id: string;
  studentId: string;
  classId: string;
  type: DisciplinaryType;
  description: string;
  date: string;
  by: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string | null;
  student_id: string;
  date: string;
  severity: string;
  description: string;
  recorded_by: string;
  created_at: string;
};

const sevToType = (s: string): DisciplinaryType =>
  s === "escrita" || s === "grave" ? (s as DisciplinaryType) : "verbal";

const toDoc = (r: Row): DisciplinaryDoc => ({
  id: r.id,
  studentId: r.student_id,
  classId: r.class_id ?? "",
  type: sevToType(r.severity),
  description: r.description,
  date: r.date,
  by: r.recorded_by,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listDisciplinary(
  schoolId: string,
  filters?: { classId?: string; studentId?: string; date?: string },
): Promise<DisciplinaryDoc[]> {
  let q = supabase.from("disciplinary").select("*").eq("school_id", schoolId);
  if (filters?.classId) q = q.eq("class_id", filters.classId);
  if (filters?.studentId) q = q.eq("student_id", filters.studentId);
  if (filters?.date) q = q.eq("date", filters.date);
  const { data, error } = await q.order("date", { ascending: false }).order("created_at", {
    ascending: false,
  });
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function deleteDisciplinary(id: string): Promise<void> {
  const { error } = await supabase.from("disciplinary").delete().eq("id", id);
  if (error) throw error;
}


export async function createDisciplinary(
  schoolId: string,
  input: Omit<DisciplinaryDoc, "id" | "createdAt">,
): Promise<DisciplinaryDoc> {
  const { data, error } = await supabase
    .from("disciplinary")
    .insert({
      school_id: schoolId,
      class_id: input.classId || null,
      student_id: input.studentId,
      date: input.date,
      severity: input.type,
      description: input.description,
      recorded_by: input.by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}
