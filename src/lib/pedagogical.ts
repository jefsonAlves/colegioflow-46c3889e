import { supabase } from "@/integrations/supabase/client";
import { createAnnouncement } from "./announcements";
import { type DisciplinaryDoc, listDisciplinary } from "./disciplinary";

export interface PedagogicalIntervention {
  id: string;
  studentId: string;
  description: string;
  reason: string;
  recordedBy: string;
  recordedByName: string;
  justification?: string;
  updatedBy?: string;
  updatedAt?: number;
  createdAt: number;
}

export async function createPedagogicalRequest(input: {
  schoolId: string;
  studentId: string;
  studentName: string;
  type: 'urgency' | 'notice';
  message: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  return createAnnouncement({
    schoolId: input.schoolId,
    audience: "parents",
    title: input.type === 'urgency' ? `URGÊNCIA: ${input.studentName}` : `Aviso Pedagógico: ${input.studentName}`,
    body: input.message,
    targetUserId: null, // Assuming broadcast to student's parents if we had direct link, for now it's school-wide for parents
  });
}

export async function getStudentDossier(schoolId: string, studentId: string) {
  const { data: disciplinary, error: discErr } = await supabase
    .from("disciplinary")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("date", { ascending: false });

  if (discErr) throw discErr;

  const { data: grades, error: gradeErr } = await supabase
    .from("grades")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);

  if (gradeErr) throw gradeErr;

  const { data: attendance, error: attErr } = await supabase
    .from("attendance")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId);

  if (attErr) throw attErr;

  return {
    disciplinary,
    grades,
    attendance,
  };
}
