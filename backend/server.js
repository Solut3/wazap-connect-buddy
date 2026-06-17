import express from "express";
import cors from "cors";
import qrcode from "qrcode";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const sessions = new Map(); // sessionId -> { client, qr, ready }

function createSession(sessionId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: sessionId }),
    puppeteer: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  const state = { client, qr: null, ready: false };
  sessions.set(sessionId, state);

  client.on("qr", async (qr) => {
    state.qr = await qrcode.toDataURL(qr);
    state.ready = false;
  });
  client.on("ready", () => { state.ready = true; state.qr = null; });
  client.on("disconnected", () => { state.ready = false; sessions.delete(sessionId); });

  client.initialize();
  return state;
}

app.post("/session", (req, res) => {
  const { sessionId } = req.body;
  if (!sessions.has(sessionId)) createSession(sessionId);
  res.json({ ok: true });
});

app.get("/status/:sessionId", (req, res) => {
  const s = sessions.get(req.params.sessionId);
  if (!s) return res.json({ exists: false });
  res.json({ exists: true, ready: s.ready, qr: s.qr });
});

app.post("/send", async (req, res) => {
  const { sessionId, phone, message, fileBase64, fileName, mimeType } = req.body;
  const s = sessions.get(sessionId);
  if (!s?.ready) return res.status(400).json({ error: "session not ready" });

  const chatId = `${phone.replace(/\D/g, "")}@c.us`;
  try {
    if (fileBase64) {
      const media = new MessageMedia(mimeType, fileBase64, fileName);
      await s.client.sendMessage(chatId, media, { caption: message });
    } else {
      await s.client.sendMessage(chatId, message);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Wazap Connect Buddy API"
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`WA backend on :${PORT}`);
});
