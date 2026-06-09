import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/integrations/firebase/auth";
import { ADMIN_MASTER_EMAIL } from "./constants";
import type { ProfileType, UserDoc, GlobalRole } from "./types";

const isMasterEmail = (email: string | null | undefined) =>
  (email ?? "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  profile_type: ProfileType | null;
  onboarding_complete: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

async function fetchRole(uid: string): Promise<GlobalRole> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r) => r.role as string);
  return roles.includes("master") ? "master" : "user";
}

function rowToDoc(r: ProfileRow, role: GlobalRole): UserDoc {
  return {
    id: r.id,
    name: r.name ?? "",
    email: r.email ?? "",
    photoUrl: r.photo_url,
    globalRole: role,
    profileType: r.profile_type ?? undefined,
    onboardingComplete: !!r.onboarding_complete,
    active: r.active !== false,
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

export async function ensureUserDoc(user: User): Promise<UserDoc> {
  // The handle_new_user DB trigger creates the profile + role on first sign-in.
  // We just read it; if the trigger hasn't run yet (race), we retry briefly.
  void isMasterEmail; // silence unused warning, keep helper for future use
  for (let i = 0; i < 5; i++) {
    const { data: existing, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.uid)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      const role = await fetchRole(user.uid);
      return rowToDoc(existing as ProfileRow, role);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Trigger didn't create it — fall back to client insert (RLS allows self).
  const { data: inserted, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photo_url: user.photoURL,
      onboarding_complete: false,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  const role = await fetchRole(user.uid);
  return rowToDoc(inserted as ProfileRow, role);
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!data) return null;
  const role = await fetchRole(uid);
  return rowToDoc(data as ProfileRow, role);
}

export async function updateUserProfile(
  uid: string,
  patch: { name?: string; profileType?: ProfileType; onboardingComplete?: boolean; photoUrl?: string | null },
) {
  const row: Partial<ProfileRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.profileType !== undefined) row.profile_type = patch.profileType;
  if (patch.onboardingComplete !== undefined) row.onboarding_complete = patch.onboardingComplete;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  const { error } = await supabase.from("profiles").update(row).eq("id", uid);
  if (error) throw error;
}
