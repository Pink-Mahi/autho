import { ItemState, EventType, ProtocolEvent, Item, Manufacturer, ManufacturerStatus } from '../types';

export class StateMachine {
  static isValidTransition(currentState: ItemState, eventType: EventType): boolean {
    const transitions: Record<ItemState, EventType[]> = {
      [ItemState.MINTED]: [
        EventType.ITEM_ASSIGNED,
        EventType.ITEM_MOVED_TO_CUSTODY,
        EventType.ITEM_BURNED
      ],
      [ItemState.ACTIVE_HELD]: [
        EventType.ITEM_LOCKED,
        EventType.ITEM_MOVED_TO_CUSTODY,
        EventType.ITEM_BURNED
      ],
      [ItemState.LOCKED_IN_ESCROW]: [
        EventType.ITEM_SETTLED,
        EventType.ITEM_UNLOCKED_EXPIRED,
        EventType.ITEM_BURNED
      ],
      [ItemState.IN_CUSTODY]: [
        EventType.ITEM_ASSIGNED,
        EventType.ITEM_BURNED
      ],
      [ItemState.BURNED]: []
    };

    return transitions[currentState]?.includes(eventType) ?? false;
  }

  static getNextState(currentState: ItemState, eventType: EventType): ItemState {
    if (!this.isValidTransition(currentState, eventType)) {
      throw new Error(`Invalid transition from ${currentState} via ${eventType}`);
    }

    switch (eventType) {
      case EventType.ITEM_ASSIGNED:
        return ItemState.ACTIVE_HELD;
      
      case EventType.ITEM_LOCKED:
        return ItemState.LOCKED_IN_ESCROW;
      
      case EventType.ITEM_SETTLED:
        return ItemState.ACTIVE_HELD;
      
      case EventType.ITEM_UNLOCKED_EXPIRED:
        return ItemState.ACTIVE_HELD;
      
      case EventType.ITEM_MOVED_TO_CUSTODY:
        return ItemState.IN_CUSTODY;
      
      case EventType.ITEM_BURNED:
        return ItemState.BURNED;
      
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }

  static validateTransition(
    item: Item,
    event: ProtocolEvent,
    manufacturer?: Manufacturer
  ): { valid: boolean; error?: string } {
    if (event.itemId !== item.itemId) {
      return { valid: false, error: 'Event itemId does not match item' };
    }

    if (event.height !== item.lastEventHeight + 1) {
      return { valid: false, error: 'Event height is not sequential' };
    }

    if (event.previousEventHash !== item.lastEventHash) {
      return { valid: false, error: 'Previous event hash does not match' };
    }

    if (!this.isValidTransition(item.currentState, event.eventType)) {
      return {
        valid: false,
        error: `Invalid state transition from ${item.currentState} via ${event.eventType}`
      };
    }

    if (manufacturer && manufacturer.status !== ManufacturerStatus.ACTIVE) {
      if (event.eventType === EventType.ITEM_MINTED) {
        return { valid: false, error: 'Manufacturer is not active' };
      }
    }

    switch (event.eventType) {
      case EventType.ITEM_LOCKED:
        if (item.currentState !== ItemState.ACTIVE_HELD) {
          return { valid: false, error: 'Item must be ACTIVE_HELD to lock' };
        }
        break;

      case EventType.ITEM_SETTLED:
        if (item.currentState !== ItemState.LOCKED_IN_ESCROW) {
          return { valid: false, error: 'Item must be LOCKED_IN_ESCROW to settle' };
        }
        break;

      case EventType.ITEM_UNLOCKED_EXPIRED:
        if (item.currentState !== ItemState.LOCKED_IN_ESCROW) {
          return { valid: false, error: 'Item must be LOCKED_IN_ESCROW to unlock' };
        }
        break;

      case EventType.ITEM_MOVED_TO_CUSTODY:
        if (item.currentState === ItemState.LOCKED_IN_ESCROW) {
          return { valid: false, error: 'Cannot move locked item to custody' };
        }
        if (item.currentState === ItemState.BURNED) {
          return { valid: false, error: 'Cannot move burned item to custody' };
        }
        break;
    }

    return { valid: true };
  }

  static applyEvent(item: Item, event: ProtocolEvent): Item {
    const validation = this.validateTransition(item, event);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const newState = this.getNextState(item.currentState, event.eventType);
    
    const updatedItem: Item = {
      ...item,
      currentState: newState,
      lastEventHash: event.eventId,
      lastEventHeight: event.height
    };

    switch (event.eventType) {
      case EventType.ITEM_ASSIGNED:
        const assignEvent = event as any;
        updatedItem.currentOwnerWallet = assignEvent.ownerWallet;
        break;

      case EventType.ITEM_SETTLED:
        const settleEvent = event as any;
        updatedItem.currentOwnerWallet = settleEvent.buyerWallet;
        break;
    }

    return updatedItem;
  }
}

export class TransitionValidator {
  static validateEventChain(events: ProtocolEvent[]): { valid: boolean; error?: string } {
    if (events.length === 0) {
      return { valid: true };
    }

    for (let i = 1; i < events.length; i++) {
      const prevEvent = events[i - 1];
      const currEvent = events[i];

      if (currEvent.height !== prevEvent.height + 1) {
        return {
          valid: false,
          error: `Event height gap at index ${i}: ${prevEvent.height} -> ${currEvent.height}`
        };
      }

      if (currEvent.previousEventHash !== prevEvent.eventId) {
        return {
          valid: false,
          error: `Event hash chain broken at index ${i}`
        };
      }

      if (currEvent.timestamp < prevEvent.timestamp) {
        return {
          valid: false,
          error: `Event timestamp goes backward at index ${i}`
        };
      }
    }

    return { valid: true };
  }

  static validateEventTimestamp(
    event: ProtocolEvent,
    maxFutureSeconds: number = 300,
    maxPastSeconds: number = 86400
  ): { valid: boolean; error?: string } {
    const now = Date.now();
    const eventTime = event.timestamp;
    const diff = now - eventTime;

    if (diff < -maxFutureSeconds * 1000) {
      return {
        valid: false,
        error: `Event timestamp too far in future: ${new Date(eventTime).toISOString()}`
      };
    }

    if (diff > maxPastSeconds * 1000) {
      return {
        valid: false,
        error: `Event timestamp too far in past: ${new Date(eventTime).toISOString()}`
      };
    }

    return { valid: true };
  }
}
