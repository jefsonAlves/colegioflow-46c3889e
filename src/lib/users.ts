import { supabase } from "@/integrations/supabase/client";
import type { AuthUser } from "@/integrations/firebase/auth";
import { ADMIN_MASTER_EMAIL } from "./constants";
import type { ProfileType, UserDoc, GlobalRole } from "./types";

const isMasterEmail = (email: string | null | undefined) =>
  (email ?? "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();

async function fetchRole(uid: string): Promise<GlobalRole> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid);
  if (data?.some((r) => r.role === "master")) return "master";
  return "user";
}

function rowToDoc(row: Record<string, unknown>, role: GlobalRole): UserDoc {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    email: (row.email as string) ?? "",
    photoUrl: (row.photo_url as string | null) ?? null,
    globalRole: role,
    profileType: (row.profile_type as ProfileType | undefined) ?? undefined,
    onboardingComplete: Boolean(row.onboarding_complete),
    active: row.active !== false,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
  };
}

export async function ensureUserDoc(user: AuthUser): Promise<UserDoc> {
  // Trigger handle_new_user on auth.users insert already creates rows.
  // For older accounts (or race), upsert idempotently.
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.uid)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").insert({
      id: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photo_url: user.photoURL,
      onboarding_complete: false,
    });
  }

  // Ensure role is correct for the master email.
  if (isMasterEmail(user.email)) {
    await supabase
      .from("user_roles")
      .upsert({ user_id: user.uid, role: "master" }, { onConflict: "user_id,role" });
  } else {
    // ensure at least 'user' role exists
    await supabase
      .from("user_roles")
      .upsert({ user_id: user.uid, role: "user" }, { onConflict: "user_id,role" });
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.uid)
    .single();

  const role = await fetchRole(user.uid);
  return rowToDoc(row as Record<string, unknown>, role);
}

export async function updateUserProfile(
  uid: string,
  patch: { name?: string; profileType?: ProfileType; onboardingComplete?: boolean; photoUrl?: string | null },
) {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.profileType !== undefined) update.profile_type = patch.profileType;
  if (patch.onboardingComplete !== undefined) update.onboarding_complete = patch.onboardingComplete;
  if (patch.photoUrl !== undefined) update.photo_url = patch.photoUrl;
  const { error } = await supabase.from("profiles").update(update).eq("id", uid);
  if (error) throw error;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (!data) return null;
  const role = await fetchRole(uid);
  return rowToDoc(data as Record<string, unknown>, role);
}
