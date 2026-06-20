
# Plano: SaaS WhatsApp Multi-Tenant Completo

Escopo grande. Vou entregar em uma sequência de commits coerentes, mas tudo nesta tarefa. Antes de começar a codar, confirma o plano abaixo.

## Arquitetura

```text
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────┐
│  Frontend       │ HTTPS │  Backend Node/Express│  TCP  │  PostgreSQL    │
│  (Lovable)      │ ────► │  (Render Web Service)│ ────► │  (Render PG)   │
│  React + Vite   │       │  + Worker de fila    │       │                │
└─────────────────┘       └──────────┬───────────┘       └────────────────┘
                                     │
                                     ├──► Mercado Pago API (billing)
                                     ├──► WhatsApp (Baileys/Evolution)
                                     └──► Webhooks de saída p/ clientes
```

## Backend (`backend/`)

### 1. Login / Auth
- JWT (access 15min + refresh 7d httpOnly cookie)
- Rotas: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- bcrypt para senhas, rate-limit nas rotas de auth
- Reset de senha via e-mail (placeholder SMTP)

### 2. Multi-tenant
- Modelo: `User` ↔ `Membership` ↔ `Organization`
- Todo dado de domínio (contatos, mensagens, conexões WhatsApp, planos) é escopado por `organization_id`
- Middleware `requireOrg` injeta `req.org` e bloqueia acesso cruzado
- Roles por organização: `owner`, `admin`, `member`

### 3. Billing (Mercado Pago)
- Planos: `Free`, `Starter`, `Pro` (configuráveis no banco)
- Assinaturas recorrentes via Mercado Pago Subscriptions (preapproval)
- Rotas: `GET /plans`, `POST /billing/subscribe`, `POST /billing/cancel`, `GET /billing/status`
- Webhook `POST /webhooks/mercadopago` valida assinatura e atualiza `subscription.status`
- Enforcement: middleware `requirePlan('pro')` e contadores de uso (mensagens/mês)

### 4. Queue system
- BullMQ + Redis (Render tem Redis gerenciado free)
- Filas: `messages` (envio WhatsApp), `webhooks` (entrega outbound), `billing` (renovação/dunning)
- Worker roda no mesmo serviço (`node worker.js`) ou Background Worker separado
- Retry exponencial, DLQ, métricas em `/admin/queues`

### 5. Webhooks (outbound)
- Tabela `webhook_endpoints` por org com URL + secret
- Eventos: `message.sent`, `message.received`, `message.failed`, `subscription.updated`
- Assinatura HMAC-SHA256 no header `X-Signature`
- Retentativas 5x com backoff, log em `webhook_deliveries`

## Frontend

### Dashboard analytics (`/dashboard`)
- Cards: mensagens enviadas (hoje/mês), entregues, falhas, contatos ativos
- Gráfico de linha (recharts) de envios últimos 30 dias
- Status da conexão WhatsApp + plano atual + uso vs limite

### Histórico de mensagens (`/messages`)
- Tabela paginada (server-side) com filtros: data, status, contato, canal
- Detalhe da mensagem em drawer (payload, tentativas, webhook deliveries)

### Gestão de planos (`/billing`)
- Cards dos 3 planos com CTA "Assinar" → redireciona pro checkout do Mercado Pago
- Tela "Minha assinatura": status, próxima cobrança, botão cancelar
- Histórico de pagamentos

## Banco de dados (Postgres no Render)

Tabelas principais:
`users`, `organizations`, `memberships`, `plans`, `subscriptions`, `payment_events`,
`whatsapp_connections`, `contacts`, `messages`, `message_attempts`,
`webhook_endpoints`, `webhook_deliveries`, `usage_counters`, `audit_log`.

Migrations via `node-pg-migrate`. Seed dos 3 planos.

## Infra (Render)

- **Web Service** `backend/` — API Express
- **Background Worker** — `node worker.js` (BullMQ)
- **PostgreSQL** managed (plano Starter ~$7/mês para produção)
- **Redis** managed (free tier ok para começar)
- **Backup**: snapshots diários automáticos do Render PG + script `pg_dump` semanal para storage externo (instruções no README)
- **Monitoramento**: `/health` + `/metrics` (Prometheus format), integração opcional com UptimeRobot (gratuito) e logs no Render

## Variáveis de ambiente (vou listar no README)

`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `FRONTEND_URL`, `SMTP_*`.

Vou pedir os secrets de Mercado Pago via tool depois que o código estiver pronto pra usá-los.

## Ordem de entrega

1. Schema + migrations + seed
2. Auth + multi-tenant + middlewares
3. Mercado Pago (planos, checkout, webhook)
4. Redis/BullMQ + workers + webhooks outbound
5. Frontend: páginas Dashboard, Mensagens, Planos + integração com API
6. README de deploy (Render PG + Redis + Web + Worker + backup + monitoring)

## O que NÃO entra agora
- App mobile
- White-label / domínios customizados por tenant
- 2FA, SSO, SAML
- i18n além de pt-BR
- Testes E2E completos (vou deixar smoke tests apenas)

## Riscos / heads-up
- É muita coisa em uma tanda só. Vai ser uma resposta longa com dezenas de arquivos. Recomendo revisar por área antes de fazer deploy.
- Mercado Pago Subscriptions exige conta verificada e credenciais de produção pra cobrar de verdade. Em sandbox dá pra testar tudo.
- BullMQ exige Redis — o free tier do Render Redis tem limite de conexões; pode precisar upgrade depois.

Confirma que posso seguir esse plano?
