import { EventEmitter } from 'events';

export interface DomainEventPayload {
  depth?: number;
  causedByWorkflow?: string;
  [key: string]: any;
}

class FlowdeskEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitDomainEvent(event: string, payload: DomainEventPayload = {}): boolean {
    const depth = payload.depth || 0;
    if (depth > 3) {
      console.warn(`[EventBus] Loop Guard: Dropping event "${event}" with depth ${depth} > 3`);
      return false;
    }
    return super.emit(event, { ...payload, depth });
  }
}

export const eventBus = new FlowdeskEventBus();
