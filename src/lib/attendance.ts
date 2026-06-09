import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "P" | "F" | "J";

export interface AttendanceEntry {
  status: AttendanceStatus;
  by?: string;
  at?: number;
}

export async function getAttendance(
  _schoolId: string,
  classId: string,
  dateISO: string,
): Promise<Record<string, AttendanceEntry>> {
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("class_id", classId)
    .eq("date", dateISO);
  const out: Record<string, AttendanceEntry> = {};
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    out[row.student_id as string] = {
      status: ((row.status as string) ?? (row.present ? "P" : "F")) as AttendanceStatus,
      by: (row.recorded_by as string) ?? undefined,
      at: row.created_at ? new Date(row.created_at as string).getTime() : undefined,
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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Não autenticado");
  const rows = Object.entries(map).map(([studentId, e]) => ({
    school_id: schoolId,
    class_id: classId,
    student_id: studentId,
    date: dateISO,
    status: e.status,
    present: e.status !== "F",
    recorded_by: e.by ?? uid,
  }));
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "class_id,student_id,date" });
  if (error) throw error;
}

export async function getClassAttendanceAll(
  _schoolId: string,
  classId: string,
): Promise<Record<string, Record<string, AttendanceEntry>>> {
  const { data } = await supabase.from("attendance").select("*").eq("class_id", classId);
  const out: Record<string, Record<string, AttendanceEntry>> = {};
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    const date = row.date as string;
    const sid = row.student_id as string;
    if (!out[date]) out[date] = {};
    out[date][sid] = {
      status: ((row.status as string) ?? (row.present ? "P" : "F")) as AttendanceStatus,
      by: (row.recorded_by as string) ?? undefined,
    };
  }
  return out;
}
