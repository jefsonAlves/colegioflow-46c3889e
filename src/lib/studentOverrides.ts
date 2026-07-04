import { supabase } from "@/integrations/supabase/client";

export async function listMyStudentOverrides(): Promise<Record<string, string>> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return {};
  const { data, error } = await supabase
    .from("student_overrides")
    .select("student_id, custom_name")
    .eq("user_id", uid);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of data ?? []) {
    const name = r.custom_name as string | null;
    if (name) map[r.student_id as string] = name;
  }
  return map;
}

export async function renameStudentSmart(
  studentId: string,
  newName: string,
): Promise<"shared" | "personal"> {
  const { data, error } = await supabase.rpc("rename_student_smart", {
    _student_id: studentId,
    _new_name: newName.trim(),
  });
  if (error) throw error;
  return (data as "shared" | "personal") ?? "personal";
}
