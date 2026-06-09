// Compatibility shim — uses Lovable Cloud (Supabase) under the hood.
// Keeps the firebase/* import paths working without changing every caller.
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export interface AuthUser {
  uid: string;
  email: string | null;
  photoURL: string | null;
  displayName: string | null;
}

function toUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    uid: u.id,
    email: u.email ?? null,
    photoURL: (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null,
    displayName: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
  };
}

export async function signInWithGoogle() {
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  if ("error" in result && result.error) throw result.error;
  return result;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
  if (error) throw error;
  return data;
}

export async function consumeRedirectResult() {
  // Lovable broker handles tokens directly; no-op for parity with Firebase API.
  return null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export function watchAuth(cb: (u: AuthUser | null) => void) {
  // Fire current session immediately, then subscribe.
  supabase.auth.getSession().then(({ data }) => cb(toUser(data.session?.user ?? null)));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(toUser(session?.user ?? null));
  });
  return () => sub.subscription.unsubscribe();
}
