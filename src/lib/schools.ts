import {
  endAt,
  get,
  limitToFirst,
  orderByChild,
  push,
  query as rtdbQuery,
  ref,
  set,
  startAt,
  update,
} from "firebase/database";
import { rtdb } from "@/integrations/firebase/client";
import { normalizeName, similarity } from "./normalize";
import type { SchoolDoc, SchoolStatus } from "./types";

const ROOT = "schools";

function rowsFromSnap(snap: ReturnType<typeof Object> | unknown): SchoolDoc[] {
  // helper not used; inlined below
  return [];
}
void rowsFromSnap;

export async function searchSchoolsByPrefix(term: string, max = 20): Promise<SchoolDoc[]> {
  const norm = normalizeName(term);
  if (!norm) return listSchools(max);
  const q = rtdbQuery(
    ref(rtdb, ROOT),
    orderByChild("normalizedName"),
    startAt(norm),
    endAt(norm + "\uf8ff"),
    limitToFirst(max),
  );
  const snap = await get(q);
  if (!snap.exists()) return [];
  const out: SchoolDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<SchoolDoc, "id">) });
  });
  return out;
}

export async function listSchools(max = 50): Promise<SchoolDoc[]> {
  const q = rtdbQuery(ref(rtdb, ROOT), orderByChild("normalizedName"), limitToFirst(max));
  const snap = await get(q);
  if (!snap.exists()) return [];
  const out: SchoolDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<SchoolDoc, "id">) });
  });
  return out;
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
  const newRef = push(ref(rtdb, ROOT));
  const payload = {
    name: input.name.trim(),
    normalizedName: normalizeName(input.name),
    city: input.city?.trim() || "",
    state: input.state?.trim() || "",
    createdBy: input.createdBy,
    status,
    createdAt: now,
    updatedAt: now,
  };
  await set(newRef, payload);
  return { id: newRef.key as string, ...payload } as SchoolDoc;
}

export async function getSchool(id: string): Promise<SchoolDoc | null> {
  const snap = await get(ref(rtdb, `${ROOT}/${id}`));
  if (!snap.exists()) return null;
  return { id, ...(snap.val() as Omit<SchoolDoc, "id">) };
}

export async function listAllSchoolsForMaster(): Promise<SchoolDoc[]> {
  const snap = await get(ref(rtdb, ROOT));
  if (!snap.exists()) return [];
  const out: SchoolDoc[] = [];
  snap.forEach((c) => {
    out.push({ id: c.key as string, ...(c.val() as Omit<SchoolDoc, "id">) });
  });
  return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function setSchoolStatus(id: string, status: SchoolStatus) {
  await update(ref(rtdb, `${ROOT}/${id}`), { status, updatedAt: Date.now() });
}

export async function mergeSchools(sourceId: string, targetId: string) {
  const snap = await get(ref(rtdb, "school_memberships"));
  const updates: Record<string, unknown> = {};
  if (snap.exists()) {
    snap.forEach((c) => {
      const v = c.val() as { schoolId?: string };
      if (v.schoolId === sourceId) {
        updates[`school_memberships/${c.key}/schoolId`] = targetId;
      }
    });
  }
  updates[`${ROOT}/${sourceId}/status`] = "merged_into";
  updates[`${ROOT}/${sourceId}/mergedInto`] = targetId;
  updates[`${ROOT}/${sourceId}/updatedAt`] = Date.now();
  await update(ref(rtdb), updates);
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
