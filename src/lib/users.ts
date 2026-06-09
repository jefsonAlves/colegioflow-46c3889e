import { get, ref, set, update } from "firebase/database";
import type { User } from "firebase/auth";
import { rtdb } from "@/integrations/firebase/client";
import { ADMIN_MASTER_EMAIL } from "./constants";
import type { ProfileType, UserDoc } from "./types";

const isMasterEmail = (email: string | null | undefined) =>
  (email ?? "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();

interface LegacyShape {
  nome?: string;
  name?: string;
  email?: string;
  foto?: string;
  photoUrl?: string;
  tipo?: string;
  profileType?: ProfileType;
  onboardingComplete?: boolean;
  globalRole?: "master" | "user";
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

function pickProfileTypeFromLegacy(tipo?: string, profileType?: ProfileType): ProfileType | undefined {
  if (profileType) return profileType;
  if (!tipo) return undefined;
  const t = tipo.toLowerCase();
  if (t.includes("prof")) return "teacher";
  if (t.includes("adm") || t.includes("dir") || t.includes("coord")) return "school_admin";
  if (t.includes("pai") || t.includes("resp") || t.includes("parent")) return "parent";
  return undefined;
}

/**
 * Ensure a user document exists in RTDB at /users/{uid}.
 * On first login, also tries to hydrate from legacy /usuarios/{uid}.
 */
export async function ensureUserDoc(user: User): Promise<UserDoc> {
  const path = `users/${user.uid}`;
  const snap = await get(ref(rtdb, path));
  const now = Date.now();
  const isMaster = isMasterEmail(user.email);

  if (snap.exists()) {
    const existing = snap.val() as LegacyShape;
    const doc: UserDoc = {
      id: user.uid,
      name: existing.name || existing.nome || user.displayName || "",
      email: existing.email || user.email || "",
      photoUrl: existing.photoUrl ?? existing.foto ?? user.photoURL ?? null,
      globalRole: isMaster ? "master" : existing.globalRole ?? "user",
      profileType: pickProfileTypeFromLegacy(existing.tipo, existing.profileType),
      onboardingComplete: Boolean(existing.onboardingComplete),
      active: existing.active !== false,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
    };
    // Normalize back to canonical shape
    await update(ref(rtdb, path), {
      name: doc.name,
      email: doc.email,
      photoUrl: doc.photoUrl,
      globalRole: doc.globalRole,
      profileType: doc.profileType ?? null,
      onboardingComplete: doc.onboardingComplete,
      active: doc.active,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
    return doc;
  }

  // First time — try legacy /usuarios/{uid}
  let legacy: LegacyShape | null = null;
  try {
    const legacySnap = await get(ref(rtdb, `usuarios/${user.uid}`));
    if (legacySnap.exists()) legacy = legacySnap.val() as LegacyShape;
  } catch {
    /* ignore */
  }

  const profileType = pickProfileTypeFromLegacy(legacy?.tipo, legacy?.profileType);
  const doc: UserDoc = {
    id: user.uid,
    name: legacy?.name || legacy?.nome || user.displayName || "",
    email: user.email || legacy?.email || "",
    photoUrl: legacy?.photoUrl ?? legacy?.foto ?? user.photoURL ?? null,
    globalRole: isMaster ? "master" : "user",
    profileType,
    onboardingComplete: Boolean(profileType && (legacy?.name || legacy?.nome)),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await set(ref(rtdb, path), {
    name: doc.name,
    email: doc.email,
    photoUrl: doc.photoUrl,
    globalRole: doc.globalRole,
    profileType: doc.profileType ?? null,
    onboardingComplete: doc.onboardingComplete,
    active: doc.active,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  return doc;
}

export async function updateUserProfile(
  uid: string,
  patch: { name?: string; profileType?: ProfileType; onboardingComplete?: boolean; photoUrl?: string | null },
) {
  const clean: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) clean.name = patch.name;
  if (patch.profileType !== undefined) clean.profileType = patch.profileType;
  if (patch.onboardingComplete !== undefined) clean.onboardingComplete = patch.onboardingComplete;
  if (patch.photoUrl !== undefined) clean.photoUrl = patch.photoUrl;
  await update(ref(rtdb, `users/${uid}`), clean);
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await get(ref(rtdb, `users/${uid}`));
  if (!snap.exists()) return null;
  const v = snap.val() as Omit<UserDoc, "id">;
  return { id: uid, ...v };
}
