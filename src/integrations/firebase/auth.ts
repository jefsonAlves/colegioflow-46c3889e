import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "./client";

/**
 * Try popup first; if the popup is blocked or closed, fall back to redirect.
 * Surfaces auth/unauthorized-domain so the UI can render a helpful message.
 */
export async function signInWithGoogle(): Promise<UserCredential | void> {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw e;
  }
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function consumeRedirectResult() {
  return getRedirectResult(auth);
}

export function signOut() {
  return fbSignOut(auth);
}

export function watchAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}
