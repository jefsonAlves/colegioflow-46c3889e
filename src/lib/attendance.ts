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
  scheduleId?: string | null,
): Promise<Record<string, AttendanceEntry>> {
  const uid = await currentUid();
  let query = supabase
    .from("attendance")
    .select("student_id, status, recorded_by, created_at, schedule_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("date", dateISO)
    .eq("recorded_by", uid);
  
  if (scheduleId) {
    query = query.eq("schedule_id", scheduleId);
  } else {
    // If no scheduleId provided, we might want to default to entries with no schedule_id 
    // or handle it in the UI. For backward compatibility, we'll allow nulls too if not specified.
    query = query.is("schedule_id", null);
  }

  const { data, error } = await query;
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
  scheduleId?: string | null,
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
    schedule_id: scheduleId || null,
  }));
  if (rows.length === 0) return;

  const doWrite = async () => {
    let deleteQuery = supabase
      .from("attendance")
      .delete()
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("date", dateISO)
      .eq("recorded_by", uid);
    
    if (scheduleId) {
      deleteQuery = deleteQuery.eq("schedule_id", scheduleId);
    } else {
      deleteQuery = deleteQuery.is("schedule_id", null);
    }

    await deleteQuery;
    const { error } = await supabase.from("attendance").insert(rows);
    if (error) throw error;
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueue({ kind: "attendance", payload: { schoolId, classId, dateISO, uid, rows } });
    return;
  }
  try {
    await doWrite();
  } catch (e) {
    await enqueue({ kind: "attendance", payload: { schoolId, classId, dateISO, uid, rows } });
    throw e;
  }
}

export async function getClassAttendanceAll(
  schoolId: string,
  classId: string,
  scheduleId?: string | null,
): Promise<Record<string, Record<string, AttendanceEntry>>> {
  const uid = await currentUid();
  let query = supabase
    .from("attendance")
    .select("student_id, status, recorded_by, created_at, date, schedule_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("recorded_by", uid);

  if (scheduleId) {
    query = query.eq("schedule_id", scheduleId);
  }

  const { data, error } = await query;
  if (error) throw error;

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

export async function getClassRegencyDates(
  schoolId: string,
  classId: string,
  scheduleId?: string | null,
): Promise<string[]> {
  const uid = await currentUid();
  let query = supabase
    .from("attendance")
    .select("date")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("recorded_by", uid);
  
  if (scheduleId) {
    query = query.eq("schedule_id", scheduleId);
  }

  const { data, error } = await query
    .order("date", { ascending: false });

  if (error) throw error;

  if (error) throw error;
  
  // Return unique dates sorted descending
  return Array.from(new Set((data ?? []).map((r) => r.date as string)));
}
