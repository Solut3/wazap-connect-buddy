# Zap Connect — Backend

Node/Express backend para o app Zap Connect. Roda o WhatsApp via Evolution API,
autentica usuários, faz multi-tenant por `tenantId`, cobra via Mercado Pago,
e dispara webhooks para sistemas externos.

## Endpoints principais

| Grupo        | Rota                                | Descrição                              |
|--------------|-------------------------------------|----------------------------------------|
| Auth         | `/auth/register` `/auth/login` `/auth/me` `/auth/logout` `/auth/forgot-password` `/auth/reset-password` | JWT em cookie httpOnly |
| Contatos     | `/contacts`                         | CRUD escopado por tenant               |
| Evolution    | `/evolution/connect` `/evolution/send-text` `/evolution/send-media` | QR + envio WhatsApp |
| Campanhas    | `/campaigns` `/campaigns/:id/run`   | Disparo em massa                       |
| Planos       | `/plans` `/billing/checkout` `/billing/webhook` `/billing/subscription` | Mercado Pago |
| Mensagens    | `/messages`                          | Histórico paginado (filtros: status, phone, instanceName) |
| Analytics    | `/analytics/summary`                | Cards + série de 30 dias               |
| Webhooks out | `/webhooks` `/webhooks/:id/test` `/webhook-deliveries` | Webhooks outbound HMAC-SHA256 com retry exponencial |

## Variáveis de ambiente

| Nome                          | Obrigatório | Descrição                                  |
|-------------------------------|-------------|--------------------------------------------|
| `PORT`                        | não (3001)  | Porta HTTP                                  |
| `FRONTEND_URL`                | sim         | URL do frontend (CORS, redirects, webhook) |
| `JWT_SECRET`                  | sim         | Assinatura de sessão                       |
| `SESSION_COOKIE_NAME`         | não         | Default `wc_session`                       |
| `EVOLUTION_API_URL`           | opcional    | Sem isso roda em modo "mock"               |
| `EVOLUTION_API_KEY`           | opcional    | API key da Evolution                       |
| `MERCADO_PAGO_ACCESS_TOKEN`   | opcional    | Sem isso billing fica em modo mock         |
| `MERCADO_PAGO_WEBHOOK_SECRET` | opcional    | Validação extra do webhook                 |

## Deploy no Render

### 1. Web Service

- **Repository**: este repo
- **Root Directory**: `backend`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Plan**: Free para testar; **Starter ($7/mês)** para produção (evita o "cold start").

### 2. Disco persistente (recomendado em produção)

O backend usa `data/store.json` como banco. Em produção, monte um disco persistente
ou troque por Postgres. No Render:

- Settings → **Disks** → Add Disk
- Mount path: `/opt/render/project/src/backend/data`
- Size: 1 GB é suficiente para começar

Sem isso, o JSON é perdido a cada deploy.

### 3. Variáveis de ambiente

Em **Environment** → **Add Environment Variable**, cadastre as variáveis da tabela acima.
`FRONTEND_URL` deve apontar para o domínio publicado (ex: `https://wazap-connect-buddy.lovable.app`).

### 4. URL pública

Após o deploy, Render dá uma URL tipo `https://wa-backend.onrender.com`.
Coloque essa URL no frontend como `VITE_BACKEND_URL` (em Lovable: Project Settings → Environment).

## Backup

### Opção A — Snapshot automático do disco
Render faz snapshot diário do disco persistente automaticamente (planos pagos).
Retenção: 7 dias. Restauração via dashboard em poucos cliques.

### Opção B — Backup manual via cron
Para garantir, configure um **Cron Job** no Render que copia o `store.json`
para um bucket S3/R2:

```bash
# Build Command: npm install -g @aws-sdk/client-s3 ou usar curl + presigned URL
# Schedule: 0 3 * * *  (todo dia às 3h UTC)
# Command:
curl -X PUT -T /opt/render/project/src/backend/data/store.json \
  "$BACKUP_S3_PRESIGNED_URL"
```

### Opção C — Migrar para Postgres (produção)
Quando o JSON ficar grande (>10 MB), migre para Postgres do próprio Render
($7/mês, backups diários gerenciados, point-in-time recovery).

## Monitoramento

### Health check
`GET /health` retorna `{ ok: true, version, uptime }`. Use isso no Render
(Settings → Health Check Path = `/health`) para auto-restart em caso de falha.

### Uptime externo
Cadastre a URL `/health` no **UptimeRobot** (gratuito, ping a cada 5 min).
Bônus: pinga o app a cada 5 min e impede o "sleep" do plano Free.

### Logs
- Logs em tempo real: dashboard do Render → Logs
- Logs estruturados: `console.log` já vai pro Render automaticamente
- Retenção: 7 dias (Free) / 30 dias (Starter+)

### Métricas
- CPU / RAM / requests/s: dashboard do Render → Metrics
- Para métricas customizadas (filas, webhooks), pode adicionar `prom-client`
  e expor `/metrics` no formato Prometheus.

## Webhooks outbound — formato

Cada delivery POST envia:

```json
{
  "event": "message.sent",
  "deliveredAt": "2026-06-20T12:00:00.000Z",
  "data": { "id": "...", "tenantId": "...", "phone": "55...", "message": "..." }
}
```

Headers:
- `X-Signature`: `HMAC-SHA256(secret, body)` em hex
- `X-Event`: nome do evento
- `X-Attempt`: número da tentativa

Retry exponencial: 1s, 5s, 15s, 60s, 5min (5 tentativas no total).

Eventos disponíveis: `message.sent`, `message.failed`, `test.ping`.
Use `["*"]` em `events` para receber todos.