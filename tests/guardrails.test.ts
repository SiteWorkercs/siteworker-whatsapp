import { describe, expect, it } from "vitest";
import {
  checkOutbound,
  guessLanguage,
  isOptIn,
  isOptOut,
  mentionsInjury,
  redactSensitive,
} from "../src/agent/guardrails.js";

describe("sensitive data redaction", () => {
  it("removes SSNs in common formats", () => {
    expect(redactSensitive("ssn 123-45-6789").text).not.toContain("6789");
    expect(redactSensitive("123 45 6789 is mine").found).toContain("ssn");
    expect(redactSensitive("my social security number is 123456789").text).not.toContain("123456789");
    expect(redactSensitive("mi número de seguro social es 123456789").found).toContain("ssn");
  });

  it("removes card numbers (Luhn) and bank details", () => {
    expect(redactSensitive("card 4111 1111 1111 1111").found).toContain("card_number");
    expect(redactSensitive("routing 021000021 account 123456789012").text).not.toMatch(/021000021|123456789012/);
    expect(redactSensitive("mi cuenta del banco es 00012345678").found).toContain("bank_account");
  });

  it("leaves phone numbers, times and job IDs alone", () => {
    const t = "call me at 555-123-4567 about J-1001 at 6:00 AM";
    expect(redactSensitive(t)).toEqual({ text: t, found: [] });
  });
});

describe("keywords", () => {
  it("opt-out and opt-in", () => {
    for (const w of ["STOP", "stop.", "Baja", "ALTO", "cancelar"]) expect(isOptOut(w)).toBe(true);
    expect(isOptOut("stop sending me night shifts")).toBe(false);
    expect(isOptIn("START")).toBe(true);
  });

  it("injury detection EN/ES", () => {
    expect(mentionsInjury("my helper fell off the ladder")).toBe(true);
    expect(mentionsInjury("estoy herido")).toBe(true);
    expect(mentionsInjury("se cayó del andamio")).toBe(true);
    expect(mentionsInjury("what does the job pay")).toBe(false);
  });

  it("language guess", () => {
    expect(guessLanguage("Hola, hay trabajo?")).toBe("es");
    expect(guessLanguage("Any jobs in VA?")).toBe("en");
    expect(guessLanguage("ok", "es")).toBe("es");
  });
});

describe("outbound filter", () => {
  it("blocks entity names, staffing-agency positioning and billing talk", () => {
    expect(checkOutbound("Your pay comes from SiteWorker Management Solutions").blocked).toBe(true);
    expect(checkOutbound("That's our payroll LLC").blocked).toBe(true);
    expect(checkOutbound("We're a staffing agency").blocked).toBe(true);
    expect(checkOutbound("Our markup is 45%").blocked).toBe(true);
    expect(checkOutbound("I'll get this to our payroll team.").blocked).toBe(false);
    expect(checkOutbound("SiteWorker isn't a staffing agency. We're a workforce management platform.").blocked).toBe(false);
    expect(checkOutbound("No, we're not just a staffing agency.").blocked).toBe(false);
    expect(checkOutbound("SiteWorker no es una agencia de personal temporal.").blocked).toBe(false);
  });

  it("removes exclamation points", () => {
    expect(checkOutbound("¡Hola! Great news!!").text).toBe("Hola. Great news.");
  });
});
