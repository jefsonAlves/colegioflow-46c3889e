import { get, push, ref, remove, set, update } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";

export interface ClassDoc {
  id: string;
  name: string;
  year: number;
  teacherUid: string | null;
  createdBy: string;
  createdAt: number;
}

export async function listClasses(schoolId: string): Promise<ClassDoc[]> {
  const snap = await get(ref(rtdb, `classes/${schoolId}`));
  if (!snap.exists()) return [];
  const out: ClassDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<ClassDoc, "id">) });
  });
  return out.sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.name.localeCompare(b.name));
}

export async function createClass(
  schoolId: string,
  input: { name: string; year: number; teacherUid?: string | null; createdBy: string },
): Promise<ClassDoc> {
  const now = Date.now();
  const newRef = push(ref(rtdb, `classes/${schoolId}`));
  const payload = {
    name: input.name.trim(),
    year: input.year,
    teacherUid: input.teacherUid ?? null,
    createdBy: input.createdBy,
    createdAt: now,
  };
  await set(newRef, payload);
  return { id: newRef.key as string, ...payload };
}

export async function getClass(schoolId: string, classId: string): Promise<ClassDoc | null> {
  const snap = await get(ref(rtdb, `classes/${schoolId}/${classId}`));
  if (!snap.exists()) return null;
  return { id: classId, ...(snap.val() as Omit<ClassDoc, "id">) };
}

export async function updateClass(
  schoolId: string,
  classId: string,
  patch: Partial<Omit<ClassDoc, "id">>,
) {
  await update(ref(rtdb, `classes/${schoolId}/${classId}`), patch);
}

export async function deleteClass(schoolId: string, classId: string) {
  await remove(ref(rtdb, `classes/${schoolId}/${classId}`));
}
