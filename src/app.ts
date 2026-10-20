import Anthropic from "@anthropic-ai/sdk";
import { Agent, type LLM } from "./agent/agent.js";
import { AuditLog, FileSink, MemorySink, type AuditSink } from "./audit/log.js";
import { config as defaultConfig, type Config } from "./config.js";
import { InMemoryEventBus, Recorder, type EventBus } from "./events/bus.js";
import { Notifier } from "./notifications.js";
import { EscalationNotifier, onDutyOnly, withEscalationAlerts, type SpecialistDirectory } from "./escalations/notify.js";
import { ConsoleEmail, ConsoleSms, SendGridEmail, TwilioSms, type EmailSender, type SmsSender } from "./escalations/senders.js";
import { createMockServices } from "./services/mock.js";
import { MemoryConversationStore } from "./store/conversations.js";
import { ConsoleMessenger, KapsoMessenger, type Messenger } from "./whatsapp/messenger.js";

export interface AppOptions {
  config?: Config;
  llm?: LLM;
  messenger?: Messenger;
  auditSink?: AuditSink;
  bus?: EventBus;
  now?: () => Date;
  quiet?: boolean;
  sms?: SmsSender;
  email?: EmailSender;
  specialists?: SpecialistDirectory;
}

/** Wires everything together. Swap mock services for real adapters here. */
export function createApp(opts: AppOptions = {}) {
  const cfg = opts.config ?? defaultConfig;
  const now = opts.now ?? (() => new Date());

  const llm: LLM = opts.llm ?? new Anthropic({ apiKey: cfg.anthropicApiKey });
  const messenger: Messenger =
    opts.messenger ??
    (cfg.dryRun
      ? new ConsoleMessenger(!opts.quiet)
      : new KapsoMessenger({ baseUrl: cfg.kapsoBaseUrl, kapsoApiKey: cfg.kapsoApiKey }, cfg.phoneNumberId));

  const audit = new AuditLog(opts.auditSink ?? (cfg.auditLogPath === ":memory:" ? new MemorySink() : new FileSink(cfg.auditLogPath)));
  const bus = opts.bus ?? new InMemoryEventBus();
  const recorder = new Recorder(audit, bus);
  const store = new MemoryConversationStore();
  const mock = createMockServices(cfg.jobBoardUrl, now());

  // Escalation alerts
  const a = cfg.alerts;
  const sms: SmsSender =
    opts.sms ??
    (!a.dryRun && a.twilioAccountSid && a.twilioAuthToken && a.twilioFrom
      ? new TwilioSms(a.twilioAccountSid, a.twilioAuthToken, a.twilioFrom)
      : new ConsoleSms(!opts.quiet));
  const email: EmailSender =
    opts.email ??
    (!a.dryRun && a.sendgridApiKey && a.emailFrom ? new SendGridEmail(a.sendgridApiKey, a.emailFrom) : new ConsoleEmail(!opts.quiet));
  const escalationNotifier = new EscalationNotifier(
    sms,
    email,
    opts.specialists ?? onDutyOnly,
    {
      onDutySms: a.onDutySms.length ? a.onDutySms : ["+15555550100"], // placeholder for dry runs
      onDutyEmail: a.onDutyEmail.length ? a.onDutyEmail : ["on-duty@example.com"],
    },
    mock.services.directory,
    recorder,
  );
  mock.services.requests = withEscalationAlerts(mock.services.requests, escalationNotifier);

  const links = { jobBoard: cfg.jobBoardUrl, secureUpload: cfg.secureUploadUrl, dowe: cfg.doweUrl };

  const agent = new Agent({
    llm,
    model: cfg.model,
    services: mock.services,
    messenger,
    recorder,
    store,
    flows: cfg.flows,
    links,
    timezone: cfg.timezone,
    now,
  });

  const notifier = new Notifier(messenger, recorder, store, mock.services);

  return { agent, notifier, escalationNotifier, sms, email, audit, bus, recorder, store, messenger, services: mock.services, mock, config: cfg };
}

export type App = ReturnType<typeof createApp>;
