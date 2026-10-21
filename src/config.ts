const env = process.env;

export const config = {
  anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
  model: env.CLAUDE_MODEL || "claude-sonnet-5-5",

  kapsoApiKey: env.KAPSO_API_KEY ?? "",
  kapsoBaseUrl: env.KAPSO_BASE_URL || "https://app.kapso.ai/api/meta/",
  phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  wabaId: env.WABA_ID ?? "",

  metaAppSecret: env.META_APP_SECRET ?? "",
  webhookVerifyToken: env.WEBHOOK_VERIFY_TOKEN ?? "",

  jobBoardUrl: env.JOB_BOARD_URL || "https://marketplace.siteworker.com",
  secureUploadUrl:
    env.SECURE_UPLOAD_URL || "https://marketplace.siteworker.com/profile/documents",
  doweUrl: env.DOWE_URL || "https://dowe.us",

  flows: {
    availabilityEn: env.FLOW_ID_AVAILABILITY_EN ?? "",
    availabilityEs: env.FLOW_ID_AVAILABILITY_ES ?? "",
    crewRequest: env.FLOW_ID_CREW_REQUEST ?? "",
  },

  alerts: {
    // Defaults to DRY_RUN. Set ALERTS_DRY_RUN=false to send real texts/emails.
    dryRun: (env.ALERTS_DRY_RUN || env.DRY_RUN || "true").toLowerCase() !== "false",
    twilioAccountSid: env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: env.TWILIO_AUTH_TOKEN ?? "",
    twilioFrom: env.TWILIO_FROM_NUMBER ?? "",
    sendgridApiKey: env.SENDGRID_API_KEY ?? "",
    emailFrom: env.ESCALATION_EMAIL_FROM ?? "",
    onDutySms: (env.ESCALATION_SMS_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    onDutyEmail: (env.ESCALATION_EMAIL_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  },

  // Mock services are the only ones wired up today, so practice mode defaults on.
  practiceData: (env.PRACTICE_DATA ?? "true").toLowerCase() !== "false",

  port: Number(env.PORT || 3000),
  dryRun: (env.DRY_RUN ?? "true").toLowerCase() !== "false",
  auditLogPath: env.AUDIT_LOG_PATH || "./data/audit.jsonl",
  timezone: env.TIMEZONE || "America/New_York",
};

export type Config = typeof config;
