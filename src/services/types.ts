/**
 * Interfaces the agent depends on. Today they're backed by mock data
 * (src/services/mock.ts). Later each one gets a real adapter:
 *   JobBoard       -> marketplace.siteworker.com API
 *   Directory      -> BambooHR (workers) + platform accounts (clients)
 *   Scheduling     -> scheduler / dispatch system
 *   Credentials    -> Checkr + platform cert records
 *   Requests       -> SiteWorker platform (crew requests, escalations, referrals)
 */

export type Lang = "en" | "es";
export type State = "VA" | "NC" | "SC" | "PA" | string;

export interface PayRange {
  min: number;
  max: number;
  unit: "hour";
}

export interface Job {
  id: string;
  title: string;
  trade: string;
  sector: "solar" | "data_center" | "bess" | "wind" | "electrical" | "civil";
  city: string;
  state: State;
  startDate: string; // YYYY-MM-DD
  duration: string;
  payRange: PayRange;
  perDiem?: string;
  travel?: string;
  prevailingWage: boolean;
  certificationsRequired: string[];
  status: "open" | "filled";
  url: string;
}

export interface Certification {
  name: string;
  expiresOn?: string; // YYYY-MM-DD
}

export interface WorkerProfile {
  kind: "worker";
  phone: string;
  name: string;
  language: Lang;
  trade?: string;
  state?: State;
  track?: "journeyman" | "apprentice";
  certifications: Certification[];
  workforceSpecialist: string;
}

export interface ClientProfile {
  kind: "client";
  phone: string;
  name: string;
  company: string;
  language: Lang;
}

export type Contact = WorkerProfile | ClientProfile;

export interface Shift {
  id: string;
  workerPhone: string;
  jobId: string;
  siteName: string;
  city: string;
  state: State;
  date: string; // YYYY-MM-DD
  startTime: string; // "6:00 AM"
  status: "scheduled" | "confirmed" | "late" | "absent";
}

export interface InterviewSlot {
  id: string;
  startsAt: string; // ISO
  label: string; // human readable, in Eastern time
}

export interface JobSearch {
  state?: string;
  trade?: string;
  sector?: string;
  startAfter?: string;
}

export interface JobBoard {
  search(q: JobSearch): Promise<Job[]>;
  get(id: string): Promise<Job | undefined>;
  recordInterest(jobId: string, phone: string): Promise<{ ok: boolean; applyUrl: string }>;
}

export interface Directory {
  find(phone: string): Promise<Contact | undefined>;
}

export interface Scheduling {
  shiftsFor(phone: string): Promise<Shift[]>;
  shiftsOn(date: string): Promise<Shift[]>;
  confirm(shiftId: string): Promise<Shift | undefined>;
  markLate(shiftId: string, etaMinutes?: number): Promise<Shift | undefined>;
  markAbsent(shiftId: string): Promise<Shift | undefined>;
  interviewSlots(): Promise<InterviewSlot[]>;
  bookInterview(input: {
    phone: string;
    slotId: string;
    name: string;
    trade: string;
    state: string;
    yearsExperience?: number;
    certifications?: string[];
    language: Lang;
  }): Promise<{ ok: boolean; slot?: InterviewSlot; meetLink?: string; reason?: string }>;
}

export interface Credentials {
  certsFor(phone: string): Promise<Certification[]>;
}

export interface Requests {
  createCrewRequest(input: Record<string, unknown>): Promise<{ id: string }>;
  createEscalation(input: {
    phone: string;
    reason: string;
    priority: "urgent" | "normal";
    summary: string;
  }): Promise<{ id: string; assignedTo: string }>;
  createDoweReferral(input: { phone: string; interest: string; texasVeteran?: boolean }): Promise<{ id: string }>;
  saveAvailability(input: { phone: string; response: Record<string, unknown> }): Promise<{ id: string }>;
}

export interface Services {
  jobs: JobBoard;
  directory: Directory;
  scheduling: Scheduling;
  credentials: Credentials;
  requests: Requests;
}
