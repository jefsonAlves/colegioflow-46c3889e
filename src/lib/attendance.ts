import { supabase } from "@/integrations/supabase/client";
import { enqueue } from "@/lib/offlineQueue";

export type AttendanceStatus = "P" | "F" | "J";

export interface AttendanceEntry {
  status: AttendanceStatus;
  by?: string;
  at?: number;
}

async function currentUid(): Promise<string> {
  return (await supabase.auth.getUser()).data.user?.id ?? "";
}

export async function getAttendance(
  schoolId: string,
  classId: string,
  dateISO: string,
): Promise<Record<string, AttendanceEntry>> {
  const uid = await currentUid();
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status, recorded_by, created_at")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("date", dateISO)
    .eq("recorded_by", uid);
  if (error) throw error;
  const out: Record<string, AttendanceEntry> = {};
  for (const r of data ?? []) {
    out[r.student_id as string] = {
      status: (r.status as AttendanceStatus) ?? "P",
      by: (r.recorded_by as string) ?? undefined,
      at: r.created_at ? new Date(r.created_at as string).getTime() : undefined,
    };
  }
  return out;
}

export async function setAttendance(
  schoolId: string,
  classId: string,
  dateISO: string,
  map: Record<string, AttendanceEntry>,
) {
  const uid = await currentUid();
  const rows = Object.entries(map).map(([studentId, e]) => ({
    school_id: schoolId,
    class_id: classId,
    student_id: studentId,
    date: dateISO,
    status: e.status,
    present: e.status === "P",
    recorded_by: uid,
  }));
  if (rows.length === 0) return;
  // Replace this teacher's existing entries for that day/class
  await supabase
    .from("attendance")
    .delete()
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("date", dateISO)
    .eq("recorded_by", uid);
  const { error } = await supabase.from("attendance").insert(rows);
  if (error) throw error;
}

export async function getClassAttendanceAll(
  schoolId: string,
  classId: string,
): Promise<Record<string, Record<string, AttendanceEntry>>> {
  const uid = await currentUid();
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status, recorded_by, created_at, date")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("recorded_by", uid);

  if (error) throw error;
  const out: Record<string, Record<string, AttendanceEntry>> = {};
  for (const r of data ?? []) {
    const date = r.date as string;
    if (!out[date]) out[date] = {};
    out[date][r.student_id as string] = {
      status: (r.status as AttendanceStatus) ?? "P",
      by: (r.recorded_by as string) ?? undefined,
      at: r.created_at ? new Date(r.created_at as string).getTime() : undefined,
    };
  }
  return out;
}
