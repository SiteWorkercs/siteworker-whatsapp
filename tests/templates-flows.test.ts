import { describe, expect, it } from "vitest";
import { TEMPLATES, allDefinitions } from "../src/whatsapp/templates.js";
import { FLOWS } from "../src/whatsapp/flows.js";
import { SCENARIOS } from "../scripts/scenarios.js";

describe("templates", () => {
  it("all 8 build and pass the Kapso/Meta validator", () => {
    expect(allDefinitions()).toHaveLength(8);
  });

  it("EN and ES use the same parameters, with no exclamation points", () => {
    for (const t of TEMPLATES) {
      const names = t.params.map((p) => p.name).sort();
      for (const body of Object.values(t.body)) {
        const used = [...body.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
        expect(used).toEqual(names);
        expect(body).not.toMatch(/[!¡]/);
        // Meta rejects bodies that start or end with a variable
        expect(body.trim()).not.toMatch(/^{{|}}\.?$/);
      }
    }
  });
});

describe("flows", () => {
  it("every form field is returned in the submit payload", () => {
    for (const f of FLOWS) {
      const children = f.json().screens[0].layout.children as any[];
      const fields = children.filter((c) => c.name).map((c) => c.name).sort();
      const footer = children.find((c) => c.type === "Footer");
      expect(Object.keys(footer["on-click-action"].payload).sort()).toEqual(fields);
    }
  });
});

describe("scenarios", () => {
  it("there are 15 test conversations covering EN and ES", () => {
    expect(SCENARIOS).toHaveLength(15);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(15);
  });
});
