import { generateKeyPair, signMessage } from '../crypto';
import { calculateAuthenticatorId, calculateAttestationId } from '../core/hashing';
import {
  Authenticator,
  AuthenticatorStatus,
  AuthenticatorRegisteredEvent,
  ItemAuthenticatedEvent,
  AuthenticationAttestation,
  EventType
} from '../types';

export class AuthenticatorIssuer {
  private authenticatorId: string;
  private name: string;
  private specialization: string;
  private privateKey: string;
  private publicKey: string;
  private address: string;

  constructor(name: string, specialization: string, privateKey?: string) {
    this.name = name;
    this.specialization = specialization;
    
    if (privateKey) {
      const keyPair = generateKeyPair();
      this.privateKey = privateKey;
      this.publicKey = keyPair.publicKey;
      this.address = keyPair.address;
    } else {
      const keyPair = generateKeyPair();
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
      this.address = keyPair.address;
    }

    const timestamp = Date.now();
    this.authenticatorId = calculateAuthenticatorId(this.name, this.publicKey, timestamp);
  }

  createRegistrationEvent(registrationFeeSats: number): Partial<AuthenticatorRegisteredEvent> {
    const timestamp = Date.now();
    
    const event: Partial<AuthenticatorRegisteredEvent> = {
      eventType: EventType.AUTHENTICATOR_REGISTERED,
      itemId: this.authenticatorId,
      timestamp,
      previousEventHash: '0'.repeat(64),
      authenticatorId: this.authenticatorId,
      name: this.name,
      publicKey: this.publicKey,
      specialization: this.specialization,
      registrationFeeSats
    };

    return event;
  }

  createAttestation(
    itemId: string,
    confidence: number,
    scope: string,
    notes?: string,
    expiryHours?: number
  ): AuthenticationAttestation {
    const issuedAt = Date.now();
    const attestationId = calculateAttestationId(itemId, this.authenticatorId, issuedAt);
    
    const expiryTimestamp = expiryHours 
      ? issuedAt + expiryHours * 3600 * 1000 
      : undefined;

    const attestationData = {
      attestationId,
      itemId,
      authenticatorId: this.authenticatorId,
      confidence,
      scope,
      notes,
      expiryTimestamp,
      issuedAt
    };

    const message = JSON.stringify(attestationData);
    const authenticatorSignature = signMessage(message, this.privateKey);

    return {
      ...attestationData,
      authenticatorSignature
    };
  }

  createAuthenticationEvent(
    itemId: string,
    attestation: AuthenticationAttestation,
    previousEventHash: string,
    height: number
  ): Partial<ItemAuthenticatedEvent> {
    const timestamp = Date.now();

    const event: Partial<ItemAuthenticatedEvent> = {
      eventType: EventType.ITEM_AUTHENTICATED,
      itemId,
      timestamp,
      height,
      previousEventHash,
      attestation
    };

    return event;
  }

  signEvent(event: any): string {
    const message = JSON.stringify(event);
    return signMessage(message, this.privateKey);
  }

  getAuthenticator(): Authenticator {
    return {
      authenticatorId: this.authenticatorId,
      name: this.name,
      publicKey: this.publicKey,
      specialization: this.specialization,
      status: AuthenticatorStatus.ACTIVE,
      registeredAt: Date.now()
    };
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getAuthenticatorId(): string {
    return this.authenticatorId;
  }

  getBtcAddress(): string {
    return this.address;
  }

  exportKeys(): { privateKey: string; publicKey: string; address: string } {
    return {
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      address: this.address
    };
  }
}
