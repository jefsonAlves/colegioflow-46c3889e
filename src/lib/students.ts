import { get, push, ref, set, update } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";

export interface StudentDoc {
  id: string;
  name: string;
  classId: string;
  parentUid?: string | null;
  active: boolean;
  createdAt: number;
}

export async function listStudents(schoolId: string): Promise<StudentDoc[]> {
  const snap = await get(ref(rtdb, `students/${schoolId}`));
  if (!snap.exists()) return [];
  const out: StudentDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<StudentDoc, "id">) });
  });
  return out;
}

export async function listStudentsByClass(
  schoolId: string,
  classId: string,
): Promise<StudentDoc[]> {
  const all = await listStudents(schoolId);
  return all
    .filter((s) => s.classId === classId && s.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createStudent(
  schoolId: string,
  input: { name: string; classId: string; parentUid?: string },
): Promise<StudentDoc> {
  const now = Date.now();
  const newRef = push(ref(rtdb, `students/${schoolId}`));
  const payload = {
    name: input.name.trim(),
    classId: input.classId,
    parentUid: input.parentUid ?? null,
    active: true,
    createdAt: now,
  };
  await set(newRef, payload);
  return { id: newRef.key as string, ...payload };
}

export async function updateStudent(
  schoolId: string,
  studentId: string,
  patch: Partial<Omit<StudentDoc, "id">>,
) {
  await update(ref(rtdb, `students/${schoolId}/${studentId}`), patch);
}
