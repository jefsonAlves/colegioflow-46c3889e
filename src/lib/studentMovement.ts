import { supabase } from "@/integrations/supabase/client";

/**
 * Move one or more students to a target class via SECURITY DEFINER function.
 * Only school admins/masters can execute (RLS is enforced inside the function).
 * Returns the number of students moved.
 */
export async function moveStudentsToClass(studentIds: string[], toClassId: string): Promise<number> {
  if (studentIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("move_students_to_class", {
    _student_ids: studentIds,
    _to_class_id: toClassId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export interface StudentClassHistoryRow {
  id: string;
  studentId: string;
  fromClassId: string | null;
  toClassId: string | null;
  movedAt: number;
  movedBy: string;
  note: string | null;
}

export async function listStudentClassHistory(studentId: string): Promise<StudentClassHistoryRow[]> {
  const { data, error } = await supabase
    .from("student_class_history")
    .select("*")
    .eq("student_id", studentId)
    .order("moved_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      student_id: string;
      from_class_id: string | null;
      to_class_id: string | null;
      moved_at: string;
      moved_by: string;
      note: string | null;
    };
    return {
      id: row.id,
      studentId: row.student_id,
      fromClassId: row.from_class_id,
      toClassId: row.to_class_id,
      movedAt: new Date(row.moved_at).getTime(),
      movedBy: row.moved_by,
      note: row.note,
    };
  });
}
