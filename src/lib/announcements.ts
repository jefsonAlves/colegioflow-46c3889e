import { supabase } from "@/integrations/supabase/client";

export type Audience = "parents" | "teachers" | "all";

export interface AnnouncementDoc {
  id: string;
  schoolId: string;
  classId: string | null;
  authorId: string;
  audience: Audience;
  title: string;
  body: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  class_id: string | null;
  author_id: string;
  audience: Audience;
  title: string;
  body: string;
  created_at: string;
};

const toDoc = (r: Row): AnnouncementDoc => ({
  id: r.id,
  schoolId: r.school_id,
  classId: r.class_id,
  authorId: r.author_id,
  audience: r.audience,
  title: r.title,
  body: r.body,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listAnnouncements(schoolId: string): Promise<AnnouncementDoc[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createAnnouncement(input: {
  schoolId: string;
  classId: string | null;
  audience: Audience;
  title: string;
  body: string;
}): Promise<AnnouncementDoc> {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      school_id: input.schoolId,
      class_id: input.classId,
      audience: input.audience,
      title: input.title.trim(),
      body: input.body.trim(),
      author_id: uid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function listReadIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.announcement_id as string));
}

export async function markRead(announcementId: string) {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
  if (!uid) return;
  await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, user_id: uid }, { onConflict: "announcement_id,user_id" });
}
