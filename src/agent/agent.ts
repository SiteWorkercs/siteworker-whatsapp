import type Anthropic from "@anthropic-ai/sdk";
import type { Recorder } from "../events/bus.js";
import type { Contact, Lang, Services } from "../services/types.js";
import type { ConversationStore } from "../store/conversations.js";
import { tools } from "../tools/definitions.js";
import { runTool, type ToolContext } from "../tools/handlers.js";
import type { Messenger, Outbound } from "../whatsapp/messenger.js";
import {
  FALLBACK_REPLY,
  OPT_IN_REPLY,
  OPT_OUT_REPLY,
  checkOutbound,
  guessLanguage,
  isOptIn,
  isOptOut,
  mentionsInjury,
  redactSensitive,
} from "./guardrails.js";
import { CORE_PROMPT, buildSystemPrompt } from "./systemPrompt.js";

/** Minimal slice of the Anthropic client, so tests can pass a fake. */
export interface LLM {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface AgentDeps {
  llm: LLM;
  model: string;
  services: Services;
  messenger: Messenger;
  recorder: Recorder;
  store: ConversationStore;
  flows: ToolContext["flows"];
  links: ToolContext["links"];
  timezone: string;
  practiceData?: boolean;
  now?: () => Date;
}

/** What we take from a normalized webhook message. */
export interface InboundMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: {
    type?: string;
    buttonReply?: { id?: string; title?: string };
    listReply?: { id?: string; title?: string };
    nfmReply?: { responseJson?: string };
  };
  kapso?: { flowResponse?: Record<string, unknown>; flowToken?: string };
  [key: string]: unknown;
}

const MAX_TOOL_ROUNDS = 6;

const FIXED = {
  media: {
    en: `Please don't send ID, license or other document photos here. Upload them securely at {url}. If you meant to send something else, type it out and I'll help.`,
    es: `Por favor no envíes fotos de identificación, licencias u otros documentos por aquí. Súbelas de forma segura en {url}. Si querías enviar otra cosa, escríbela y te ayudo.`,
  },
  audio: {
    en: "I can't listen to voice notes yet. Please type your message and I'll help.",
    es: "Todavía no puedo escuchar notas de voz. Por favor escribe tu mensaje y te ayudo.",
  },
  shiftConfirmed: {
    en: "Thanks, you're confirmed. See you on site.",
    es: "Gracias, tu turno quedó confirmado. Nos vemos en el sitio.",
  },
  shiftCant: {
    en: "Thanks for letting us know. Your Workforce Specialist has been alerted and will follow up.",
    es: "Gracias por avisar. Ya le avisamos a tu especialista de SiteWorker y te va a contactar.",
  },
  injury: {
    en: "If anyone is hurt, get medical help now. Call 911 if it's serious. Tell your site supervisor right away. I've alerted your Workforce Specialist, and they'll contact you shortly.",
    es: "Si alguien está herido, busca ayuda médica ahora. Llama al 911 si es grave. Avísale de inmediato a tu supervisor del sitio. Ya le avisé a tu especialista de SiteWorker y te va a contactar pronto.",
  },
  availabilityThanks: {
    en: "Got your availability. Thanks.",
    es: "Recibimos tu disponibilidad. Gracias.",
  },
  crewThanks: {
    en: "Got your crew request. A person will review it and follow up with you.",
    es: "Recibimos tu solicitud de cuadrilla. Una persona la revisará y te contactará.",
  },
};

export class Agent {
  private seen = new Set<string>();
  constructor(private d: AgentDeps) {}

  private now() {
    return this.d.now ? this.d.now() : new Date();
  }

  private todayLong() {
    return this.now().toLocaleDateString("en-US", {
      timeZone: this.d.timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  private todayIso() {
    // en-CA formats as YYYY-MM-DD
    return this.now().toLocaleDateString("en-CA", { timeZone: this.d.timezone });
  }

  private actorFor(phone: string, contact?: Contact) {
    return `${contact?.kind ?? "unknown"}:${phone}`;
  }

  private async send(msg: Outbound, actor: string) {
    const res = await this.d.messenger.send(msg);
    const { to, ...rest } = msg;
    await this.d.recorder.emit({
      topic: "whatsapp.message.outbound",
      key: to,
      actor: "agent",
      payload: { to, messageId: res.id, inReplyToActor: actor, ...rest },
    });
  }

  private async reply(phone: string, body: string, actor: string, lang: Lang) {
    const check = checkOutbound(body);
    let text = check.text;
    if (check.blocked) {
      await this.d.recorder.emit({
        topic: "agent.guardrail",
        key: phone,
        actor: "system",
        payload: { event: "outbound_blocked", reasons: check.reasons, draft: body },
      });
      text = FALLBACK_REPLY[lang];
      await this.d.services.requests.createEscalation({
        phone,
        reason: "agent_fallback",
        priority: "normal",
        summary: `Agent reply was blocked (${check.reasons.join(", ")}). Please follow up.`,
      });
    }
    await this.send({ kind: "text", to: phone, body: text }, actor);
    return text;
  }

  /**
   * Handle one inbound WhatsApp message. Returns the text reply sent
   * (if any), which the CLI and tests use.
   */
  async handleInbound(msg: InboundMessage): Promise<string | undefined> {
    if (this.seen.has(msg.id)) return undefined; // webhook retries
    this.seen.add(msg.id);

    const phone = msg.from.replace(/\D/g, "");
    const contact = await this.d.services.directory.find(phone);
    const actor = this.actorFor(phone, contact);
    const state = this.d.store.get(phone);
    state.lastInboundAt = this.now().getTime();
    if (state.optedIn === undefined && contact) state.optedIn = true; // known contacts opted in at onboarding

    const rawText =
      msg.text?.body ??
      msg.interactive?.buttonReply?.title ??
      msg.interactive?.listReply?.title ??
      msg.button?.text ??
      "";
    const redacted = redactSensitive(rawText);
    const found = redacted.found;
    let text = redacted.text;
    // Job alert "YES" button: tell the model which job it was about.
    const payload = msg.type === "button" ? (msg.button?.payload ?? "") : "";
    if (payload.startsWith("JOB_INTEREST:")) {
      text = `${text} (tapped YES on the job alert for job ${payload.split(":")[1]})`;
    }
    const lang: Lang = rawText ? guessLanguage(redacted.text,state.language ?? contact?.language ?? "en") : (state.language ?? contact?.language ?? "en");
    state.language = lang;

    await this.d.recorder.emit({
      topic: "whatsapp.message.inbound",
      key: phone,
      actor,
      payload: { messageId: msg.id, type: msg.type, text: text || undefined, redacted: found.length ? found : undefined },
    });

    try {
      // 1. Opt-out / opt-in keywords
      if (text && isOptOut(text)) {
        state.optedIn = false;
        await this.d.recorder.emit({ topic: "whatsapp.optin", key: phone, actor, payload: { optedIn: false } });
        return await this.reply(phone, OPT_OUT_REPLY[lang], actor, lang);
      }
      if (text && isOptIn(text)) {
        state.optedIn = true;
        await this.d.recorder.emit({ topic: "whatsapp.optin", key: phone, actor, payload: { optedIn: true } });
        return await this.reply(phone, OPT_IN_REPLY[lang], actor, lang);
      }

      // 2. Template quick-reply buttons (shift confirmation)
      if (msg.type === "button" && msg.button?.payload) {
        const handled = await this.handleButton(phone, msg.button.payload, actor, lang);
        if (handled) return handled;
      }

      // 3. Flow form submissions
      if (msg.type === "interactive" && msg.interactive?.type === "nfm_reply") {
        return await this.handleFlowReply(phone, msg, actor, lang);
      }

      // 4. Media: never collect documents in chat
      if (["image", "document", "video", "sticker"].includes(msg.type)) {
        return await this.reply(phone, FIXED.media[lang].replace("{url}", this.d.links.secureUpload), actor, lang);
      }
      if (msg.type === "audio") {
        return await this.reply(phone, FIXED.audio[lang], actor, lang);
      }
      if (!text) return undefined; // reactions, location pins, etc.

      // 5. Deterministic notes for this turn
      const notes: string[] = [
        `This message is in ${lang === "es" ? "Spanish" : "English"}. Reply in ${lang === "es" ? "Spanish" : "English"}, even if their profile says otherwise.`,
      ];
      if (found.length) {
        notes.push(
          `The person sent what looks like sensitive data (${found.join(", ")}). It was removed and not stored. Tell them not to send it in WhatsApp and to use the secure upload link if it's needed.`,
        );
        await this.d.recorder.emit({ topic: "agent.guardrail", key: phone, actor: "system", payload: { event: "sensitive_redacted", kinds: found } });
      }
      if (mentionsInjury(text)) {
        const esc = await this.d.services.requests.createEscalation({
          phone,
          reason: "injury",
          priority: "urgent",
          summary: `Possible injury reported: "${text.slice(0, 200)}"`,
        });
        await this.d.recorder.emit({
          topic: "escalation.created",
          key: phone,
          actor: "system",
          payload: { escalationId: esc.id, reason: "injury", priority: "urgent", auto: true },
        });
        // Fixed reply: no AI-written medical or safety advice for injuries.
        const reply = FIXED.injury[lang];
        state.history.push({ role: "user", content: text }, { role: "assistant", content: reply });
        return await this.reply(phone, reply, actor, lang);
      }

      // 6. Claude
      state.history.push({ role: "user", content: text });
      let replyText: string;
      try {
        replyText = await this.runModel(phone, contact, lang, notes, state.history, actor);
      } catch (err) {
        // Never leave someone without an answer if Claude is unreachable.
        state.history.pop();
        await this.d.recorder.emit({
          topic: "agent.guardrail",
          key: phone,
          actor: "system",
          payload: { event: "model_error", error: (err as Error).message.slice(0, 300) },
        });
        await this.d.services.requests.createEscalation({
          phone,
          reason: "agent_fallback",
          priority: "normal",
          summary: `The agent couldn't answer (system error). Their message: "${text.slice(0, 200)}"`,
        });
        return await this.reply(phone, FALLBACK_REPLY[lang], actor, lang);
      }
      state.history.push({ role: "assistant", content: replyText });
      return await this.reply(phone, replyText, actor, lang);
    } finally {
      this.d.store.save(state);
    }
  }

  private async runModel(
    phone: string,
    contact: Contact | undefined,
    lang: Lang,
    notes: string[],
    history: Anthropic.MessageParam[],
    actor: string,
  ): Promise<string> {
    const ctx: ToolContext = {
      phone,
      actor,
      contact,
      language: lang,
      services: this.d.services,
      messenger: this.d.messenger,
      recorder: this.d.recorder,
      today: this.todayIso(),
      flows: this.d.flows,
      links: this.d.links,
    };
    const system: Anthropic.TextBlockParam[] = [
      { type: "text", text: CORE_PROMPT, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: buildSystemPrompt({
          today: this.todayLong(),
          contact,
          phone,
          jobBoardUrl: this.d.links.jobBoard,
          secureUploadUrl: this.d.links.secureUpload,
          doweUrl: this.d.links.dowe,
          guardrailNotes: notes,
          practiceData: this.d.practiceData,
        }),
      },
    ];

    // Work on a copy; only the final text is kept in long-term history.
    const messages: Anthropic.MessageParam[] = [...history];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await this.d.llm.messages.create({
        model: this.d.model,
        max_tokens: 800,
        system,
        tools,
        messages,
      });

      const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return text || FALLBACK_REPLY[lang];
      }

      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const output = await runTool(tu.name, tu.input as Record<string, unknown>, ctx);
        await this.d.recorder.emit({
          topic: "agent.tool_call",
          key: phone,
          actor: "agent",
          payload: { tool: tu.name, input: tu.input as Record<string, unknown>, ok: !("error" in output) },
        });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(output), is_error: "error" in output });
      }
      messages.push({ role: "user", content: results });
    }

    await this.d.services.requests.createEscalation({
      phone,
      reason: "agent_fallback",
      priority: "normal",
      summary: "Agent hit the tool-call limit. Please follow up.",
    });
    return FALLBACK_REPLY[lang];
  }

  private async handleButton(phone: string, payload: string, actor: string, lang: Lang) {
    const [action, shiftId] = payload.split(":");
    const shifts = await this.d.services.scheduling.shiftsFor(phone);
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return undefined;
    if (action === "SHIFT_CONFIRM") {
      await this.d.services.scheduling.confirm(shift.id);
      await this.d.recorder.emit({ topic: "agent.tool_call", key: phone, actor, payload: { tool: "confirm_shift", shiftId: shift.id, via: "template_button" } });
      return await this.reply(phone, FIXED.shiftConfirmed[lang], actor, lang);
    }
    if (action === "SHIFT_CANT") {
      await this.d.services.scheduling.markAbsent(shift.id);
      const esc = await this.d.services.requests.createEscalation({
        phone,
        reason: "cant_make_it",
        priority: "urgent",
        summary: `Can't make it to ${shift.siteName} on ${shift.date} ${shift.startTime}.`,
      });
      await this.d.recorder.emit({
        topic: "dispatch.alert",
        key: phone,
        actor,
        payload: { shiftId: shift.id, type: "absent", escalationId: esc.id, via: "template_button" },
      });
      return await this.reply(phone, FIXED.shiftCant[lang], actor, lang);
    }
    return undefined;
  }

  private async handleFlowReply(phone: string, msg: InboundMessage, actor: string, lang: Lang) {
    let response: Record<string, unknown> = msg.kapso?.flowResponse ?? {};
    if (!Object.keys(response).length && msg.interactive?.nfmReply?.responseJson) {
      try {
        response = JSON.parse(msg.interactive.nfmReply.responseJson);
      } catch {
        response = {};
      }
    }
    const token = String(msg.kapso?.flowToken ?? response.flow_token ?? response.flowToken ?? "");
    const kind = token.split(":")[0];

    if (kind === "availability") {
      const saved = await this.d.services.requests.saveAvailability({ phone, response });
      await this.d.recorder.emit({ topic: "availability.submitted", key: phone, actor, payload: { id: saved.id, response } });
      return await this.reply(phone, FIXED.availabilityThanks[lang], actor, lang);
    }
    if (kind === "crew_request") {
      const req = await this.d.services.requests.createCrewRequest({ ...response, phone, status: "draft", source: "whatsapp_flow" });
      await this.d.recorder.emit({ topic: "crew_request.created", key: phone, actor, payload: { requestId: req.id, ...response } });
      return await this.reply(phone, FIXED.crewThanks[lang], actor, lang);
    }
    await this.d.recorder.emit({ topic: "agent.guardrail", key: phone, actor: "system", payload: { event: "unknown_flow_token", token } });
    return await this.reply(phone, FALLBACK_REPLY[lang], actor, lang);
  }
}
