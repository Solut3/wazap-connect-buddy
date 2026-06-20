import { useState, type FormEvent } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { resetPassword } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await resetPassword({ token, password });
      toast.success("Senha atualizada.");
      navigate("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card rounded-2xl">
        <CardHeader><CardTitle>Nova senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Nova senha</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" /></div>
            <Button className="w-full" disabled={loading || !token}>{loading ? "Salvando..." : "Salvar senha"}</Button>
          </form>
          <div className="mt-4 text-sm text-muted-foreground"><Link to="/login">Voltar</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
