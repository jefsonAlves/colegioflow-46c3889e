import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/integrations/firebase/auth";
import { watchAuth } from "@/integrations/firebase/auth";
import { ensureUserDoc, getUserDoc } from "@/lib/users";
import type { UserDoc } from "@/lib/types";

export interface BootError {
  code?: string;
  message: string;
  firestoreMissing?: boolean;
  rulesMissing?: boolean;
}

interface AuthCtx {
  loading: boolean;
  firebaseUser: User | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [bootError, setBootError] = useState<BootError | null>(null);

  const hydrate = useCallback(async (u: User) => {
    setBootError(null);
    try {
      const doc = await ensureUserDoc(u);
      setUserDoc(doc);
    } catch (e) {
      console.error("ensureUserDoc failed", e);
      setUserDoc(null);
      setBootError({ message: (e as Error)?.message ?? "Erro ao carregar perfil." });
    }
  }, []);

  useEffect(() => {
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
      setBootError({ message: (e as Error)?.message ?? "Erro." });
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
