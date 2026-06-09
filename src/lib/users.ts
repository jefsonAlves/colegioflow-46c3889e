import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/integrations/firebase/client";
import { ADMIN_MASTER_EMAIL } from "./constants";
import type { ProfileType, UserDoc } from "./types";

export async function ensureUserDoc(user: User): Promise<UserDoc> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const now = Date.now();
  if (!snap.exists()) {
    const isMaster = (user.email ?? "").toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();
    const data: UserDoc = {
      id: user.uid,
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoUrl: user.photoURL ?? null,
      globalRole: isMaster ? "master" : "user",
      onboardingComplete: false,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return data;
  }
  return { id: snap.id, ...(snap.data() as Omit<UserDoc, "id">) };
}

export async function updateUserProfile(
  uid: string,
  patch: { name?: string; profileType?: ProfileType; onboardingComplete?: boolean },
) {
  await updateDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() });
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<UserDoc, "id">) };
}
