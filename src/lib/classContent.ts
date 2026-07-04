import { supabase } from "@/integrations/supabase/client";

export type SuccessLevel = "yes" | "partial" | "no";

export interface ContentLog {
  id: string;
  schoolId: string;
  classId: string;
  teacherId: string;
  date: string;
  title: string;
  description: string | null;
  objective: string | null;
  reaction: string | null;
  success: SuccessLevel | null;
  attachmentPath: string | null;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  date: string;
  title: string;
  description: string | null;
  objective: string | null;
  reaction: string | null;
  success: SuccessLevel | null;
  attachment_path: string | null;
  created_at: string;
};

const toDoc = (r: Row): ContentLog => ({
  id: r.id,
  schoolId: r.school_id,
  classId: r.class_id,
  teacherId: r.teacher_id,
  date: r.date,
  title: r.title,
  description: r.description,
  objective: r.objective,
  reaction: r.reaction,
  success: r.success,
  attachmentPath: r.attachment_path,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listContentLogs(
  schoolId: string,
  classId: string,
  limit = 30,
): Promise<ContentLog[]> {
  const { data, error } = await supabase
    .from("class_content_logs")
    .select("*")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createContentLog(input: {
  schoolId: string;
  classId: string;
  date: string;
  title: string;
  description?: string;
  objective?: string;
  reaction?: string;
  success?: SuccessLevel;
  file?: File | null;
}): Promise<ContentLog> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("not signed in");
  let attachmentPath: string | null = null;
  if (input.file) {
    const safe = input.file.name.replace(/[^\w.\-]/g, "_");
    const path = `${uid}/${input.classId}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage
      .from("class-content")
      .upload(path, input.file, { upsert: false });
    if (upErr) throw upErr;
    attachmentPath = path;
  }
  const { data, error } = await supabase
    .from("class_content_logs")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      teacher_id: uid,
      date: input.date,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      objective: input.objective?.trim() || null,
      reaction: input.reaction?.trim() || null,
      success: input.success ?? null,
      attachment_path: attachmentPath,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function getContentAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("class-content")
    .createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteContentLog(id: string, attachmentPath: string | null): Promise<void> {
  if (attachmentPath) {
    await supabase.storage.from("class-content").remove([attachmentPath]);
  }
  const { error } = await supabase.from("class_content_logs").delete().eq("id", id);
  if (error) throw error;
}
