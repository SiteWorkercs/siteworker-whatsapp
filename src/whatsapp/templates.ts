import { TemplateDefinition } from "@kapso/whatsapp-cloud-api";

/**
 * Message templates for outbound messages outside the 24-hour window.
 * Submit with `npm run deploy:templates`. Meta reviews each one and
 * may assign a different category than requested.
 *
 * Spanish copy should be reviewed by a bilingual Workforce Specialist
 * before submitting.
 */

type Lang = "en_US" | "es_MX";

export interface TemplateSpec {
  name: string;
  category: "UTILITY" | "MARKETING";
  params: Array<{ name: string; example: string }>;
  body: Record<Lang, string>;
  quickReplies?: Record<Lang, string[]>;
}

export const TEMPLATES: TemplateSpec[] = [
  {
    name: "sw_job_alert",
    // Meta will likely classify job alerts as MARKETING.
    category: "MARKETING",
    params: [
      { name: "job_title", example: "Solar PV Installer" },
      { name: "location", example: "Wilson, NC" },
      { name: "start_date", example: "Nov 2" },
      // Includes the qualifier, e.g. "$22-$28/hr, based on experience and certifications"
      // or "prevailing wage, set by law for this project"
      { name: "pay_range", example: "$22-$28/hr, based on experience and certifications" },
      { name: "per_diem", example: "Per diem paid weekly" },
    ],
    body: {
      en_US:
        "New job: {{job_title}} in {{location}}. Starts {{start_date}}. Pay: {{pay_range}}. {{per_diem}}. Tap YES for details. SiteWorker never asks you to pay for a job.",
      es_MX:
        "Nuevo trabajo: {{job_title}} en {{location}}. Comienza el {{start_date}}. Pago: {{pay_range}}. {{per_diem}}. Toca SÍ para más detalles. SiteWorker nunca te pedirá dinero por un trabajo.",
    },
    quickReplies: { en_US: ["YES", "STOP"], es_MX: ["SÍ", "STOP"] },
  },
  {
    name: "sw_shift_confirmation",
    category: "UTILITY",
    params: [
      { name: "site_name", example: "Wilson Solar Site" },
      { name: "date", example: "Wed, Oct 21" },
      { name: "start_time", example: "6:00 AM" },
    ],
    body: {
      en_US:
        "Reminder: you're on at {{site_name}} tomorrow, {{date}}, at {{start_time}}. Tap Confirm, or tap Can't make it so we can adjust.",
      es_MX:
        "Recordatorio: trabajas mañana, {{date}}, en {{site_name}} a las {{start_time}}. Toca Confirmar, o toca No puedo ir para avisarnos.",
    },
    quickReplies: { en_US: ["Confirm", "Can't make it"], es_MX: ["Confirmar", "No puedo ir"] },
  },
  {
    name: "sw_interview_booked",
    category: "UTILITY",
    params: [
      { name: "date", example: "Thu, Oct 22" },
      { name: "time", example: "10:00 AM ET" },
      { name: "meet_link", example: "https://meet.google.com/abc-defg-hij" },
    ],
    body: {
      en_US:
        "Your video interview with SiteWorker is set for {{date}} at {{time}}. Join here: {{meet_link}}. Have your ID and certifications ready to show on camera.",
      es_MX:
        "Tu entrevista por video con SiteWorker es el {{date}} a las {{time}}. Únete aquí: {{meet_link}}. Ten tu identificación y certificaciones listas para mostrarlas en cámara.",
    },
  },
  {
    name: "sw_cert_expiring",
    category: "UTILITY",
    params: [
      { name: "cert_name", example: "OSHA 10 card" },
      { name: "expires_on", example: "Nov 15, 2026" },
    ],
    body: {
      en_US:
        "Your {{cert_name}} expires on {{expires_on}}. Renew it to stay eligible for jobs that require it. Reply HELP for renewal options.",
      es_MX:
        "Tu {{cert_name}} vence el {{expires_on}}. Renueva tu certificación para seguir calificando para los trabajos que la requieren. Responde AYUDA para ver opciones de renovación.",
    },
  },
];

export function definitionFor(spec: TemplateSpec, language: Lang) {
  const components: any[] = [
    {
      type: "BODY",
      text: spec.body[language],
      example: { bodyTextNamedParams: spec.params.map((p) => ({ paramName: p.name, example: p.example })) },
    },
  ];
  const qr = spec.quickReplies?.[language];
  if (qr?.length) {
    components.push({ type: "BUTTONS", buttons: qr.map((text) => ({ type: "QUICK_REPLY", text })) });
  }
  return TemplateDefinition.buildTemplateDefinition({
    name: spec.name,
    language,
    category: spec.category,
    parameterFormat: "NAMED",
    components,
  });
}

export function allDefinitions() {
  return TEMPLATES.flatMap((t) => (["en_US", "es_MX"] as const).map((lang) => definitionFor(t, lang)));
}
