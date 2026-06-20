import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import type { ReactElement } from "react";

export default function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
