import { supabase } from "@/integrations/supabase/client";

export type AlertPeriod = "month" | "bimester" | "year";

export interface AttendanceAlert {
  id: string;
  classId: string;
  teacherId: string;
  maxAbsences: number;
  period: AlertPeriod;
}

export async function getMyAttendanceAlert(classId: string): Promise<AttendanceAlert | null> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("class_attendance_alerts")
    .select("*")
    .eq("class_id", classId)
    .eq("teacher_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    classId: data.class_id as string,
    teacherId: data.teacher_id as string,
    maxAbsences: data.max_absences as number,
    period: data.period as AlertPeriod,
  };
}

export async function upsertAttendanceAlert(
  classId: string,
  maxAbsences: number,
  period: AlertPeriod,
): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");
  const { error } = await supabase
    .from("class_attendance_alerts")
    .upsert(
      { class_id: classId, teacher_id: uid, max_absences: maxAbsences, period },
      { onConflict: "class_id,teacher_id" },
    );
  if (error) throw error;
}

export async function deleteAttendanceAlert(classId: string): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("class_attendance_alerts")
    .delete()
    .eq("class_id", classId)
    .eq("teacher_id", uid);
  if (error) throw error;
}

export function periodStart(period: AlertPeriod, ref = new Date()): Date {
  const y = ref.getFullYear();
  if (period === "year") return new Date(y, 0, 1);
  if (period === "month") return new Date(y, ref.getMonth(), 1);
  // bimester: 2-month blocks starting January (roughly)
  const bStart = Math.floor(ref.getMonth() / 2) * 2;
  return new Date(y, bStart, 1);
}
