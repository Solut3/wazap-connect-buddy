import express from "express";
import cors from "cors";
import qrcode from "qrcode";
import { randomUUID, randomBytes, createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, "data");
const storeFile = join(dataDir, "store.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "wc_session";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
const MERCADO_PAGO_WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
const DEFAULT_PLAN_ID = "free";

function nowIso() {
  return new Date().toISOString();
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlJson(value) {
  return base64url(JSON.stringify(value));
}

function parseBase64urlJson(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((value.length + 3) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(payload);
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expected = createHmac("sha256", JWT_SECRET).update(data).digest();
  const actual = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return parseBase64urlJson(encodedPayload);
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((accumulator, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (!rawKey) return accumulator;
    accumulator[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join("=" ) || "");
    return accumulator;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  parts.push(`HttpOnly`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push(`Secure`);
  res.append("Set-Cookie", parts.join("; "));
}

function clearCookie(res, name) {
  res.append("Set-Cookie", `${encodeURIComponent(name)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function generateResetToken() {
  return randomBytes(24).toString("hex");
}

function cleanPhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function authPayload(user) {
  return {
    sub: user.id,
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
    iat: Math.floor(Date.now() / 1000),
  };
}

function getAuthFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;
  const payload = verifyJwt(token);
  return payload || null;
}

function getTenantId(req) {
  return req.auth?.tenantId || req.body?.tenantId || req.query?.tenantId || req.params?.tenantId || "default";
}

function requireAuth(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function getPlanById(store, planId) {
  return store.plans.find((plan) => plan.id === planId) || null;
}

function getLatestSubscription(store, tenantId) {
  const subscriptions = store.subscriptions
    .filter((item) => item.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return subscriptions[0] || null;
}

function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.status !== "approved" && subscription.status !== "active") return false;
  if (!subscription.expiresAt) return true;
  return new Date(subscription.expiresAt).getTime() > Date.now();
}

function hasExpiredPaidPlan(store, tenantId) {
  const subscription = getLatestSubscription(store, tenantId);
  if (!subscription) return false;
  const plan = getPlanById(store, subscription.planId);
  if (!plan || plan.id === DEFAULT_PLAN_ID) return false;
  return !isSubscriptionActive(subscription);
}

function requireActivePlan(storeGetter) {
  return async (req, res, next) => {
    const store = await storeGetter();
    const tenantId = getTenantId(req);
    if (hasExpiredPaidPlan(store, tenantId)) {
      return res.status(402).json({ error: "plan_expired" });
    }
    return next();
  };
}

let queue = Promise.resolve();

function enqueue(task) {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

const EVOLUTION_BASE_URL =
  process.env.EVOLUTION_API_URL || process.env.EVOLUTION_BASE_URL || "";
const EVOLUTION_API_KEY =
  process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_API_TOKEN || "";

const defaultPlans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    currency: "BRL",
    interval: "mês",
    description: "Plano inicial para testes e uso básico.",
    features: ["1 instância", "Limites reduzidos", "Suporte básico"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 49,
    currency: "BRL",
    interval: "mês",
    description: "Perfeito para começar com automação e atendimento.",
    features: ["1 instância", "QR code", "Envio de mensagens"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    currency: "BRL",
    interval: "mês",
    description: "Para times com campanhas e operação ativa.",
    features: ["Campanhas", "Tags", "Filas", "2 instâncias"],
  },
  {
    id: "scale",
    name: "Scale",
    price: 399,
    currency: "BRL",
    interval: "mês",
    description: "Multi-tenant e crescimento com governança.",
    features: ["Multi-tenant", "Planos pagos", "Relatórios", "API priority"],
  },
];

const emptyStore = {
  users: [],
  contacts: [],
  instances: [],
  campaigns: [],
  subscriptions: [],
  passwordResets: [],
  plans: defaultPlans,
};

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(storeFile, "utf8");
  } catch {
    await writeFile(storeFile, JSON.stringify(emptyStore, null, 2));
  }
}

function normalizeStore(store) {
  return {
    ...emptyStore,
    ...store,
    users: Array.isArray(store?.users) ? store.users : [],
    contacts: Array.isArray(store?.contacts) ? store.contacts : [],
    instances: Array.isArray(store?.instances) ? store.instances : [],
    campaigns: Array.isArray(store?.campaigns) ? store.campaigns : [],
    subscriptions: Array.isArray(store?.subscriptions) ? store.subscriptions : [],
    passwordResets: Array.isArray(store?.passwordResets) ? store.passwordResets : [],
    plans: Array.isArray(store?.plans) && store.plans.length ? store.plans : defaultPlans,
    messages: Array.isArray(store?.messages) ? store.messages : [],
    webhookEndpoints: Array.isArray(store?.webhookEndpoints) ? store.webhookEndpoints : [],
    webhookDeliveries: Array.isArray(store?.webhookDeliveries) ? store.webhookDeliveries : [],
  };
}

async function loadStore() {
  await ensureStore();
  const raw = await readFile(storeFile, "utf8");
  return normalizeStore(JSON.parse(raw));
}

async function saveStore(store) {
  await ensureStore();
  await writeFile(storeFile, JSON.stringify(normalizeStore(store), null, 2));
}

app.use((req, _res, next) => {
  req.auth = getAuthFromRequest(req);
  next();
});

function json(res, status, body) {
  return res.status(status).json(body);
}

function safeUserResponse(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, resetTokenHash, resetTokenSalt, ...safe } = user;
  return safe;
}

function buildPlanState(store, tenantId) {
  const subscription = getLatestSubscription(store, tenantId);
  const plan = subscription ? getPlanById(store, subscription.planId) : getPlanById(store, DEFAULT_PLAN_ID);
  const expired = hasExpiredPaidPlan(store, tenantId);
  return {
    planId: plan?.id || DEFAULT_PLAN_ID,
    planName: plan?.name || "Free",
    status: expired ? "expired" : isSubscriptionActive(subscription) ? "active" : "free",
    expiresAt: subscription?.expiresAt || null,
    subscription,
    plan,
  };
}

function hashToken(token, salt = randomBytes(16).toString("hex")) {
  return hashPassword(token, salt);
}

function createAuthSession(res, user) {
  setCookie(res, SESSION_COOKIE_NAME, signJwt(authPayload(user)), { maxAge: 60 * 60 * 24 * 7 });
}

function clearAuthSession(res) {
  clearCookie(res, SESSION_COOKIE_NAME);
}

async function findUserByEmail(store, email) {
  return store.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function requireTenantMatch(req, res, tenantId) {
  if (req.auth && req.auth.tenantId !== tenantId) {
    res.status(403).json({ error: "tenant_forbidden" });
    return false;
  }
  return true;
}

async function upsertUserPlan(store, userId, planId, status, expiresAt) {
  const user = store.users.find((item) => item.id === userId);
  if (!user) return null;
  user.planId = planId;
  user.planStatus = status;
  user.planExpiresAt = expiresAt || null;
  user.updatedAt = nowIso();
  await saveStore(store);
  return user;
}

app.post("/auth/register", async (req, res) => {
  const { name, email, password, tenantName } = req.body || {};
  if (!name || !email || !password) {
    return json(res, 400, { error: "name, email and password are required" });
  }

  const store = await loadStore();
  const existing = await findUserByEmail(store, email);
  if (existing) {
    return json(res, 409, { error: "email_already_registered" });
  }

  const tenantId = `tenant_${slugify(tenantName || name) || randomUUID().slice(0, 8)}`;
  const { salt, hash } = hashPassword(password);
  const user = {
    id: randomUUID(),
    tenantId,
    name,
    email,
    passwordSalt: salt,
    passwordHash: hash,
    role: "owner",
    sessionVersion: 1,
    planId: DEFAULT_PLAN_ID,
    planStatus: "free",
    planExpiresAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.users.push(user);
  await saveStore(store);
  createAuthSession(res, user);
  return res.status(201).json({ ok: true, user: safeUserResponse(user) });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return json(res, 400, { error: "email and password are required" });
  }

  const store = await loadStore();
  const user = await findUserByEmail(store, email);
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return json(res, 401, { error: "invalid_credentials" });
  }

  createAuthSession(res, user);
  return res.json({ ok: true, user: safeUserResponse(user) });
});

app.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return json(res, 400, { error: "email is required" });
  }

  const store = await loadStore();
  const user = await findUserByEmail(store, email);
  if (!user) {
    return res.json({ ok: true });
  }

  const resetToken = generateResetToken();
  const { salt, hash } = hashToken(resetToken);
  store.passwordResets.push({
    id: randomUUID(),
    userId: user.id,
    tenantId: user.tenantId,
    resetTokenSalt: salt,
    resetTokenHash: hash,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    usedAt: null,
    createdAt: nowIso(),
  });
  await saveStore(store);

  return res.json({
    ok: true,
    resetToken,
    resetUrl: `${FRONTEND_URL}/reset-password?token=${resetToken}`,
  });
});

app.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return json(res, 400, { error: "token and password are required" });
  }

  const store = await loadStore();
  const resetEntry = store.passwordResets.find(
    (item) => !item.usedAt && new Date(item.expiresAt).getTime() > Date.now() && verifyPassword(token, item.resetTokenSalt, item.resetTokenHash)
  );

  if (!resetEntry) {
    return json(res, 400, { error: "invalid_or_expired_token" });
  }

  const user = store.users.find((item) => item.id === resetEntry.userId);
  if (!user) {
    return json(res, 404, { error: "user_not_found" });
  }

  const { salt, hash } = hashPassword(password);
  user.passwordSalt = salt;
  user.passwordHash = hash;
  user.sessionVersion += 1;
  user.updatedAt = nowIso();
  resetEntry.usedAt = nowIso();
  await saveStore(store);
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const store = await loadStore();
  const user = store.users.find((item) => item.id === req.auth.userId);
  if (!user) {
    clearAuthSession(res);
    return json(res, 401, { error: "unauthorized" });
  }

  return res.json({ ok: true, user: safeUserResponse(user), billing: buildPlanState(store, user.tenantId) });
});

app.post("/auth/logout", (_req, res) => {
  clearAuthSession(res);
  return res.json({ ok: true });
});

app.get("/contacts", requireAuth, async (req, res) => {
  const store = await loadStore();
  return res.json({
    contacts: store.contacts.filter((item) => item.tenantId === req.auth.tenantId),
  });
});

app.post("/contacts", requireAuth, async (req, res) => {
  const { name, phone, description = "", documentUrl = "", documentName = "" } = req.body || {};
  if (!name || !phone) {
    return json(res, 400, { error: "name and phone are required" });
  }

  const store = await loadStore();
  const contact = {
    id: randomUUID(),
    tenantId: req.auth.tenantId,
    name,
    phone,
    description,
    documentUrl,
    documentName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.contacts.unshift(contact);
  await saveStore(store);
  return res.status(201).json({ ok: true, contact });
});

app.get("/contacts/:id", requireAuth, async (req, res) => {
  const store = await loadStore();
  const contact = store.contacts.find((item) => item.id === req.params.id && item.tenantId === req.auth.tenantId);
  if (!contact) return json(res, 404, { error: "contact_not_found" });
  return res.json({ contact });
});

app.put("/contacts/:id", requireAuth, async (req, res) => {
  const store = await loadStore();
  const contact = store.contacts.find((item) => item.id === req.params.id && item.tenantId === req.auth.tenantId);
  if (!contact) return json(res, 404, { error: "contact_not_found" });

  const { name, phone, description = "", documentUrl = "", documentName = "" } = req.body || {};
  contact.name = name || contact.name;
  contact.phone = phone || contact.phone;
  contact.description = description;
  contact.documentUrl = documentUrl;
  contact.documentName = documentName;
  contact.updatedAt = nowIso();
  await saveStore(store);
  return res.json({ ok: true, contact });
});

app.delete("/contacts/:id", requireAuth, async (req, res) => {
  const store = await loadStore();
  const before = store.contacts.length;
  store.contacts = store.contacts.filter((item) => !(item.id === req.params.id && item.tenantId === req.auth.tenantId));
  if (store.contacts.length === before) {
    return json(res, 404, { error: "contact_not_found" });
  }
  await saveStore(store);
  return res.json({ ok: true });
});

function normalizeQrPayload(value, instanceName) {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return value;
  }
  const qrSource = typeof value === "string" ? value : JSON.stringify(value);
  return qrcode.toDataURL(qrSource || instanceName);
}

async function normalizeQrResponse(qrValue, instanceName) {
  const normalized = await normalizeQrPayload(qrValue, instanceName);
  if (normalized) return normalized;
  return qrcode.toDataURL(`evolution:${instanceName}`);
}

function evolutionHeaders() {
  const headers = { "content-type": "application/json" };
  if (EVOLUTION_API_KEY) {
    headers.apikey = EVOLUTION_API_KEY;
  }
  return headers;
}

async function evolutionRequest(pathname, options = {}) {
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
    throw new Error("Evolution API credentials are not configured.");
  }

  const response = await fetch(`${EVOLUTION_BASE_URL.replace(/\/$/, "")}${pathname}`, {
    headers: evolutionHeaders(),
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text();

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      `Evolution API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function createInstanceViaEvolution(instanceName) {
  const payloadOptions = [
    { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    { instanceName, qrcode: true },
  ];

  const pathOptions = ["/instance/create", "/instance/createInstance", "/instance"];

  let lastError = null;
  for (const pathOption of pathOptions) {
    for (const payload of payloadOptions) {
      try {
        return await evolutionRequest(pathOption, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("Unable to create Evolution instance.");
}

async function fetchInstanceQr(instanceName) {
  const pathOptions = [
    `/instance/qrcode/${instanceName}`,
    `/instance/qrCode/${instanceName}`,
    `/instance/qr/${instanceName}`,
    `/instance/connect/${instanceName}`,
    `/instance/${instanceName}/qrcode`,
  ];

  let lastError = null;
  for (const pathname of pathOptions) {
    try {
      const response = await evolutionRequest(pathname, { method: "GET" });
      const qrValue =
        response?.base64 ||
        response?.qrcode ||
        response?.qrCode ||
        response?.qr ||
        response?.code ||
        response?.pairingCode;
      if (qrValue) {
        return await normalizeQrResponse(qrValue, instanceName);
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("QR code not available.");
}

async function sendTextViaEvolution(instanceName, phone, message) {
  const phoneNumber = cleanPhone(phone);
  const pathOptions = [
    `/message/sendText/${instanceName}`,
    `/message/sendText`,
  ];
  const payloadOptions = [
    { number: phoneNumber, textMessage: message },
    { number: phoneNumber, text: message },
    { phone: phoneNumber, message },
  ];

  let lastError = null;
  for (const pathname of pathOptions) {
    for (const payload of payloadOptions) {
      try {
        return await evolutionRequest(pathname, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("Unable to send message.");
}

async function sendMediaViaEvolution(instanceName, phone, message, fileBase64, fileName, mimeType) {
  const phoneNumber = cleanPhone(phone);
  const pathOptions = [
    `/message/sendMedia/${instanceName}`,
    `/message/sendMedia`,
  ];
  const payloadOptions = [
    { number: phoneNumber, mediatype: mimeType, media: fileBase64, fileName, caption: message },
    { number: phoneNumber, media: fileBase64, fileName, mimetype: mimeType, caption: message },
  ];

  let lastError = null;
  for (const pathname of pathOptions) {
    for (const payload of payloadOptions) {
      try {
        return await evolutionRequest(pathname, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error("Unable to send media message.");
}

function getInstanceKey(tenantId, instanceName) {
  return `${tenantId}::${instanceName}`;
}

function getEvolutionInstanceName(tenantId, instanceName) {
  return `${tenantId}_${instanceName}`;
}

async function upsertInstance(tenantId, instanceName, patch) {
  const store = await loadStore();
  const key = getInstanceKey(tenantId, instanceName);
  const current = store.instances.find((item) => item.key === key);
  const next = {
    key,
    tenantId,
    instanceName,
    status: "idle",
    ready: false,
    qrCode: null,
    updatedAt: new Date().toISOString(),
    ...current,
    ...patch,
  };

  if (current) {
    Object.assign(current, next);
  } else {
    store.instances.push(next);
  }

  await saveStore(store);
  return next;
}

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    service: "Wazap Connect Buddy API",
    evolution: Boolean(EOLUTION_BASE_URL && EVOLUTION_API_KEY),
  });
});

app.get("/health", async (_req, res) => {
  const store = await loadStore();
  res.json({
    ok: true,
    evolutionConfigured: Boolean(EOLUTION_BASE_URL && EVOLUTION_API_KEY),
    users: store.users.length,
    contacts: store.contacts.length,
    instances: store.instances.length,
    campaigns: store.campaigns.length,
    subscriptions: store.subscriptions.length,
  });
});

app.post("/evolution/connect", requireAuth, requireActivePlan(loadStore), async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { instanceName } = req.body || {};

  if (!instanceName) {
    return json(res, 400, { error: "instanceName is required" });
  }

  await upsertInstance(tenantId, instanceName, { status: "creating", ready: false });

  try {
    const evolutionInstanceName = getEvolutionInstanceName(tenantId, instanceName);

    if (EVOLUTION_BASE_URL && EVOLUTION_API_KEY) {
      await createInstanceViaEvolution(evolutionInstanceName);
      const qrCode = await fetchInstanceQr(evolutionInstanceName);
      const updated = await upsertInstance(tenantId, instanceName, {
        status: "qr",
        ready: false,
        qrCode,
      });
      return res.json({ ok: true, ...updated });
    }

    const qrCode = await qrcode.toDataURL(`mock:${tenantId}:${instanceName}`);
    const updated = await upsertInstance(tenantId, instanceName, {
      status: "qr",
      ready: false,
      qrCode,
      mock: true,
    });
    return res.json({ ok: true, ...updated });
  } catch (error) {
    const updated = await upsertInstance(tenantId, instanceName, {
      status: "error",
      error: error.message,
    });
    return json(res, 500, updated);
  }
});

app.get("/evolution/status/:tenantId/:instanceName", requireAuth, async (req, res) => {
  const { tenantId, instanceName } = req.params;
  if (!requireTenantMatch(req, res, tenantId)) return;
  const store = await loadStore();
  const key = getInstanceKey(tenantId, instanceName);
  const instance = store.instances.find((item) => item.key === key);

  if (!instance) {
    return res.json({ exists: false, ready: false, status: "idle", qrCode: null });
  }

  return res.json({
    exists: true,
    ready: Boolean(instance.ready),
    status: instance.status,
    qrCode: instance.qrCode,
    mock: Boolean(instance.mock),
    error: instance.error || null,
  });
});

app.post("/evolution/send-text", requireAuth, requireActivePlan(loadStore), async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { instanceName, phone, message } = req.body || {};

  if (!instanceName || !phone || !message) {
    return json(res, 400, { error: "instanceName, phone and message are required" });
  }

  const store = await loadStore();
  const key = getInstanceKey(tenantId, instanceName);
  const instance = store.instances.find((item) => item.key === key);

  if (!instance) {
    return json(res, 404, { error: "instance not found" });
  }

  try {
    if (instance.mock || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
      instance.lastMessage = { phone, message, type: "text", sentAt: new Date().toISOString() };
      instance.ready = true;
      instance.status = "connected";
      instance.updatedAt = new Date().toISOString();
      await saveStore(store);
      return res.json({ ok: true, mock: true });
    }

    const result = await enqueue(() => sendTextViaEvolution(getEvolutionInstanceName(tenantId, instanceName), phone, message));
    instance.lastMessage = { phone, message, type: "text", sentAt: new Date().toISOString() };
    instance.status = "connected";
    instance.ready = true;
    instance.updatedAt = new Date().toISOString();
    await saveStore(store);
    return res.json({ ok: true, result });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

app.post("/evolution/send-media", requireAuth, requireActivePlan(loadStore), async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { instanceName, phone, message, fileBase64, fileName, mimeType } = req.body || {};

  if (!instanceName || !phone || !fileBase64 || !fileName || !mimeType) {
    return json(res, 400, { error: "instanceName, phone, fileBase64, fileName and mimeType are required" });
  }

  const store = await loadStore();
  const key = getInstanceKey(tenantId, instanceName);
  const instance = store.instances.find((item) => item.key === key);

  if (!instance) {
    return json(res, 404, { error: "instance not found" });
  }

  try {
    if (instance.mock || !EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
      instance.lastMessage = { phone, message, type: "media", fileName, mimeType, sentAt: new Date().toISOString() };
      instance.ready = true;
      instance.status = "connected";
      instance.updatedAt = new Date().toISOString();
      await saveStore(store);
      return res.json({ ok: true, mock: true });
    }

    const result = await enqueue(() => sendMediaViaEvolution(getEvolutionInstanceName(tenantId, instanceName), phone, message, fileBase64, fileName, mimeType));
    instance.lastMessage = { phone, message, type: "media", fileName, mimeType, sentAt: new Date().toISOString() };
    instance.status = "connected";
    instance.ready = true;
    instance.updatedAt = new Date().toISOString();
    await saveStore(store);
    return res.json({ ok: true, result });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

app.get("/campaigns/:tenantId", requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  if (!requireTenantMatch(req, res, tenantId)) return;
  const store = await loadStore();
  res.json({ campaigns: store.campaigns.filter((item) => item.tenantId === tenantId) });
});

app.post("/campaigns", requireAuth, requireActivePlan(loadStore), async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { instanceName, name, message, recipients = [] } = req.body || {};

  if (!instanceName || !name || !message || !Array.isArray(recipients)) {
    return json(res, 400, { error: "instanceName, name, message and recipients are required" });
  }

  const store = await loadStore();
  const campaign = {
    id: randomUUID(),
    tenantId,
    instanceName,
    name,
    message,
    recipients: recipients.map((phone) => cleanPhone(phone)).filter(Boolean),
    status: "draft",
    createdAt: new Date().toISOString(),
    sentCount: 0,
  };

  store.campaigns.unshift(campaign);
  await saveStore(store);
  res.status(201).json({ ok: true, campaign });
});

app.post("/campaigns/:id/run", requireAuth, requireActivePlan(loadStore), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.auth.tenantId;
  const store = await loadStore();
  const campaign = store.campaigns.find((item) => item.id === id && item.tenantId === tenantId);

  if (!campaign) {
    return json(res, 404, { error: "campaign not found" });
  }

  const key = getInstanceKey(tenantId, campaign.instanceName);
  const instance = store.instances.find((item) => item.key === key);

  if (!instance) {
    return json(res, 404, { error: "instance not found" });
  }

  campaign.status = "running";
  campaign.updatedAt = new Date().toISOString();
  campaign.sentCount = 0;

  for (const recipient of campaign.recipients) {
    try {
      if (instance.mock || !EOLUTION_BASE_URL || !EVOLUTION_API_KEY) {
        campaign.sentCount += 1;
        continue;
      }

      await enqueue(() => sendTextViaEvolution(getEvolutionInstanceName(tenantId, campaign.instanceName), recipient, campaign.message));
      campaign.sentCount += 1;
    } catch (error) {
      campaign.lastError = error.message;
    }
  }

  campaign.status = "sent";
  campaign.finishedAt = new Date().toISOString();
  await saveStore(store);
  res.json({ ok: true, campaign });
});

app.get("/plans", async (_req, res) => {
  const store = await loadStore();
  res.json({ plans: store.plans });
});

app.get("/billing/subscription", requireAuth, async (req, res) => {
  const store = await loadStore();
  return res.json({ billing: buildPlanState(store, req.auth.tenantId) });
});

app.post("/billing/checkout", requireAuth, async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { planId, customerName, customerEmail } = req.body || {};

  if (!planId) {
    return json(res, 400, { error: "planId is required" });
  }

  const store = await loadStore();
  const plan = store.plans.find((item) => item.id === planId);

  if (!plan) {
    return json(res, 404, { error: "plan not found" });
  }

  const subscription = {
    id: randomUUID(),
    userId: req.auth.userId,
    tenantId,
    planId,
    customerName: customerName || null,
    customerEmail: customerEmail || null,
    paymentStatus: MERCADO_PAGO_ACCESS_TOKEN ? "pending_payment" : "mock_pending",
    createdAt: nowIso(),
  };

  store.subscriptions.unshift(subscription);
  await saveStore(store);

  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    return res.status(201).json({ ok: true, mock: true, checkoutUrl: `${FRONTEND_URL}/evolution`, subscription, plan });
  }

  try {
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ title: plan.name, quantity: 1, unit_price: Number(plan.price), currency_id: plan.currency || "BRL" }],
        payer: { email: req.auth.email },
        external_reference: JSON.stringify({ tenantId, userId: req.auth.userId, planId }),
        notification_url: `${FRONTEND_URL.replace(/\/$/, "")}/billing/webhook`,
        back_urls: { success: `${FRONTEND_URL}/evolution`, pending: `${FRONTEND_URL}/evolution`, failure: `${FRONTEND_URL}/evolution` },
        auto_return: "approved",
      }),
    });

    const checkout = await mpResponse.json();
    if (!mpResponse.ok) {
      throw new Error(checkout.message || "mercado_pago_checkout_failed");
    }

    subscription.mercadoPagoPreferenceId = checkout.id;
    await saveStore(store);
    return res.status(201).json({ ok: true, subscription, plan, checkoutUrl: checkout.init_point || checkout.sandbox_init_point });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

app.post("/billing/webhook", async (req, res) => {
  const paymentId = req.body?.data?.id || req.query?.id || req.body?.id;

  if (!paymentId) {
    return res.status(200).json({ ok: true });
  }

  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    return res.status(200).json({ ok: true, mock: true });
  }

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      throw new Error(payment.message || "payment_fetch_failed");
    }

    const reference = payment.external_reference ? JSON.parse(payment.external_reference) : payment.metadata || {};
    const store = await loadStore();
    const subscription = store.subscriptions.find(
      (item) => item.userId === reference.userId && item.tenantId === reference.tenantId && item.planId === reference.planId
    ) || store.subscriptions.find((item) => item.mercadoPagoPreferenceId === payment.preference_id) || null;

    if (subscription) {
      subscription.mercadoPagoPaymentId = String(payment.id);
      subscription.paymentStatus = payment.status;
      if (payment.status === "approved") {
        subscription.status = "approved";
        subscription.activatedAt = nowIso();
        subscription.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        const user = store.users.find((item) => item.id === subscription.userId && item.tenantId === subscription.tenantId);
        if (user) {
          user.planId = subscription.planId;
          user.planStatus = "active";
          user.planExpiresAt = subscription.expiresAt;
          user.updatedAt = nowIso();
        }
      }
      await saveStore(store);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/plans/subscribe", requireAuth, async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { planId, customerName, customerEmail } = req.body || {};

  if (!planId) {
    return json(res, 400, { error: "planId is required" });
  }

  const store = await loadStore();
  const plan = store.plans.find((item) => item.id === planId);

  if (!plan) {
    return json(res, 404, { error: "plan not found" });
  }

  const subscription = {
    id: randomUUID(),
    userId: req.auth.userId,
    tenantId,
    planId,
    customerName: customerName || null,
    customerEmail: customerEmail || null,
    paymentStatus: MERCADO_PAGO_ACCESS_TOKEN ? "pending_payment" : "mock_pending",
    createdAt: nowIso(),
  };

  store.subscriptions.unshift(subscription);
  await saveStore(store);
  return res.status(201).json({ ok: true, subscription, plan });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Evolution backend on :${PORT}`);
});
