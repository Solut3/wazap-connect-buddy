const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao comunicar com o backend Evolution.");
  }

  return payload as T;
}

export type EvolutionInstanceStatus = {
  exists: boolean;
  ready: boolean;
  status: string;
  qrCode: string | null;
  mock?: boolean;
  error?: string | null;
};

export type EvolutionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  features: string[];
};

export async function connectInstance(payload: { tenantId?: string; instanceName: string }) {
  return request<{ ok: boolean; qrCode?: string; status?: string; ready?: boolean; mock?: boolean }>(
    "/evolution/connect",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function getInstanceStatus(tenantId: string, instanceName: string) {
  return request<EvolutionInstanceStatus>(`/evolution/status/${encodeURIComponent(tenantId)}/${encodeURIComponent(instanceName)}`);
}

export async function sendTextMessage(payload: {
  tenantId?: string;
  instanceName: string;
  phone: string;
  message: string;
}) {
  return request<{ ok: boolean }>("/evolution/send-text", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendMediaMessage(payload: {
  tenantId?: string;
  instanceName: string;
  phone: string;
  message: string;
  fileBase64: string;
  fileName: string;
  mimeType: string;
}) {
  return request<{ ok: boolean }>("/evolution/send-media", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listCampaigns(tenantId: string) {
  return request<{ campaigns: Array<Record<string, unknown>> }>(`/campaigns/${encodeURIComponent(tenantId)}`);
}

export async function createCampaign(payload: {
  tenantId?: string;
  instanceName: string;
  name: string;
  message: string;
  recipients: string[];
}) {
  return request<{ ok: boolean; campaign: Record<string, unknown> }>("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runCampaign(id: string, tenantId: string) {
  return request<{ ok: boolean; campaign: Record<string, unknown> }>(`/campaigns/${encodeURIComponent(id)}/run`, {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
}

export async function listPlans() {
  return request<{ plans: EvolutionPlan[] }>("/plans");
}

export async function subscribePlan(payload: {
  tenantId?: string;
  planId: string;
  customerName?: string;
  customerEmail?: string;
}) {
  return request<{ ok: boolean }>("/plans/subscribe", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createBillingCheckout(payload: {
  tenantId?: string;
  planId: string;
  customerName?: string;
  customerEmail?: string;
}) {
  return request<{ ok: boolean; checkoutUrl?: string; mock?: boolean }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
