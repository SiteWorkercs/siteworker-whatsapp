import type Anthropic from "@anthropic-ai/sdk";

export const ESCALATION_REASONS = [
  "pay_rate",
  "paycheck",
  "paperwork",
  "injury",
  "complaint",
  "legal",
  "harassment",
  "client_pricing",
  "safety",
  "asked_for_person",
  "other",
] as const;

export const tools: Anthropic.Tool[] = [
  {
    name: "search_jobs",
    description:
      "Search open jobs on the SiteWorker job board. Returns only real open jobs. Use before mentioning any job.",
    input_schema: {
      type: "object",
      properties: {
        state: { type: "string", description: "Two-letter state code, e.g. VA, NC, SC" },
        trade: { type: "string", description: "e.g. electrician, solar installer, laborer, equipment operator" },
        sector: { type: "string", enum: ["solar", "data_center", "bess", "wind", "electrical", "civil"] },
        start_after: { type: "string", description: "YYYY-MM-DD; only jobs starting on/after this date" },
      },
    },
  },
  {
    name: "get_job_details",
    description:
      "Full details for one job: posted pay range (or prevailing wage flag), per diem, travel, required certifications and apply link.",
    input_schema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "record_job_interest",
    description: "Record that this worker wants a job and get the apply link to send them.",
    input_schema: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
    },
  },
  {
    name: "get_my_shifts",
    description: "Upcoming shifts for the person texting (today onward).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "confirm_shift",
    description: "Confirm the worker will be at a shift.",
    input_schema: {
      type: "object",
      properties: { shift_id: { type: "string" } },
      required: ["shift_id"],
    },
  },
  {
    name: "report_late_or_absent",
    description:
      "Report that the worker is running late or can't make a shift. Alerts their Workforce Specialist immediately.",
    input_schema: {
      type: "object",
      properties: {
        shift_id: { type: "string" },
        type: { type: "string", enum: ["late", "absent"] },
        eta_minutes: { type: "number", description: "For late: about how many minutes late" },
        reason: { type: "string", description: "Short reason if they gave one. Don't ask for health details." },
      },
      required: ["shift_id", "type"],
    },
  },
  {
    name: "send_availability_form",
    description: "Send the weekly availability form (a WhatsApp Flow) in the worker's language.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_interview_slots",
    description: "Open Google Meet interview times for new worker onboarding.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "book_interview",
    description:
      "Book a Google Meet interview and verification for a new worker. Collect name, trade and state first.",
    input_schema: {
      type: "object",
      properties: {
        slot_id: { type: "string" },
        name: { type: "string" },
        trade: { type: "string" },
        state: { type: "string" },
        years_experience: { type: "number" },
        certifications: { type: "array", items: { type: "string" } },
      },
      required: ["slot_id", "name", "trade", "state"],
    },
  },
  {
    name: "check_certifications",
    description: "Certifications on file for this worker and when they expire.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_crew_request_form",
    description: "Send the crew request form (a WhatsApp Flow) to a client.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_crew_request",
    description: "Create a DRAFT crew request from details a client texted. A person reviews and follows up.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string" },
        site: { type: "string" },
        state: { type: "string" },
        sector: { type: "string" },
        trade: { type: "string" },
        headcount: { type: "number" },
        start_date: { type: "string" },
        duration: { type: "string" },
        prevailing_wage: { type: "string", enum: ["yes", "no", "not_sure"] },
        notes: { type: "string" },
      },
      required: ["site", "state", "trade", "headcount", "start_date"],
    },
  },
  {
    name: "refer_to_dowe",
    description:
      "Refer a worker to D.O.W.E. (nonprofit partner that shares leadership with SiteWorker) for training, certifications or apprenticeship.",
    input_schema: {
      type: "object",
      properties: {
        interest: { type: "string", description: "What they want, e.g. OSHA 30, apprenticeship, cert renewal" },
        texas_veteran: { type: "boolean", description: "True only if they said they're a veteran living and working in Texas" },
      },
      required: ["interest"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand off to a Workforce Specialist. Use for pay rates, paychecks, paperwork, injuries, complaints, legal, harassment, client pricing, safety, or when someone asks for a person.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", enum: [...ESCALATION_REASONS] },
        priority: { type: "string", enum: ["urgent", "normal"] },
        summary: { type: "string", description: "One or two sentences for the specialist. No SSNs or bank details." },
      },
      required: ["reason", "priority", "summary"],
    },
  },
];
