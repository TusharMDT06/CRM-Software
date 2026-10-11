import { EventEmitter } from 'events';
import { getCurrentTenantId } from './tenantContext.js';

export interface DomainEventPayload {
  depth?: number;
  causedByWorkflow?: string;
  tenantId?: string;
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

    const tenantId = payload.tenantId || getCurrentTenantId();
    return super.emit(event, { ...payload, depth, tenantId });
  }
}

export const eventBus = new FlowdeskEventBus();

export function emitWorkflowEvent(event: string, payload: DomainEventPayload = {}): boolean {
  return eventBus.emitDomainEvent(event, payload);
}
