import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await forgotPassword({ email });
      if (response.resetToken) setToken(response.resetToken);
      toast.success("Pedido enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na recuperação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card rounded-2xl">
        <CardHeader><CardTitle>Recuperar senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
            <Button className="w-full" disabled={loading}>{loading ? "Enviando..." : "Enviar recuperação"}</Button>
          </form>
          {token && <p className="mt-4 rounded-xl border border-border/60 bg-secondary/50 p-3 text-xs break-all">Token: {token}</p>}
          <div className="mt-4 text-sm text-muted-foreground"><Link to="/login">Voltar</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
