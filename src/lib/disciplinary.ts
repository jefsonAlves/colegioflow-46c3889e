import { get, push, ref, set } from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";

export type DisciplinaryType = "verbal" | "escrita" | "grave";

export interface DisciplinaryDoc {
  id: string;
  studentId: string;
  classId: string;
  type: DisciplinaryType;
  description: string;
  date: string;
  by: string;
  createdAt: number;
}

export async function listDisciplinary(schoolId: string): Promise<DisciplinaryDoc[]> {
  const snap = await get(ref(rtdb, `disciplinary/${schoolId}`));
  if (!snap.exists()) return [];
  const out: DisciplinaryDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<DisciplinaryDoc, "id">) });
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createDisciplinary(
  schoolId: string,
  input: Omit<DisciplinaryDoc, "id" | "createdAt">,
): Promise<DisciplinaryDoc> {
  const now = Date.now();
  const newRef = push(ref(rtdb, `disciplinary/${schoolId}`));
  const payload = { ...input, createdAt: now };
  await set(newRef, payload);
  return { id: newRef.key as string, ...payload };
}
