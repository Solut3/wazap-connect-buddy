import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";

type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  features: string[];
};

type Billing = {
  planId: string;
  planName: string;
  status: string;
  expiresAt: string | null;
};

const BillingPage = () => {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<{ plans: Plan[] }>("/plans"),
      apiRequest<{ billing: Billing }>("/billing/subscription"),
    ]).then(([p, b]) => {
      setPlans(p.plans);
      setBilling(b.billing);
    });
  }, []);

  const handleSubscribe = async (plan: Plan) => {
    if (plan.price === 0) {
      toast.info("Plano Free já disponível.");
      return;
    }
    setLoading(plan.id);
    try {
      const response = await apiRequest<{ checkoutUrl?: string; mock?: boolean }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id,
          customerName: user?.name,
          customerEmail: user?.email,
        }),
      });
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        toast.success("Assinatura criada (modo simulado).");
        await refresh();
      }
    } catch (error) {
      toast.error((error as Error).message || "Erro no checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Planos & Cobrança</h1>
              <p className="text-xs text-muted-foreground">Gerencie sua assinatura via Mercado Pago</p>
            </div>
          </header>

          {billing && (
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Sua assinatura</p>
                  <p className="text-lg font-semibold">{billing.planName}</p>
                  {billing.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Próxima cobrança: {new Date(billing.expiresAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Badge variant={billing.status === "active" ? "default" : "secondary"} className="rounded-md capitalize">
                  {billing.status}
                </Badge>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {plans.map((plan) => {
              const current = billing?.planId === plan.id;
              return (
                <Card key={plan.id} className={`glass-card rounded-2xl ${current ? "border-primary/60" : ""}`}>
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold">{plan.name}</p>
                        {current && <Badge className="rounded-md">Atual</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        {plan.price === 0 ? "Grátis" : `R$ ${plan.price}`}
                      </p>
                      {plan.price > 0 && <p className="text-xs text-muted-foreground">/ {plan.interval}</p>}
                    </div>
                    <ul className="space-y-1.5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs flex items-start gap-1.5">
                          <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => handleSubscribe(plan)}
                      disabled={current || loading === plan.id}
                      className="rounded-xl mt-2"
                      variant={current ? "secondary" : "default"}
                    >
                      {loading === plan.id ? "Aguarde…" : current ? "Plano atual" : (
                        <span className="flex items-center gap-1.5">
                          Assinar <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Pagamentos processados via Mercado Pago. Você será redirecionado para o checkout seguro.
          </p>
        </div>
      </div>
    </PageTransition>
  );
};

export default BillingPage;