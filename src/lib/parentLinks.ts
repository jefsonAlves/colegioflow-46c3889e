import { supabase } from "@/integrations/supabase/client";

export interface ParentLinkDoc {
  id: string;
  schoolId: string;
  parentUserId: string;
  studentId: string;
  createdAt: number;
}

type Row = {
  id: string;
  school_id: string;
  parent_user_id: string;
  student_id: string;
  created_by: string;
  created_at: string;
};

const toDoc = (r: Row): ParentLinkDoc => ({
  id: r.id,
  schoolId: r.school_id,
  parentUserId: r.parent_user_id,
  studentId: r.student_id,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listSchoolParentLinks(schoolId: string): Promise<ParentLinkDoc[]> {
  const { data, error } = await supabase
    .from("parent_links")
    .select("*")
    .eq("school_id", schoolId);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function listMyParentLinks(userId: string): Promise<ParentLinkDoc[]> {
  const { data, error } = await supabase
    .from("parent_links")
    .select("*")
    .eq("parent_user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function createParentLink(input: {
  schoolId: string;
  parentUserId: string;
  studentId: string;
}): Promise<ParentLinkDoc> {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
  const { data, error } = await supabase
    .from("parent_links")
    .insert({
      school_id: input.schoolId,
      parent_user_id: input.parentUserId,
      student_id: input.studentId,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDoc(data as Row);
}

export async function deleteParentLink(id: string): Promise<void> {
  const { error } = await supabase.from("parent_links").delete().eq("id", id);
  if (error) throw error;
}

export async function findUserByEmail(email: string): Promise<{ id: string; name: string | null; email: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .ilike("email", email.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id as string, name: (data.name as string) ?? null, email: data.email as string } : null;
}
