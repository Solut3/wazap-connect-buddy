import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSession, logout, type SessionBilling, type SessionUser } from "@/lib/session";

type AuthState = {
  user: SessionUser | null;
  billing: SessionBilling | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [billing, setBilling] = useState<SessionBilling | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const session = await getSession();
      setUser(session.user);
      setBilling(session.billing);
    } catch {
      setUser(null);
      setBilling(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signOut = async () => {
    await logout();
    setUser(null);
    setBilling(null);
  };

  return <AuthContext.Provider value={{ user, billing, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
