import "dotenv/config";
import express from "express";
import { normalizeWebhook, verifySignature } from "@kapso/whatsapp-cloud-api/server";
import { createApp } from "./app.js";
import type { InboundMessage } from "./agent/agent.js";
import { verifyChain } from "./audit/log.js";

const app = createApp();
const { config } = app;
const server = express();

server.get("/health", (_req, res) => {
  res.json({ ok: true, dryRun: config.dryRun, model: config.model });
});

// Meta / Kapso webhook verification handshake
server.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token && token === config.webhookVerifyToken) {
    res.status(200).send(String(challenge ?? ""));
    return;
  }
  res.sendStatus(403);
});

server.post("/webhook", express.raw({ type: "*/*", limit: "2mb" }), (req, res) => {
  const raw = req.body as Buffer;

  if (config.metaAppSecret) {
    const ok = verifySignature({
      appSecret: config.metaAppSecret,
      rawBody: raw,
      signatureHeader: req.headers["x-hub-signature-256"] as string | undefined,
    });
    if (!ok) {
      res.sendStatus(401);
      return;
    }
  } else if (!config.dryRun) {
    console.warn("META_APP_SECRET is not set; webhook signatures are not being checked.");
  }

  let events;
  try {
    events = normalizeWebhook(JSON.parse(raw.toString("utf8")));
  } catch {
    res.sendStatus(400);
    return;
  }

  // Acknowledge fast; WhatsApp retries if we take too long.
  res.sendStatus(200);

  void (async () => {
    for (const status of events.statuses) {
      await app.recorder.emit({
        topic: "whatsapp.message.status",
        key: String(status.recipientId ?? status.recipientUserId ?? ""),
        actor: "system",
        payload: { messageId: status.id, status: status.status },
      });
    }
    for (const message of events.messages) {
      if (message.kapso?.direction === "outbound") continue;
      try {
        await app.agent.handleInbound(message as unknown as InboundMessage);
      } catch (err) {
        console.error("Failed to handle message", message.id, err);
        await app.recorder.emit({
          topic: "agent.guardrail",
          key: String(message.from ?? ""),
          actor: "system",
          payload: { event: "handler_error", messageId: message.id, error: (err as Error).message },
        });
      }
    }
  })();
});

// Internal: verify the audit chain. Protect or remove before exposing publicly.
server.get("/internal/audit/verify", (_req, res) => {
  res.json(verifyChain(app.audit.entries()));
});

server.listen(config.port, () => {
  console.log(
    `SiteWorker WhatsApp agent on :${config.port} (${config.dryRun ? "DRY RUN, nothing is sent" : "LIVE via Kapso"}, model ${config.model})`,
  );
});
