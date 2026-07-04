import { supabase } from "@/integrations/supabase/client";

export async function listMyClassOverrides(): Promise<Record<string, string>> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return {};
  const { data, error } = await supabase
    .from("class_overrides")
    .select("class_id, custom_name")
    .eq("user_id", uid);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.class_id as string] = r.custom_name as string;
  return map;
}

export async function renameClassSmart(
  classId: string,
  newName: string,
): Promise<"shared" | "personal"> {
  const { data, error } = await supabase.rpc("rename_class_smart", {
    _class_id: classId,
    _new_name: newName.trim(),
  });
  if (error) throw error;
  return (data as "shared" | "personal") ?? "personal";
}
