import { EventStore, FileEventStore } from './event-store';
import { StateMachine, TransitionValidator } from '../core/state-machine';
import { calculateEventHash } from '../core/hashing';
import { signMessage, verifySignature } from '../crypto';
import {
  ProtocolEvent,
  OperatorConfig,
  QuorumConfig,
  Operator,
  OperatorSignature,
  Item,
  Manufacturer,
  Authenticator,
  AuthenticationAttestation,
  EventType,
  ItemState
} from '../types';

export class OperatorNode {
  private config: OperatorConfig;
  private quorum: QuorumConfig;
  private store: EventStore;
  private peers: Map<string, Operator> = new Map();

  constructor(config: OperatorConfig, quorum: QuorumConfig, dataDir: string) {
    this.config = config;
    this.quorum = quorum;
    this.store = new FileEventStore(dataDir);
  }

  async initialize(): Promise<void> {
    console.log(`[Operator ${this.config.operatorId}] Initializing...`);
    console.log(`[Operator ${this.config.operatorId}] Quorum: ${this.quorum.m}-of-${this.quorum.n}`);
  }

  async submitEvent(event: ProtocolEvent): Promise<{ accepted: boolean; error?: string }> {
    console.log(`[Operator ${this.config.operatorId}] Received event ${event.eventType} for item ${event.itemId}`);

    const validation = await this.validateEvent(event);
    if (!validation.valid) {
      console.log(`[Operator ${this.config.operatorId}] Event validation failed: ${validation.error}`);
      return { accepted: false, error: validation.error };
    }

    const hasQuorum = this.verifyQuorum(event);
    if (!hasQuorum) {
      console.log(`[Operator ${this.config.operatorId}] Event does not have quorum`);
      return { accepted: false, error: 'Insufficient operator signatures' };
    }

    await this.store.saveEvent(event);

    const item = await this.updateItemState(event);
    if (item) {
      await this.store.saveItem(item);
    }

    console.log(`[Operator ${this.config.operatorId}] Event accepted: ${event.eventId}`);
    return { accepted: true };
  }

  async proposeEvent(event: Partial<ProtocolEvent>): Promise<ProtocolEvent> {
    const height = await this.store.getLatestHeight() + 1;
    
    const fullEvent: ProtocolEvent = {
      ...event,
      height,
      timestamp: Date.now(),
      operatorSignatures: []
    } as ProtocolEvent;

    fullEvent.eventId = calculateEventHash(fullEvent);

    const signature = signMessage(fullEvent.eventId, this.config.privateKey);
    fullEvent.operatorSignatures.push({
      operatorId: this.config.operatorId,
      publicKey: this.config.publicKey,
      signature
    });

    return fullEvent;
  }

  async signEvent(event: ProtocolEvent): Promise<OperatorSignature> {
    const eventHash = calculateEventHash(event);
    
    if (eventHash !== event.eventId) {
      throw new Error('Event hash mismatch');
    }

    const signature = signMessage(event.eventId, this.config.privateKey);
    
    return {
      operatorId: this.config.operatorId,
      publicKey: this.config.publicKey,
      signature
    };
  }

  private async validateEvent(event: ProtocolEvent): Promise<{ valid: boolean; error?: string }> {
    const calculatedHash = calculateEventHash(event);
    if (calculatedHash !== event.eventId) {
      return { valid: false, error: 'Event hash mismatch' };
    }

    const timestampValidation = TransitionValidator.validateEventTimestamp(event);
    if (!timestampValidation.valid) {
      return timestampValidation;
    }

    if (event.eventType === EventType.AUTHENTICATOR_REGISTERED) {
      return await this.validateAuthenticatorRegistration(event);
    }

    if (event.eventType === EventType.ITEM_AUTHENTICATED) {
      return await this.validateAuthenticationEvent(event);
    }

    if (event.eventType === EventType.ITEM_MINTED) {
      return await this.validateMintEvent(event);
    }

    const item = await this.store.getItem(event.itemId);
    if (!item) {
      return { valid: false, error: 'Item not found' };
    }

    const manufacturer = await this.store.getManufacturer(item.manufacturerId);
    const stateValidation = StateMachine.validateTransition(item, event, manufacturer || undefined);
    
    return stateValidation;
  }

  private async validateMintEvent(event: ProtocolEvent): Promise<{ valid: boolean; error?: string }> {
    const mintEvent = event as any;
    const manufacturer = await this.store.getManufacturer(mintEvent.manufacturerId);
    
    if (!manufacturer) {
      return { valid: false, error: 'Manufacturer not found' };
    }

    if (manufacturer.status !== 'ACTIVE') {
      return { valid: false, error: 'Manufacturer is not active' };
    }

    return { valid: true };
  }

  private async validateAuthenticatorRegistration(event: ProtocolEvent): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  private async validateAuthenticationEvent(event: ProtocolEvent): Promise<{ valid: boolean; error?: string }> {
    const authEvent = event as any;
    const attestation = authEvent.attestation;

    const authenticator = await this.store.getAuthenticator(attestation.authenticatorId);
    if (!authenticator) {
      return { valid: false, error: 'Authenticator not found' };
    }

    if (authenticator.status !== 'ACTIVE') {
      return { valid: false, error: 'Authenticator is not active' };
    }

    const attestationData = {
      attestationId: attestation.attestationId,
      itemId: attestation.itemId,
      authenticatorId: attestation.authenticatorId,
      confidence: attestation.confidence,
      scope: attestation.scope,
      notes: attestation.notes,
      expiryTimestamp: attestation.expiryTimestamp,
      issuedAt: attestation.issuedAt
    };

    const message = JSON.stringify(attestationData);
    const isValid = verifySignature(message, attestation.authenticatorSignature, authenticator.publicKey);

    if (!isValid) {
      return { valid: false, error: 'Invalid authenticator signature on attestation' };
    }

    return { valid: true };
  }

  private verifyQuorum(event: ProtocolEvent): boolean {
    if (event.operatorSignatures.length < this.quorum.m) {
      return false;
    }

    let validSignatures = 0;
    for (const opSig of event.operatorSignatures) {
      if (verifySignature(event.eventId, opSig.signature, opSig.publicKey)) {
        validSignatures++;
      }
    }

    return validSignatures >= this.quorum.m;
  }

  private async updateItemState(event: ProtocolEvent): Promise<Item | null> {
    if (event.eventType === EventType.AUTHENTICATOR_REGISTERED) {
      return null;
    }

    if (event.eventType === EventType.ITEM_AUTHENTICATED) {
      const authEvent = event as any;
      await this.store.saveAttestation(authEvent.attestation);
      return null;
    }

    if (event.eventType === EventType.ITEM_MINTED) {
      const mintEvent = event as any;
      const item: Item = {
        itemId: event.itemId,
        manufacturerId: mintEvent.manufacturerId,
        metadataHash: mintEvent.metadataHash,
        currentState: ItemState.MINTED,
        currentOwnerWallet: '',
        mintedAt: event.timestamp,
        lastEventHash: event.eventId,
        lastEventHeight: event.height
      };
      return item;
    }

    const item = await this.store.getItem(event.itemId);
    if (!item) {
      return null;
    }

    return StateMachine.applyEvent(item, event);
  }

  async getItem(itemId: string): Promise<Item | null> {
    return this.store.getItem(itemId);
  }

  async getItemEvents(itemId: string): Promise<ProtocolEvent[]> {
    return this.store.getEventsByItem(itemId);
  }

  async getManufacturer(manufacturerId: string): Promise<Manufacturer | null> {
    return this.store.getManufacturer(manufacturerId);
  }

  async registerManufacturer(manufacturer: Manufacturer): Promise<void> {
    await this.store.saveManufacturer(manufacturer);
  }

  async registerAuthenticator(authenticator: Authenticator): Promise<void> {
    await this.store.saveAuthenticator(authenticator);
  }

  async getAuthenticator(authenticatorId: string): Promise<Authenticator | null> {
    return this.store.getAuthenticator(authenticatorId);
  }

  async getAttestationsByItem(itemId: string): Promise<AuthenticationAttestation[]> {
    return this.store.getAttestationsByItem(itemId);
  }

  async getItemProof(itemId: string): Promise<{
    item: Item | null;
    events: ProtocolEvent[];
    operatorId: string;
    signature: string;
  }> {
    const item = await this.store.getItem(itemId);
    const events = await this.store.getEventsByItem(itemId);
    
    const proofData = JSON.stringify({ itemId, item, events });
    const signature = signMessage(proofData, this.config.privateKey);

    return {
      item,
      events,
      operatorId: this.config.operatorId,
      signature
    };
  }

  getOperatorInfo(): Operator {
    return {
      operatorId: this.config.operatorId,
      name: `Operator ${this.config.operatorId}`,
      publicKey: this.config.publicKey,
      btcAddress: this.config.btcAddress,
      endpoint: `http://localhost:${this.config.port}`,
      status: 'ACTIVE'
    };
  }
}
