import { supabase } from "@/integrations/supabase/client";

export interface ClassTeacher {
  id: string;
  classId: string;
  userId: string;
  schoolId: string;
  createdAt: number;
}

type Row = {
  id: string;
  class_id: string;
  user_id: string;
  school_id: string;
  created_at: string;
};

const toDoc = (r: Row): ClassTeacher => ({
  id: r.id,
  classId: r.class_id,
  userId: r.user_id,
  schoolId: r.school_id,
  createdAt: new Date(r.created_at).getTime(),
});

export async function listClassTeachers(classId: string): Promise<ClassTeacher[]> {
  const { data, error } = await supabase
    .from("class_teachers")
    .select("*")
    .eq("class_id", classId);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function listMyTaughtClasses(userId: string): Promise<ClassTeacher[]> {
  const { data, error } = await supabase
    .from("class_teachers")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => toDoc(r as Row));
}

export async function teachClass(input: {
  classId: string;
  schoolId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.from("class_teachers").insert({
    class_id: input.classId,
    school_id: input.schoolId,
    user_id: input.userId,
  });
  if (error && !/duplicate key/i.test(error.message)) throw error;
}

export async function untaughtClass(input: {
  classId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("class_teachers")
    .delete()
    .eq("class_id", input.classId)
    .eq("user_id", input.userId);
  if (error) throw error;
}
