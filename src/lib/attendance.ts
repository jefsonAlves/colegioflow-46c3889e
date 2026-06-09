import { get, ref, set } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";

export type AttendanceStatus = "P" | "F" | "J";

export interface AttendanceEntry {
  status: AttendanceStatus;
  by?: string;
  at?: number;
}

export async function getAttendance(
  schoolId: string,
  classId: string,
  dateISO: string,
): Promise<Record<string, AttendanceEntry>> {
  const snap = await get(ref(rtdb, `attendance/${schoolId}/${classId}/${dateISO}`));
  return snap.exists() ? (snap.val() as Record<string, AttendanceEntry>) : {};
}

export async function setAttendance(
  schoolId: string,
  classId: string,
  dateISO: string,
  map: Record<string, AttendanceEntry>,
) {
  await set(ref(rtdb, `attendance/${schoolId}/${classId}/${dateISO}`), map);
}

export async function getClassAttendanceAll(
  schoolId: string,
  classId: string,
): Promise<Record<string, Record<string, AttendanceEntry>>> {
  const snap = await get(ref(rtdb, `attendance/${schoolId}/${classId}`));
  if (!snap.exists()) return {};
  return snap.val() as Record<string, Record<string, AttendanceEntry>>;
}
