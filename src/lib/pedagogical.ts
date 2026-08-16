import { supabase } from "@/integrations/supabase/client";
import { createAnnouncement } from "./announcements";
import { listDisciplinary } from "./disciplinary";

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
    targetUserId: null, 
  });
}

export async function getStudentDossier(schoolId: string, studentId: string) {
  const [{ data: disciplinary, error: discErr }, { data: grades, error: gradeErr }, { data: attendance, error: attErr }] = await Promise.all([
    supabase.from("disciplinary").select("*").eq("school_id", schoolId).eq("student_id", studentId).order("date", { ascending: false }),
    supabase.from("grades").select("*").eq("school_id", schoolId).eq("student_id", studentId),
    supabase.from("attendance").select("*").eq("school_id", schoolId).eq("student_id", studentId)
  ]);

  if (discErr) throw discErr;
  if (gradeErr) throw gradeErr;
  if (attErr) throw attErr;

  return {
    disciplinary,
    grades,
    attendance,
  };
}

export async function updateDisciplinaryRecord(id: string, description: string, justification: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("disciplinary")
    .update({ 
      description,
      // Store justification in a JSONB or metadata column if available, 
      // otherwise we prepend it to the description or assume schema allows it.
      // Since we can't change schema easily without migrations, we'll assume a 'notes' or similar.
      // Based on previous view, disciplinary has description andRecorded_by.
      // We'll append justification to the description for now to ensure it's saved.
      description: `${description}\n\n[Editado em ${new Date().toLocaleDateString()} - Motivo: ${justification}]`
    } as any)
    .eq("id", id)
    .eq("recorded_by", user.id); // Only allow author to edit

  if (error) throw error;
}
