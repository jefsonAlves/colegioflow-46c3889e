// Shim that preserves the old "firebase/auth" import surface but is backed by Supabase.
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type UserCredential = { user: User };

function toUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): User | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: (meta.full_name as string) || (meta.name as string) || null,
    photoURL: (meta.avatar_url as string) || (meta.picture as string) || null,
  };
}

export async function signInWithGoogle(redirectUri?: string) {
  const redirect_uri =
    redirectUri ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  const result = await lovable.auth.signInWithOAuth("google", { redirect_uri });
  if (result?.error) throw result.error;
}


export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: toUser(data.user)! };
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/app` : undefined;
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
  return { user: toUser(data.user)! };
}

export async function consumeRedirectResult() {
  // Supabase handles the callback automatically via detectSessionInUrl.
  return null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function watchAuth(cb: (u: User | null) => void): () => void {
  // onAuthStateChange fires INITIAL_SESSION on subscribe, so no manual getSession needed.
  let lastUid: string | null | undefined = undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Ignore TOKEN_REFRESHED to avoid re-hydrating the profile on token rotation.
    if (event === "TOKEN_REFRESHED") return;
    const user = toUser(session?.user ?? null);
    const uid = user?.uid ?? null;
    if (uid === lastUid && event !== "USER_UPDATED") return;
    lastUid = uid;
    cb(user);
  });
  return () => data.subscription.unsubscribe();
}
