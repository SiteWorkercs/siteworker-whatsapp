import type { Lang } from "../services/types.js";

/**
 * Deterministic checks that run before and after the model.
 * The model is told the same rules, but these don't depend on it.
 */

// ---------- Opt-in / opt-out ----------

const OPT_OUT = new Set(["stop", "unsubscribe", "cancel", "end", "quit", "baja", "alto", "parar", "cancelar"]);
const OPT_IN = new Set(["start", "unstop", "subscribe", "alta", "iniciar"]);

const normWord = (t: string) =>
  t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!¡?¿]/g, "");

export const isOptOut = (text: string) => OPT_OUT.has(normWord(text));
export const isOptIn = (text: string) => OPT_IN.has(normWord(text));

// ---------- Sensitive data ----------

export type SensitiveKind = "ssn" | "card_number" | "bank_account";

function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/**
 * Removes SSNs, card numbers and bank/routing numbers before the text
 * reaches the model or the audit log. Phone numbers are left alone.
 */
export function redactSensitive(text: string): { text: string; found: SensitiveKind[] } {
  const found = new Set<SensitiveKind>();
  let out = text;

  // SSN written as 123-45-6789 or 123 45 6789
  out = out.replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, () => {
    found.add("ssn");
    return "[REMOVED]";
  });

  // 9 digits next to an SSN keyword
  out = out.replace(
    /(ssn|social security|social|seguro social|n[uú]mero de seguro)[^\d]{0,20}(\d{9})\b/gi,
    (_m, kw) => {
      found.add("ssn");
      return `${kw} [REMOVED]`;
    },
  );

  // Bank account / routing numbers next to a keyword
  out = out.replace(
    /(account|acct|routing|aba|cuenta|ruta|bank|banco)[^\d]{0,20}(\d[\d -]{6,20}\d)/gi,
    (_m, kw) => {
      found.add("bank_account");
      return `${kw} [REMOVED]`;
    },
  );

  // Card numbers: 13-19 digits (spaces/dashes allowed) that pass Luhn
  out = out.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      found.add("card_number");
      return "[REMOVED]";
    }
    return m;
  });

  return { text: out, found: [...found] };
}

// ---------- Injuries ----------

// Unicode-aware word boundaries so accented words (cayó, lesión) match.
const word = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");

const INJURY_PATTERNS = [
  word(
    "injur(?:y|ed|ies)|hurt|bleeding|broke(?:n)? (?:my|his|her)|fell(?: off)?|accident|ambulance|electrocuted|shocked|burn(?:ed|t)?|passed out|heat stroke|unconscious",
  ),
  word(
    "herid[oa]s?|lesi[oó]n|lastimad[oa]|accidente|sangr(?:e|ando)|me ca[ií]|se cay[oó]|ambulancia|quemad[oa]|electrocutad[oa]|desmay[oó]",
  ),
];

export const mentionsInjury = (text: string) => INJURY_PATTERNS.some((r) => r.test(text));

// ---------- Language ----------

const ES_HINTS = word(
  "hola|gracias|trabajo|trabajar|necesito|quiero|tengo|estoy|puedo|cu[aá]nto|d[oó]nde|cu[aá]ndo|pago|semana|ma[nñ]ana|llegar|tarde|s[ií]|buenas|buenos|d[ií]as|por favor|disponible|certificaci[oó]n|cheque|confirmar|no puedo|baja|alto|parar|cancelar|ayuda|vale|claro|bueno|nada|qu[eé]|c[oó]mo|mi|tu|yo",
);
const EN_HINTS = word(
  "the|is|are|i|i'm|my|you|your|what|any|how|when|where|job|jobs|work|pay|can|can't|hi|hello|hey|thanks|yes|need|want|stop|start|confirm|help|please",
);

/** Spanish or English. Short or unclear messages keep the fallback (the person's last language). */
export function guessLanguage(text: string, fallback: Lang = "en"): Lang {
  const es = /[ñ¿¡]/i.test(text) || ES_HINTS.test(text);
  const en = EN_HINTS.test(text);
  if (es && !en) return "es";
  if (en && !es) return "en";
  if (es && en) return /[ñ¿¡áéíóú]/i.test(text) ? "es" : fallback;
  return fallback;
}

// ---------- Outbound filter ----------

const BANNED: Array<{ re: RegExp; why: string }> = [
  { re: /management solutions/i, why: "entity_name" },
  { re: /\bL\.?L\.?C\.?\b/, why: "entity_name" },
  { re: /payroll (company|entity|llc|provider)/i, why: "entity_name" },
  { re: /empresa de n[oó]mina/i, why: "entity_name" },
  { re: /staffing agency|temp agency|agencia de (empleo|personal) temporal/i, why: "positioning" },
  { re: /\bmark-?up\b|bill rate|margen de ganancia/i, why: "billing" },
];

export interface OutboundCheck {
  text: string;
  blocked: boolean;
  reasons: string[];
}

// Denials are fine: "SiteWorker isn't a staffing agency" should not be blocked.
const NEGATED_POSITIONING =
  /(isn['’]t|is not|are not|aren['’]t|we['’]re not|not|no es|no somos)\s+(just\s+|solo\s+|simplemente\s+)?(a|an|una)?\s*(staffing agency|temp agency|agencia de (empleo|personal) temporal)/gi;

export function checkOutbound(text: string): OutboundCheck {
  const scanned = text.replace(NEGATED_POSITIONING, "");
  const reasons = BANNED.filter((b) => b.re.test(scanned)).map((b) => b.why);
  // Voice: no exclamation points.
  const cleaned = text.replace(/¡/g, "").replace(/!+/g, ".").replace(/\.\.+/g, ".").trim();
  return { text: cleaned, blocked: reasons.length > 0, reasons };
}

export const FALLBACK_REPLY: Record<Lang, string> = {
  en: "Thanks for your message. A Workforce Specialist will follow up with you shortly.",
  es: "Gracias por tu mensaje. Un especialista de SiteWorker te contactará pronto.",
};

export const OPT_OUT_REPLY: Record<Lang, string> = {
  en: "You're unsubscribed and won't get more messages from SiteWorker here. Text START anytime to turn them back on.",
  es: "Te diste de baja y no recibirás más mensajes de SiteWorker por aquí. Escribe START cuando quieras volver a recibirlos.",
};

export const OPT_IN_REPLY: Record<Lang, string> = {
  en: "You're subscribed to SiteWorker messages again. Text STOP anytime to opt out.",
  es: "Volviste a suscribirte a los mensajes de SiteWorker. Escribe STOP cuando quieras darte de baja.",
};
