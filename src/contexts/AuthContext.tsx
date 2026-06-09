import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { watchAuth } from "@/integrations/firebase/auth";
import { ensureUserDoc, getUserDoc } from "@/lib/users";
import type { UserDoc } from "@/lib/types";

interface AuthCtx {
  loading: boolean;
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  loading: true,
  firebaseUser: null,
  userDoc: null,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

  useEffect(() => {
    const unsub = watchAuth(async (u) => {
      setFirebaseUser(u);
      if (u) {
        try {
          const doc = await ensureUserDoc(u);
          setUserDoc(doc);
        } catch (e) {
          console.error("ensureUserDoc failed", e);
          setUserDoc(null);
        }
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const refresh = async () => {
    if (!firebaseUser) return;
    const d = await getUserDoc(firebaseUser.uid);
    setUserDoc(d);
  };

  return (
    <Ctx.Provider value={{ loading, firebaseUser, userDoc, refresh }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
