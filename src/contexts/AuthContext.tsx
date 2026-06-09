import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "@/integrations/firebase/auth";
import { consumeRedirectResult, watchAuth } from "@/integrations/firebase/auth";
import { ensureUserDoc, getUserDoc } from "@/lib/users";
import type { UserDoc } from "@/lib/types";

export interface BootError {
  code?: string;
  message: string;
}


interface AuthCtx {
  loading: boolean;
  firebaseUser: AuthUser | null;
  userDoc: UserDoc | null;
  bootError: BootError | null;
  refresh: () => Promise<void>;
  retryBoot: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  loading: true,
  firebaseUser: null,
  userDoc: null,
  bootError: null,
  refresh: async () => {},
  retryBoot: async () => {},
});

function parseError(e: unknown): BootError {
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? "Erro desconhecido.";
  const code = err?.code;
  return { code, message: msg };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<AuthUser | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [bootError, setBootError] = useState<BootError | null>(null);

  const hydrate = useCallback(async (u: AuthUser) => {
    setBootError(null);
    try {
      const doc = await ensureUserDoc(u);
      setUserDoc(doc);
    } catch (e) {
      console.error("ensureUserDoc failed", e);
      setUserDoc(null);
      setBootError(parseError(e));
    }
  }, []);

  useEffect(() => {
    consumeRedirectResult().catch((e) => console.warn("redirect result", e));

    const unsub = watchAuth(async (u) => {
      setFirebaseUser(u);
      if (u) {
        await hydrate(u);
      } else {
        setUserDoc(null);
        setBootError(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [hydrate]);

  const refresh = async () => {
    if (!firebaseUser) return;
    try {
      const d = await getUserDoc(firebaseUser.uid);
      setUserDoc(d);
      setBootError(null);
    } catch (e) {
      setBootError(parseError(e));
    }
  };

  const retryBoot = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    await hydrate(firebaseUser);
    setLoading(false);
  };

  return (
    <Ctx.Provider value={{ loading, firebaseUser, userDoc, bootError, refresh, retryBoot }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
