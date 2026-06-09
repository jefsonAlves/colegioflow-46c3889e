import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { normalizeName, similarity } from "./normalize";
import type { SchoolDoc, SchoolStatus } from "./types";

const SCHOOLS = collection(db, "schools");

export async function searchSchoolsByPrefix(term: string, max = 20): Promise<SchoolDoc[]> {
  const norm = normalizeName(term);
  if (!norm) return listSchools(max);
  const end = norm + "\uf8ff";
  const q = query(
    SCHOOLS,
    where("normalizedName", ">=", norm),
    where("normalizedName", "<=", end),
    orderBy("normalizedName"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolDoc, "id">) }));
}

export async function listSchools(max = 50): Promise<SchoolDoc[]> {
  const q = query(SCHOOLS, orderBy("normalizedName"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolDoc, "id">) }));
}

export async function findSimilarSchools(name: string, threshold = 0.7): Promise<SchoolDoc[]> {
  const all = await listSchools(200);
  return all
    .map((s) => ({ s, score: similarity(name, s.name) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.s);
}

export async function createSchool(input: {
  name: string;
  city?: string;
  state?: string;
  createdBy: string;
  isMaster: boolean;
}): Promise<SchoolDoc> {
  const now = Date.now();
  const status: SchoolStatus = input.isMaster ? "active" : "pending";
  const payload = {
    name: input.name.trim(),
    normalizedName: normalizeName(input.name),
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    createdBy: input.createdBy,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(SCHOOLS, payload);
  return {
    id: ref.id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  } as SchoolDoc;
}

export async function getSchool(id: string): Promise<SchoolDoc | null> {
  const snap = await getDoc(doc(db, "schools", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SchoolDoc, "id">) };
}

export async function listAllSchoolsForMaster(): Promise<SchoolDoc[]> {
  const snap = await getDocs(query(SCHOOLS, orderBy("createdAt", "desc"), limit(500)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SchoolDoc, "id">) }));
}

export async function setSchoolStatus(id: string, status: SchoolStatus) {
  await updateDoc(doc(db, "schools", id), { status, updatedAt: serverTimestamp() });
}

export async function mergeSchools(sourceId: string, targetId: string) {
  // Move memberships from source -> target, mark source as merged_into.
  const memColl = collection(db, "school_memberships");
  const snap = await getDocs(query(memColl, where("schoolId", "==", sourceId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { schoolId: targetId }));
  batch.update(doc(db, "schools", sourceId), {
    status: "merged_into" as SchoolStatus,
    mergedInto: targetId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export function groupPossibleDuplicates(schools: SchoolDoc[]): SchoolDoc[][] {
  const groups: SchoolDoc[][] = [];
  const used = new Set<string>();
  for (const s of schools) {
    if (used.has(s.id) || s.status === "merged_into") continue;
    const group = [s];
    used.add(s.id);
    for (const other of schools) {
      if (used.has(other.id) || other.status === "merged_into") continue;
      if (similarity(s.name, other.name) >= 0.82) {
        group.push(other);
        used.add(other.id);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}
