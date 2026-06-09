import { supabase } from "@/integrations/supabase/client";
import { normalizeName, similarity } from "./normalize";
import type { SchoolDoc, SchoolStatus } from "./types";

type Row = {
  id: string;
  name: string;
  normalized_name: string;
  city: string | null;
  state: string | null;
  created_by: string;
  status: SchoolStatus;
  merged_into: string | null;
  created_at: string;
  updated_at: string;
};

function rowToDoc(r: Row): SchoolDoc {
  return {
    id: r.id,
    name: r.name,
    normalizedName: r.normalized_name,
    city: r.city ?? undefined,
    state: r.state ?? undefined,
    createdBy: r.created_by,
    status: r.status,
    mergedInto: r.merged_into ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function searchSchoolsByPrefix(term: string, max = 20): Promise<SchoolDoc[]> {
  const norm = normalizeName(term);
  let q = supabase.from("schools").select("*").order("normalized_name").limit(max);
  if (norm) q = q.ilike("normalized_name", `${norm}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => rowToDoc(r as Row));
}

export async function listSchools(max = 50): Promise<SchoolDoc[]> {
  const { data, error } = await supabase.from("schools").select("*").order("normalized_name").limit(max);
  if (error) throw error;
  return (data ?? []).map((r) => rowToDoc(r as Row));
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
  const status: SchoolStatus = input.isMaster ? "active" : "pending";
  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: input.name.trim(),
      normalized_name: normalizeName(input.name),
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      created_by: input.createdBy,
      status,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToDoc(data as Row);
}

export async function getSchool(id: string): Promise<SchoolDoc | null> {
  const { data } = await supabase.from("schools").select("*").eq("id", id).maybeSingle();
  return data ? rowToDoc(data as Row) : null;
}

export async function listAllSchoolsForMaster(): Promise<SchoolDoc[]> {
  const { data, error } = await supabase.from("schools").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToDoc(r as Row));
}

export async function setSchoolStatus(id: string, status: SchoolStatus) {
  const { error } = await supabase.from("schools").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function mergeSchools(sourceId: string, targetId: string) {
  await supabase.from("school_memberships").update({ school_id: targetId }).eq("school_id", sourceId);
  await supabase.from("schools").update({ status: "merged_into", merged_into: targetId }).eq("id", sourceId);
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
