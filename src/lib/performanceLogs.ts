import { supabase } from "@/integrations/supabase/client";

export type Performance = "excelente" | "bom" | "regular" | "dificuldade";

export interface PerformanceLog {
  id: string;
  schoolId: string;
  classId: string;
  studentId: string;
  teacherId: string;
  date: string;
  performance: Performance;
  notes: string | null;
  needsAdaptation: boolean;
  contentRef: string | null;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  performance: Performance;
  notes: string | null;
  needs_adaptation: boolean;
  content_ref: string | null;
  created_at: string;
};

const toDoc = (r: Row): PerformanceLog => ({
  id: r.id,
  schoolId: r.school_id,
  classId: r.class_id,
  studentId: r.student_id,
  teacherId: r.teacher_id,
  date: r.date,
  performance: r.performance,
  notes: r.notes,
  needsAdaptation: r.needs_adaptation,
  contentRef: r.content_ref,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listPerformanceLogs(classId: string, studentId?: string): Promise<PerformanceLog[]> {
  let q = supabase.from("student_performance_logs").select("*").eq("class_id", classId);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q.order("date", { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createPerformanceLog(input: {
  schoolId: string;
  classId: string;
  studentId: string;
  date: string;
  performance: Performance;
  notes?: string;
  needsAdaptation?: boolean;
  contentRef?: string | null;
}): Promise<PerformanceLog> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("student_performance_logs")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      student_id: input.studentId,
      teacher_id: uid,
      date: input.date,
      performance: input.performance,
      notes: input.notes?.trim() || null,
      needs_adaptation: !!input.needsAdaptation,
      content_ref: input.contentRef ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function deletePerformanceLog(id: string) {
  const { error } = await supabase.from("student_performance_logs").delete().eq("id", id);
  if (error) throw error;
}
