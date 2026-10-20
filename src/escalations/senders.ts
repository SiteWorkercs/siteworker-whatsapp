/**
 * SMS (Twilio) and email (SendGrid) senders for escalation alerts.
 * Plain fetch calls, no SDKs. Console versions are used in dry-run mode.
 */

export interface SmsSender {
  send(to: string, body: string): Promise<{ id?: string }>;
}

export interface EmailSender {
  send(input: { to: string[]; subject: string; text: string }): Promise<{ id?: string }>;
}

export class TwilioSms implements SmsSender {
  constructor(
    private accountSid: string,
    private authToken: string,
    private from: string,
  ) {}

  async send(to: string, body: string) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { sid?: string };
    return { id: json.sid };
  }
}

export class SendGridEmail implements EmailSender {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(input: { to: string[]; subject: string; text: string }) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: input.to.map((email) => ({ email })) }],
        from: { email: this.from, name: "SiteWorker WhatsApp Agent" },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.text }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { id: res.headers.get("x-message-id") ?? undefined };
  }
}

export class ConsoleSms implements SmsSender {
  readonly sent: Array<{ to: string; body: string }> = [];
  constructor(private print = true) {}
  async send(to: string, body: string) {
    this.sent.push({ to, body });
    if (this.print) console.log(`\n[SMS → ${to}] ${body}\n`);
    return { id: `dry-sms-${this.sent.length}` };
  }
}

export class ConsoleEmail implements EmailSender {
  readonly sent: Array<{ to: string[]; subject: string; text: string }> = [];
  constructor(private print = true) {}
  async send(input: { to: string[]; subject: string; text: string }) {
    this.sent.push(input);
    if (this.print) console.log(`\n[EMAIL → ${input.to.join(", ")}] ${input.subject}\n${input.text}\n`);
    return { id: `dry-email-${this.sent.length}` };
  }
}
