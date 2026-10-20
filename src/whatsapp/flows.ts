import { SECTORS, SERVICE_STATES } from "../business/model.js";
/**
 * WhatsApp Flows (forms inside the chat), in Meta's Flow JSON format.
 * Deploy with `npm run deploy:flows`, or paste the JSON files in /flows
 * into Meta's Flow builder.
 *
 * Both Flows use the "complete" action: the answers come back to our
 * webhook as an nfm_reply message, handled in Agent.handleFlowReply.
 * No data endpoint is needed.
 */

type Lang = "en" | "es";

const AV = {
  en: {
    title: "Availability",
    heading: "Next week",
    days: "Days you can work",
    shift: "Shift",
    shifts: [
      ["day", "Day shift"],
      ["night", "Night shift"],
      ["either", "Either"],
    ],
    travel: "Can you travel for work?",
    travels: [
      ["yes", "Yes, I can travel"],
      ["local", "Local only"],
    ],
    notes: "Anything else we should know?",
    notesHelp: "Optional. Don't include ID numbers or medical details.",
    submit: "Send availability",
    week: [
      ["mon", "Monday"],
      ["tue", "Tuesday"],
      ["wed", "Wednesday"],
      ["thu", "Thursday"],
      ["fri", "Friday"],
      ["sat", "Saturday"],
      ["sun", "Sunday"],
    ],
  },
  es: {
    title: "Disponibilidad",
    heading: "La próxima semana",
    days: "Días que puedes trabajar",
    shift: "Turno",
    shifts: [
      ["day", "Turno de día"],
      ["night", "Turno de noche"],
      ["either", "Cualquiera"],
    ],
    travel: "¿Puedes viajar por trabajo?",
    travels: [
      ["yes", "Sí, puedo viajar"],
      ["local", "Solo local"],
    ],
    notes: "¿Algo más que debamos saber?",
    notesHelp: "Opcional. No incluyas números de identificación ni datos médicos.",
    submit: "Enviar disponibilidad",
    week: [
      ["mon", "Lunes"],
      ["tue", "Martes"],
      ["wed", "Miércoles"],
      ["thu", "Jueves"],
      ["fri", "Viernes"],
      ["sat", "Sábado"],
      ["sun", "Domingo"],
    ],
  },
} as const;

const opts = (pairs: ReadonlyArray<readonly [string, string]>) => pairs.map(([id, title]) => ({ id, title }));

export function availabilityFlow(lang: Lang) {
  const t = AV[lang];
  return {
    version: "7.2",
    screens: [
      {
        id: "AVAILABILITY",
        title: t.title,
        terminal: true,
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextSubheading", text: t.heading },
            { type: "CheckboxGroup", name: "days", label: t.days, required: true, "data-source": opts(t.week) },
            { type: "RadioButtonsGroup", name: "shift", label: t.shift, required: true, "data-source": opts(t.shifts) },
            { type: "RadioButtonsGroup", name: "travel", label: t.travel, required: true, "data-source": opts(t.travels) },
            { type: "TextArea", name: "notes", label: t.notes, required: false, "helper-text": t.notesHelp, "max-length": 300 },
            {
              type: "Footer",
              label: t.submit,
              "on-click-action": {
                name: "complete",
                payload: {
                  days: "${form.days}",
                  shift: "${form.shift}",
                  travel: "${form.travel}",
                  notes: "${form.notes}",
                },
              },
            },
          ],
        },
      },
    ],
  };
}

export function crewRequestFlow() {
  return {
    version: "7.2",
    screens: [
      {
        id: "CREW_REQUEST",
        title: "Request a crew",
        terminal: true,
        layout: {
          type: "SingleColumnLayout",
          children: [
            { type: "TextBody", text: "A person reviews every request and follows up with you." },
            { type: "TextInput", name: "company", label: "Company", "input-type": "text", required: true },
            { type: "TextInput", name: "site", label: "Project or site name", "input-type": "text", required: true },
            {
              type: "Dropdown",
              name: "state",
              label: "State",
              required: true,
              "data-source": opts([...SERVICE_STATES.map((st) => [st.code, st.name] as [string, string]), ["other", "Other"]]),
            },
            {
              type: "Dropdown",
              name: "sector",
              label: "Sector",
              required: true,
              "data-source": opts(SECTORS.map((sec) => [sec.id, sec.label] as [string, string])),
            },
            { type: "TextInput", name: "trade", label: "Trade(s) needed", "input-type": "text", required: true, "helper-text": "e.g. journeyman electricians, PV installers" },
            { type: "TextInput", name: "headcount", label: "Headcount", "input-type": "number", required: true },
            { type: "DatePicker", name: "start_date", label: "Start date", required: true },
            {
              type: "Dropdown",
              name: "duration",
              label: "Expected duration",
              required: true,
              "data-source": opts([
                ["lt_1m", "Under 1 month"],
                ["1_3m", "1 to 3 months"],
                ["3_6m", "3 to 6 months"],
                ["gt_6m", "Over 6 months"],
              ]),
            },
            {
              type: "RadioButtonsGroup",
              name: "prevailing_wage",
              label: "Prevailing wage / Davis-Bacon project?",
              required: true,
              "data-source": opts([
                ["yes", "Yes"],
                ["no", "No"],
                ["not_sure", "Not sure"],
              ]),
            },
            { type: "TextArea", name: "notes", label: "Notes", required: false, "max-length": 500 },
            {
              type: "Footer",
              label: "Send request",
              "on-click-action": {
                name: "complete",
                payload: {
                  company: "${form.company}",
                  site: "${form.site}",
                  state: "${form.state}",
                  sector: "${form.sector}",
                  trade: "${form.trade}",
                  headcount: "${form.headcount}",
                  start_date: "${form.start_date}",
                  duration: "${form.duration}",
                  prevailing_wage: "${form.prevailing_wage}",
                  notes: "${form.notes}",
                },
              },
            },
          ],
        },
      },
    ],
  };
}

export const FLOWS = [
  { name: "sw-availability-en", env: "FLOW_ID_AVAILABILITY_EN", json: () => availabilityFlow("en") },
  { name: "sw-availability-es", env: "FLOW_ID_AVAILABILITY_ES", json: () => availabilityFlow("es") },
  { name: "sw-crew-request", env: "FLOW_ID_CREW_REQUEST", json: () => crewRequestFlow() },
];
