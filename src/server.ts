import "dotenv/config";
import express from "express";
import { normalizeWebhook, verifySignature } from "@kapso/whatsapp-cloud-api/server";
import { createApp } from "./app.js";
import type { InboundMessage } from "./agent/agent.js";
import { verifyChain } from "./audit/log.js";
import { isKapsoEvent, parseKapsoEvents, verifyKapsoSignature } from "./whatsapp/kapsoEvents.js";

const app = createApp();
const { config } = app;
const server = express();

server.get("/health", (_req, res) => {
  res.json({
    ok: app.missing.length === 0,
    live: !config.dryRun && app.missing.length === 0,
    missingSettings: app.missing,
    alerts: config.alerts.dryRun || !config.alerts.twilioAccountSid ? "printed only" : "live",
    model: config.model,
  });
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

async function handleMessages(messages: InboundMessage[]) {
  for (const message of messages) {
    try {
      await app.agent.handleInbound(message);
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
}

server.post("/webhook", express.raw({ type: "*/*", limit: "2mb" }), (req, res) => {
  const raw = req.body as Buffer;

  // Kapso event webhooks (the only format the sandbox number sends)
  let parsed: any;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    res.sendStatus(400);
    return;
  }
  if (isKapsoEvent(parsed, req.headers)) {
    const secret = process.env.KAPSO_WEBHOOK_SECRET;
    if (secret && !verifyKapsoSignature(secret, raw, req.headers["x-webhook-signature"] as string | undefined)) {
      res.sendStatus(401);
      return;
    }
    res.sendStatus(200);
    void handleMessages(parseKapsoEvents(parsed, req.headers["x-webhook-event"] as string | undefined));
    return;
  }

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
