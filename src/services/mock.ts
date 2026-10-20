import { randomUUID } from "node:crypto";
import type {
  Contact,
  Credentials,
  Directory,
  InterviewSlot,
  Job,
  JobBoard,
  JobSearch,
  Requests,
  Scheduling,
  Services,
  Shift,
} from "./types.js";

/**
 * MOCK DATA. Names, companies, sites and pay ranges are made up for
 * testing only. Replace with real adapters before going live.
 */

export function isoDate(daysFromToday: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function buildMockData(jobBoardUrl: string, today = new Date()) {
  const jobs: Job[] = [
    {
      id: "J-1001",
      title: "Journeyman Electrician",
      trade: "electrician",
      sector: "data_center",
      city: "Ashburn",
      state: "VA",
      startDate: isoDate(10, today),
      duration: "6 months",
      payRange: { min: 36, max: 44, unit: "hour" },
      perDiem: "Per diem available for workers living 50+ miles from site",
      prevailingWage: false,
      certificationsRequired: ["OSHA 10", "Virginia journeyman electrician license"],
      status: "open",
      url: `${jobBoardUrl}/jobs/J-1001`,
    },
    {
      id: "J-1002",
      title: "Solar PV Installer",
      trade: "solar installer",
      sector: "solar",
      city: "Wilson",
      state: "NC",
      startDate: isoDate(7, today),
      duration: "4 months",
      payRange: { min: 22, max: 28, unit: "hour" },
      perDiem: "Per diem paid weekly",
      travel: "Travel day paid at start and end of project",
      prevailingWage: false,
      certificationsRequired: ["OSHA 10"],
      status: "open",
      url: `${jobBoardUrl}/jobs/J-1002`,
    },
    {
      id: "J-1003",
      title: "Construction Laborer",
      trade: "laborer",
      sector: "solar",
      city: "Orangeburg",
      state: "SC",
      startDate: isoDate(14, today),
      duration: "5 months",
      // Prevailing wage: the rate is fixed by the wage determination.
      payRange: { min: 0, max: 0, unit: "hour" },
      perDiem: "Per diem available",
      prevailingWage: true,
      certificationsRequired: ["OSHA 10"],
      status: "open",
      url: `${jobBoardUrl}/jobs/J-1003`,
    },
    {
      id: "J-1004",
      title: "Electrical Apprentice",
      trade: "electrician",
      sector: "data_center",
      city: "Manassas",
      state: "VA",
      startDate: isoDate(21, today),
      duration: "8 months",
      payRange: { min: 20, max: 26, unit: "hour" },
      prevailingWage: false,
      certificationsRequired: ["OSHA 10"],
      status: "open",
      url: `${jobBoardUrl}/jobs/J-1004`,
    },
    {
      id: "J-1005",
      title: "Equipment Operator",
      trade: "equipment operator",
      sector: "civil",
      city: "Fayetteville",
      state: "NC",
      startDate: isoDate(5, today),
      duration: "3 months",
      payRange: { min: 27, max: 34, unit: "hour" },
      perDiem: "Per diem available",
      prevailingWage: false,
      certificationsRequired: ["OSHA 10", "NCCCO or equivalent for crane work"],
      status: "filled",
      url: `${jobBoardUrl}/jobs/J-1005`,
    },
  ];

  const contacts: Contact[] = [
    {
      kind: "worker",
      phone: "15550000001",
      name: "Luis Ramírez",
      language: "es",
      trade: "solar installer",
      state: "NC",
      track: "journeyman",
      certifications: [{ name: "OSHA 10" }],
      workforceSpecialist: "Workforce Specialist (Carolinas)",
    },
    {
      kind: "worker",
      phone: "15550000002",
      name: "Marcus Hill",
      language: "en",
      trade: "electrician",
      state: "VA",
      track: "apprentice",
      certifications: [{ name: "OSHA 10" }, { name: "NFPA 70E", expiresOn: isoDate(20, today) }],
      workforceSpecialist: "Workforce Specialist (Virginia)",
    },
    {
      kind: "worker",
      phone: "15550000003",
      name: "Tanya Brooks",
      language: "en",
      trade: "electrician",
      state: "VA",
      track: "journeyman",
      certifications: [
        { name: "OSHA 30" },
        { name: "Virginia journeyman electrician license", expiresOn: isoDate(25, today) },
      ],
      workforceSpecialist: "Workforce Specialist (Virginia)",
    },
    {
      kind: "client",
      phone: "15550000100",
      name: "Dana Whitfield",
      company: "Coastal Ridge Builders (mock client)",
      language: "en",
    },
  ];

  const shifts: Shift[] = [
    {
      id: "S-2001",
      workerPhone: "15550000001",
      jobId: "J-1002",
      siteName: "Wilson Solar Site",
      city: "Wilson",
      state: "NC",
      date: isoDate(1, today),
      startTime: "6:00 AM",
      status: "scheduled",
    },
    {
      id: "S-2002",
      workerPhone: "15550000002",
      jobId: "J-1004",
      siteName: "Manassas Data Center Site",
      city: "Manassas",
      state: "VA",
      date: isoDate(1, today),
      startTime: "7:00 AM",
      status: "scheduled",
    },
    {
      id: "S-2003",
      workerPhone: "15550000003",
      jobId: "J-1001",
      siteName: "Ashburn Data Center Site",
      city: "Ashburn",
      state: "VA",
      date: isoDate(0, today),
      startTime: "6:30 AM",
      status: "confirmed",
    },
  ];

  return { jobs, contacts, shifts };
}

function slotsFrom(today: Date): InterviewSlot[] {
  const out: InterviewSlot[] = [];
  for (let day = 1; out.length < 6 && day < 10; day++) {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    for (const hour of [10, 14, 16]) {
      // Stored as 'local Eastern' for the mock; real scheduler returns true ISO times.
      const date = d.toISOString().slice(0, 10);
      const label = `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"} ET`;
      out.push({ id: `SLOT-${date}-${hour}`, startsAt: `${date}T${String(hour).padStart(2, "0")}:00:00-04:00`, label });
      if (out.length >= 6) break;
    }
  }
  return out;
}

export function createMockServices(jobBoardUrl: string, today = new Date()) {
  const data = buildMockData(jobBoardUrl, today);
  const slots = slotsFrom(today);
  const booked = new Set<string>();

  const log = {
    interests: [] as Array<{ jobId: string; phone: string }>,
    crewRequests: [] as Array<Record<string, unknown>>,
    escalations: [] as Array<Record<string, unknown>>,
    referrals: [] as Array<Record<string, unknown>>,
    availability: [] as Array<Record<string, unknown>>,
    interviews: [] as Array<Record<string, unknown>>,
  };

  const jobs: JobBoard = {
    async search(q: JobSearch) {
      return data.jobs.filter(
        (j) =>
          j.status === "open" &&
          (!q.state || j.state.toUpperCase() === q.state.toUpperCase()) &&
          (!q.sector || j.sector === q.sector) &&
          (!q.trade || j.trade.toLowerCase().includes(q.trade.toLowerCase()) || j.title.toLowerCase().includes(q.trade.toLowerCase())) &&
          (!q.startAfter || j.startDate >= q.startAfter),
      );
    },
    async get(id) {
      return data.jobs.find((j) => j.id === id);
    },
    async recordInterest(jobId, phone) {
      const job = data.jobs.find((j) => j.id === jobId && j.status === "open");
      if (!job) return { ok: false, applyUrl: jobBoardUrl };
      log.interests.push({ jobId, phone });
      return { ok: true, applyUrl: job.url };
    },
  };

  const directory: Directory = {
    async find(phone) {
      return data.contacts.find((c) => c.phone === phone.replace(/\D/g, ""));
    },
  };

  const updateShift = (id: string, status: Shift["status"]) => {
    const s = data.shifts.find((x) => x.id === id);
    if (s) s.status = status;
    return s;
  };

  const scheduling: Scheduling = {
    async shiftsFor(phone) {
      return data.shifts.filter((s) => s.workerPhone === phone.replace(/\D/g, ""));
    },
    async shiftsOn(date) {
      return data.shifts.filter((s) => s.date === date);
    },
    async confirm(id) {
      return updateShift(id, "confirmed");
    },
    async markLate(id) {
      return updateShift(id, "late");
    },
    async markAbsent(id) {
      return updateShift(id, "absent");
    },
    async interviewSlots() {
      return slots.filter((s) => !booked.has(s.id));
    },
    async bookInterview(input) {
      const slot = slots.find((s) => s.id === input.slotId);
      if (!slot || booked.has(slot.id)) return { ok: false, reason: "slot_unavailable" };
      booked.add(slot.id);
      log.interviews.push({ ...input });
      return { ok: true, slot, meetLink: `https://meet.google.com/mock-${slot.id.slice(-8).toLowerCase()}` };
    },
  };

  const credentials: Credentials = {
    async certsFor(phone) {
      const c = data.contacts.find((x) => x.phone === phone.replace(/\D/g, ""));
      return c && c.kind === "worker" ? c.certifications : [];
    },
  };

  const requests: Requests = {
    async createCrewRequest(input) {
      const id = `CR-${randomUUID().slice(0, 8)}`;
      log.crewRequests.push({ id, ...input });
      return { id };
    },
    async createEscalation(input) {
      const id = `ESC-${randomUUID().slice(0, 8)}`;
      const contact = data.contacts.find((x) => x.phone === input.phone.replace(/\D/g, ""));
      const assignedTo =
        contact && contact.kind === "worker" ? contact.workforceSpecialist : "Workforce Specialist on duty";
      log.escalations.push({ id, assignedTo, ...input });
      return { id, assignedTo };
    },
    async createDoweReferral(input) {
      const id = `REF-${randomUUID().slice(0, 8)}`;
      log.referrals.push({ id, ...input });
      return { id };
    },
    async saveAvailability(input) {
      const id = `AV-${randomUUID().slice(0, 8)}`;
      log.availability.push({ id, ...input });
      return { id };
    },
  };

  const services: Services = { jobs, directory, scheduling, credentials, requests };
  return { services, data, log };
}
