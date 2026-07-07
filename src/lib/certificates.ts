import { supabase } from "@/integrations/supabase/client";

export interface CertificateDoc {
  id: string;
  schoolId: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  attachmentUrl: string | null;
  createdBy: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  attachment_url: string | null;
  created_by: string;
  created_at: string;
};

const toDoc = (r: Row): CertificateDoc => ({
  id: r.id,
  schoolId: r.school_id,
  studentId: r.student_id,
  startDate: r.start_date,
  endDate: r.end_date,
  reason: r.reason,
  attachmentUrl: r.attachment_url,
  createdBy: r.created_by,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listCertificatesBySchool(schoolId: string): Promise<CertificateDoc[]> {
  const { data, error } = await supabase
    .from("student_certificates")
    .select("*")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function listCertificatesByStudent(studentId: string): Promise<CertificateDoc[]> {
  const { data, error } = await supabase
    .from("student_certificates")
    .select("*")
    .eq("student_id", studentId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createCertificate(input: {
  schoolId: string;
  studentId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  attachmentUrl?: string;
}): Promise<CertificateDoc> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("student_certificates")
    .insert({
      school_id: input.schoolId,
      student_id: input.studentId,
      start_date: input.startDate,
      end_date: input.endDate,
      reason: input.reason?.trim() || null,
      attachment_url: input.attachmentUrl ?? null,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function deleteCertificate(id: string) {
  const { error } = await supabase.from("student_certificates").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadCertificateFile(schoolId: string, file: File): Promise<string> {
  const path = `certificates/${schoolId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("class-content").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("class-content").createSignedUrl
    ? await supabase.storage.from("class-content").createSignedUrl(path, 60 * 60 * 24 * 365)
    : { data: { signedUrl: path } as { signedUrl: string } };
  return data?.signedUrl ?? path;
}

/** Days covered by an active certificate for a given student, as YYYY-MM-DD strings. */
export function daysInCertificate(cert: CertificateDoc): Set<string> {
  const out = new Set<string>();
  const start = new Date(cert.startDate + "T00:00:00");
  const end = new Date(cert.endDate + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.add(d.toISOString().slice(0, 10));
  }
  return out;
}
