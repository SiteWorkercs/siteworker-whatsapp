import { WhatsAppClient, buildTemplatePayload } from "@kapso/whatsapp-cloud-api";

/**
 * Everything the app sends to WhatsApp goes through this interface,
 * so the agent can run against Kapso, or print to the console in dry-run
 * mode and tests.
 */

export interface TemplateParam {
  name: string;
  value: string;
}

export type Outbound =
  | { kind: "text"; to: string; body: string }
  | {
      kind: "template";
      to: string;
      template: string;
      language: "en_US" | "es_MX";
      params: TemplateParam[];
      /** One payload per QUICK_REPLY button, in button order. */
      quickReplyPayloads?: string[];
    }
  | { kind: "buttons"; to: string; body: string; buttons: Array<{ id: string; title: string }> }
  | { kind: "cta_url"; to: string; body: string; label: string; url: string }
  | { kind: "flow"; to: string; body: string; flowId: string; cta: string; flowToken: string; screen: string; draft?: boolean };

export interface Messenger {
  send(msg: Outbound): Promise<{ id?: string }>;
  markRead(messageId: string): Promise<void>;
}

export class KapsoMessenger implements Messenger {
  private client: WhatsAppClient;
  constructor(
    opts: { baseUrl: string; kapsoApiKey: string },
    private phoneNumberId: string,
  ) {
    this.client = new WhatsAppClient({ baseUrl: opts.baseUrl, kapsoApiKey: opts.kapsoApiKey });
  }

  async send(msg: Outbound) {
    const base = { phoneNumberId: this.phoneNumberId, to: msg.to };
    let res: { messages?: Array<{ id?: string }> };
    switch (msg.kind) {
      case "text":
        res = await this.client.messages.sendText({ ...base, body: msg.body });
        break;
      case "template":
        res = await this.client.messages.sendTemplate({
          ...base,
          // buildTemplatePayload output is what sendTemplate expects at runtime;
          // the published types are narrower, hence the cast.
          template: buildTemplatePayload({
            name: msg.template,
            language: msg.language,
            components: [
              ...(msg.params.length
                ? [
                    {
                      type: "body",
                      parameters: msg.params.map((p) => ({ type: "text", text: p.value, parameter_name: p.name })),
                    },
                  ]
                : []),
              ...(msg.quickReplyPayloads ?? []).map((payload, index) => ({
                type: "button",
                sub_type: "quick_reply",
                index: String(index),
                parameters: [{ type: "payload", payload }],
              })),
            ],
          }) as any,
        });
        break;
      case "buttons":
        res = await this.client.messages.sendInteractiveButtons({
          ...base,
          bodyText: msg.body,
          buttons: msg.buttons,
        });
        break;
      case "cta_url":
        res = await this.client.messages.sendInteractiveCtaUrl({
          ...base,
          bodyText: msg.body,
          parameters: { displayText: msg.label, url: msg.url },
        });
        break;
      case "flow":
        res = await this.client.messages.sendInteractiveFlow({
          ...base,
          bodyText: msg.body,
          parameters: {
            flowId: msg.flowId,
            flowCta: msg.cta,
            flowToken: msg.flowToken,
            flowAction: "navigate",
            flowActionPayload: { screen: msg.screen },
            ...(msg.draft ? { mode: "draft" as const } : {}),
          },
        });
        break;
    }
    return { id: res.messages?.[0]?.id };
  }

  async markRead(messageId: string) {
    await this.client.messages.markRead({ phoneNumberId: this.phoneNumberId, messageId });
  }
}

/** Dry-run messenger: records and prints what would be sent. */
export class ConsoleMessenger implements Messenger {
  readonly sent: Outbound[] = [];
  constructor(private print = true) {}

  async send(msg: Outbound) {
    this.sent.push(msg);
    if (this.print) console.log(`\n[outbound → ${msg.to}] ${describe(msg)}\n`);
    return { id: `dry-${this.sent.length}` };
  }
  async markRead() {}
}

export function describe(msg: Outbound): string {
  switch (msg.kind) {
    case "text":
      return msg.body;
    case "template":
      return `(template ${msg.template} ${msg.language}) ${msg.params.map((p) => `${p.name}=${p.value}`).join(", ")}`;
    case "buttons":
      return `${msg.body}  [${msg.buttons.map((b) => b.title).join("] [")}]`;
    case "cta_url":
      return `${msg.body}  [${msg.label} → ${msg.url}]`;
    case "flow":
      return `${msg.body}  [form: ${msg.cta} (flow ${msg.flowId || "not deployed"})]`;
  }
}
