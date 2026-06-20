import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await register({ name, email, password, tenantName });
      toast.success("Conta criada.");
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card rounded-2xl">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tenant / Empresa</Label><Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
            <div className="space-y-2"><Label>Senha</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></div>
            <Button className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground">
            <Link to="/login">Já tenho conta</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
