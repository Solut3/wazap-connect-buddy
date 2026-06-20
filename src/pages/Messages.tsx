import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import PageTransition from "@/components/PageTransition";

type Message = {
  id: string;
  createdAt: string;
  tenantId: string;
  instanceName?: string;
  phone?: string;
  message?: string;
  type: string;
  status: "sent" | "failed";
  error?: string;
  campaignId?: string;
};

type Response = {
  messages: Message[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
};

const Messages = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | "sent" | "failed">("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (status) params.set("status", status);
    if (phone) params.set("phone", phone);
    setLoading(true);
    apiRequest<Response>(`/messages?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, status, phone]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="mx-auto max-w-4xl space-y-4">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold gradient-text">Histórico</h1>
            </div>
            <p className="text-xs text-muted-foreground">{data?.pagination.total ?? 0} mensagens</p>
          </header>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por telefone…"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPage(1);
                }}
                className="pl-10 glass-card rounded-xl"
              />
            </div>
            {(["", "sent", "failed"] as const).map((s) => (
              <Button
                key={s || "all"}
                variant={status === s ? "default" : "secondary"}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className="rounded-xl"
              >
                {s === "" ? "Todas" : s === "sent" ? "Enviadas" : "Falhas"}
              </Button>
            ))}
          </div>

          <Card className="glass-card rounded-2xl">
            <CardContent className="p-0 divide-y divide-border/40">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
              ) : (data?.messages.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma mensagem encontrada</div>
              ) : (
                data!.messages.map((m) => (
                  <div key={m.id} className="p-4 flex items-start gap-3">
                    <Badge variant={m.status === "sent" ? "default" : "destructive"} className="rounded-md">
                      {m.status === "sent" ? "OK" : "Falha"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{m.phone || "—"}</p>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {m.type} · {m.instanceName || "—"}
                        {m.campaignId ? " · campanha" : ""}
                      </p>
                      {m.message && <p className="text-sm mt-1.5 line-clamp-2">{m.message}</p>}
                      {m.error && <p className="text-xs text-destructive mt-1">{m.error}</p>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {data.pagination.page} de {data.pagination.pages}
              </span>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
                disabled={page >= data.pagination.pages}
                className="rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default Messages;