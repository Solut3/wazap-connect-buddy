import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
      toast.success("Login realizado.");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card rounded-2xl">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </div>
            <Button className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <Link to="/forgot-password">Recuperar senha</Link>
            <Link to="/register">Criar conta</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
