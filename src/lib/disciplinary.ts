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

function rowTo(r: Record<string, unknown>): DisciplinaryDoc {
  return {
    id: r.id as string,
    studentId: r.student_id as string,
    classId: (r.class_id as string) ?? "",
    type: ((r.severity as string) ?? "verbal") as DisciplinaryType,
    description: (r.description as string) ?? "",
    date: (r.date as string) ?? "",
    by: r.recorded_by as string,
    createdAt: r.created_at ? new Date(r.created_at as string).getTime() : Date.now(),
  };
}

export async function listDisciplinary(schoolId: string): Promise<DisciplinaryDoc[]> {
  const { data } = await supabase
    .from("disciplinary")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => rowTo(r as Record<string, unknown>));
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
      severity: input.type,
      description: input.description,
      date: input.date,
      recorded_by: input.by,
    })
    .select()
    .single();
  if (error) throw error;
  return rowTo(data as Record<string, unknown>);
}
