import { apiRequest } from "@/lib/api";

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  planId?: string;
  planStatus?: string;
  planExpiresAt?: string | null;
};

export type SessionBilling = {
  planId: string;
  planName: string;
  status: string;
  expiresAt: string | null;
  subscription?: Record<string, unknown> | null;
  plan?: Record<string, unknown> | null;
};

export async function getSession() {
  return apiRequest<{ ok: true; user: SessionUser; billing: SessionBilling }>("/auth/me");
}

export async function login(payload: { email: string; password: string }) {
  return apiRequest<{ ok: true; user: SessionUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: { name: string; email: string; password: string; tenantName?: string }) {
  return apiRequest<{ ok: true; user: SessionUser }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout() {
  return apiRequest<{ ok: true }>("/auth/logout", { method: "POST" });
}

export async function forgotPassword(payload: { email: string }) {
  return apiRequest<{ ok: true; resetToken?: string; resetUrl?: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: { token: string; password: string }) {
  return apiRequest<{ ok: true }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
