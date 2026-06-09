import { supabase } from "@/integrations/supabase/client";

export interface ClassScheduleDoc {
  id: string;
  schoolId: string;
  classId: string;
  weekday: number; // 0=Sun ... 6=Sat
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_by: string;
  created_at: string;
};

const toDoc = (r: Row): ClassScheduleDoc => ({
  id: r.id,
  schoolId: r.school_id,
  classId: r.class_id,
  weekday: r.weekday,
  startTime: r.start_time.slice(0, 5),
  endTime: r.end_time.slice(0, 5),
  createdAt: new Date(r.created_at).getTime(),
});

export async function listSchedulesByClass(classId: string): Promise<ClassScheduleDoc[]> {
  const { data, error } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("class_id", classId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function listSchedulesBySchool(schoolId: string): Promise<ClassScheduleDoc[]> {
  const { data, error } = await supabase
    .from("class_schedules")
    .select("*")
    .eq("school_id", schoolId)
    .order("weekday")
    .order("start_time");
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createSchedule(input: {
  schoolId: string;
  classId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}): Promise<ClassScheduleDoc> {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
  const { data, error } = await supabase
    .from("class_schedules")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      weekday: input.weekday,
      start_time: input.startTime,
      end_time: input.endTime,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("class_schedules").delete().eq("id", id);
  if (error) throw error;
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
