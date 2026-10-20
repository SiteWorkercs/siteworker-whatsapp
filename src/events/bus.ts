import { AuditLog } from "../audit/log.js";

/**
 * Every inbound/outbound message and every action is an event.
 * Topics mirror the Kafka topics we'll use in production.
 */
export type Topic =
  | "whatsapp.message.inbound"
  | "whatsapp.message.outbound"
  | "whatsapp.message.status"
  | "whatsapp.optin"
  | "agent.tool_call"
  | "agent.guardrail"
  | "dispatch.alert"
  | "escalation.created"
  | "escalation.notified"
  | "crew_request.created"
  | "interview.booked"
  | "availability.submitted"
  | "dowe.referral";

export interface DomainEvent {
  topic: Topic;
  key: string; // partition key: the contact's phone number
  actor: string;
  payload: Record<string, unknown>;
}

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
}

/** Default bus for dev and tests. Keeps events in memory and lets you subscribe. */
export class InMemoryEventBus implements EventBus {
  readonly events: DomainEvent[] = [];
  private handlers: Array<(e: DomainEvent) => void> = [];
  async publish(event: DomainEvent) {
    this.events.push(event);
    for (const h of this.handlers) h(event);
  }
  subscribe(handler: (e: DomainEvent) => void) {
    this.handlers.push(handler);
  }
}

/**
 * Kafka adapter placeholder. Swap in kafkajs (or the Confluent client) here;
 * the rest of the code only depends on the EventBus interface.
 */
export class KafkaEventBus implements EventBus {
  constructor(private producer: { send(args: { topic: string; messages: Array<{ key: string; value: string }> }): Promise<unknown> }) {}
  async publish(event: DomainEvent) {
    await this.producer.send({
      topic: event.topic,
      messages: [{ key: event.key, value: JSON.stringify(event) }],
    });
  }
}

/**
 * Records every event in the hash-chained audit log, then publishes it.
 * Writing the audit entry first means nothing reaches downstream systems
 * without a matching audit record.
 */
export class Recorder {
  constructor(
    private audit: AuditLog,
    private bus: EventBus,
  ) {}

  async emit(event: DomainEvent) {
    const entry = this.audit.record(event.topic, event.actor, { key: event.key, ...event.payload });
    await this.bus.publish({ ...event, payload: { ...event.payload, auditSeq: entry.seq, auditHash: entry.hash } });
  }
}
