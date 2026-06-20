import { useEffect, useMemo, useState } from "react";
import {
  connectInstance,
  createCampaign,
  createBillingCheckout,
  getInstanceStatus,
  listCampaigns,
  listPlans,
  runCampaign,
  sendMediaMessage,
  sendTextMessage,
  type EvolutionPlan,
  type EvolutionInstanceStatus,
} from "@/lib/evolution-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, QrCode, Send, Megaphone, CreditCard, Wifi, Plus, Play } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/context/auth-context";

const tenantIdDefault = "default";

const Evolution = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState(tenantIdDefault);
  const [instanceName, setInstanceName] = useState("main");
  const [status, setStatus] = useState<EvolutionInstanceStatus | null>(null);
  const [plans, setPlans] = useState<EvolutionPlan[]>([]);
  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [campaignName, setCampaignName] = useState("");
  const [campaignRecipients, setCampaignRecipients] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const hasQr = useMemo(() => Boolean(qrCode || status?.qrCode), [qrCode, status]);

  useEffect(() => {
    if (user?.tenantId) {
      setTenantId(user.tenantId);
    }
  }, [user?.tenantId]);

  const refreshStatus = async () => {
    try {
      const next = await getInstanceStatus(tenantId, instanceName);
      setStatus(next);
      setQrCode(next.qrCode);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar o status da instância.");
    }
  };

  const refreshCampaigns = async () => {
    try {
      const next = await listCampaigns(tenantId);
      setCampaigns(next.campaigns);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshPlans = async () => {
    try {
      const next = await listPlans();
      setPlans(next.plans);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível carregar os planos.");
    }
  };

  useEffect(() => {
    void refreshStatus();
    void refreshPlans();
    void refreshCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const next = await connectInstance({ tenantId, instanceName });
      setQrCode(next.qrCode || null);
      await refreshStatus();
      toast.success("Instância conectada ou preparada com QR code.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao conectar instância.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendText = async () => {
    if (!phone || !message) {
      toast.error("Informe telefone e mensagem.");
      return;
    }

    setLoading(true);
    try {
      if (mediaFile) {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
          reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
          reader.readAsDataURL(mediaFile);
        });

        await sendMediaMessage({
          tenantId,
          instanceName,
          phone,
          message,
          fileBase64,
          fileName: mediaFile.name,
          mimeType: mediaFile.type || "application/octet-stream",
        });
      } else {
        await sendTextMessage({ tenantId, instanceName, phone, message });
      }

      toast.success("Mensagem enviada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar mensagem.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    const recipients = campaignRecipients
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!campaignName || !campaignMessage || recipients.length === 0) {
      toast.error("Preencha nome, mensagem e destinatários.");
      return;
    }

    setLoading(true);
    try {
      await createCampaign({
        tenantId,
        instanceName,
        name: campaignName,
        message: campaignMessage,
        recipients,
      });
      setCampaignName("");
      setCampaignRecipients("");
      setCampaignMessage("");
      await refreshCampaigns();
      toast.success("Campanha criada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar campanha.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunCampaign = async (id: string) => {
    setLoading(true);
    try {
      await runCampaign(id, tenantId);
      await refreshCampaigns();
      toast.success("Campanha executada.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar campanha.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setLoading(true);
    try {
      const response = await createBillingCheckout({
        tenantId,
        planId,
        customerName,
        customerEmail,
      });
      if (response.checkoutUrl) {
        window.open(response.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      toast.success(response.mock ? "Plano em modo mock." : "Checkout criado.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar assinatura.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background p-4 pb-20">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => navigate("/")} className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Badge variant={status?.ready ? "default" : "secondary"} className="rounded-full px-3 py-1">
              <Wifi className="mr-2 h-3.5 w-3.5" />
              {status?.ready ? "Conectado" : status?.mock ? "Mock local" : "Aguardando QR"}
            </Badge>
          </div>

          <Card className="glass-card rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Evolution API Control Center</CardTitle>
              <p className="text-sm text-muted-foreground">
                Conecte instância, gere QR, envie mensagens, rode campanhas e selecione planos.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Instância</Label>
                <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleConnect} disabled={loading} className="w-full rounded-xl">
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle>QR Code e Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  {hasQr ? (
                    <img
                      src={qrCode || status?.qrCode || ""}
                      alt="QR Code"
                      className="mx-auto h-64 w-64 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
                      Gere a instância para visualizar o QR code.
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-1 font-semibold">{status?.status || "idle"}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pronto</p>
                    <p className="mt-1 font-semibold">{status?.ready ? "Sim" : "Não"}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Modo</p>
                    <p className="mt-1 font-semibold">{status?.mock ? "Mock local" : "Evolution"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl p-1">
                <TabsTrigger value="send" className="rounded-xl">
                  <Send className="mr-2 h-4 w-4" />
                  Mensagem
                </TabsTrigger>
                <TabsTrigger value="campaign" className="rounded-xl">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Campanha
                </TabsTrigger>
                <TabsTrigger value="plans" className="rounded-xl">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Planos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="send" className="mt-4 space-y-4">
                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle>Enviar mensagens</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" />
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite sua mensagem" />
                    </div>
                    <div className="space-y-2">
                      <Label>Anexo opcional</Label>
                      <Input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
                    </div>
                    <Button onClick={handleSendText} disabled={loading} className="w-full rounded-xl">
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="campaign" className="mt-4 space-y-4">
                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle>Criar campanhas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome da campanha</Label>
                      <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Destinatários</Label>
                      <Textarea value={campaignRecipients} onChange={(e) => setCampaignRecipients(e.target.value)} placeholder="5511999999999,5511888888888" />
                    </div>
                    <Button onClick={handleCreateCampaign} disabled={loading} className="w-full rounded-xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Salvar campanha
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle>Campanhas recentes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {campaigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>
                    ) : (
                      campaigns.map((campaign) => (
                        <div key={String(campaign.id)} className="rounded-xl border border-border/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{String(campaign.name)}</p>
                              <p className="text-xs text-muted-foreground">{String(campaign.status || "draft")}</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => handleRunCampaign(String(campaign.id))}>
                              <Play className="mr-2 h-4 w-4" />
                              Executar
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="plans" className="mt-4 space-y-4">
                <Card className="glass-card rounded-2xl">
                  <CardHeader>
                    <CardTitle>Planos pagos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do cliente</Label>
                        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail do cliente</Label>
                        <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {plans.map((plan) => (
                        <div key={plan.id} className="rounded-2xl border border-border/60 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold">{plan.name}</h3>
                              <p className="text-sm text-muted-foreground">{plan.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">
                                {plan.currency} {plan.price}
                              </p>
                              <p className="text-xs text-muted-foreground">/{plan.interval}</p>
                            </div>
                          </div>
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {plan.features.map((feature) => (
                              <li key={feature} className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <Button className="mt-4 w-full rounded-xl" onClick={() => handleSubscribe(plan.id)} disabled={loading}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Assinar plano
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default Evolution;