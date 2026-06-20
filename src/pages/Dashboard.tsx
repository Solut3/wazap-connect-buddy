import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, MessageSquare, Users, AlertTriangle, ArrowLeft, Zap } from "lucide-react";
import PageTransition from "@/components/PageTransition";

type Summary = {
  cards: {
    sentToday: number;
    sentMonth: number;
    delivered: number;
    failed: number;
    contacts: number;
    instances: number;
  };
  series: { date: string; count: number }[];
  connection: { instanceName: string; status: string } | null;
  billing: { planName: string; status: string; expiresAt: string | null };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Summary>("/analytics/summary")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Hoje", value: data?.cards.sentToday ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "No mês", value: data?.cards.sentMonth ?? 0, icon: Activity, color: "text-primary" },
    { label: "Contatos", value: data?.cards.contacts ?? 0, icon: Users, color: "text-muted-foreground" },
    { label: "Falhas", value: data?.cards.failed ?? 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Dashboard</h1>
                <p className="text-xs text-muted-foreground">Tenant {user?.tenantId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigate("/messages")} className="rounded-xl">
                Mensagens
              </Button>
              <Button variant="secondary" onClick={() => navigate("/billing")} className="rounded-xl">
                Planos
              </Button>
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((card) => (
              <Card key={card.label} className="glass-card rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{card.label}</span>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <p className="text-2xl font-bold">{loading ? "—" : card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="glass-card rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-primary/80">Últimos 30 dias</p>
                  <h2 className="text-sm font-semibold">Envios diários</h2>
                </div>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.series || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-3">
            <Card className="glass-card rounded-2xl">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Conexão WhatsApp</p>
                {data?.connection ? (
                  <>
                    <p className="font-semibold">{data.connection.instanceName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{data.connection.status}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma instância conectada</p>
                )}
                <Button variant="link" className="px-0 mt-2 text-primary" onClick={() => navigate("/evolution")}>
                  Gerenciar →
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Plano atual</p>
                <p className="font-semibold">{data?.billing.planName || "Free"}</p>
                <p className="text-sm text-muted-foreground capitalize">{data?.billing.status || "free"}</p>
                {data?.billing.expiresAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expira em {new Date(data.billing.expiresAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
                <Button variant="link" className="px-0 mt-2 text-primary" onClick={() => navigate("/billing")}>
                  Gerenciar →
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Dashboard;