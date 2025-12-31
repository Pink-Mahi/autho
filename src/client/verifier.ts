import { verifySignature } from '../crypto';
import { TransitionValidator } from '../core/state-machine';
import { calculateEventHash } from '../core/hashing';
import {
  ProtocolEvent,
  Item,
  Manufacturer,
  Operator,
  ScanResult,
  ManufacturerStatus,
  ItemState,
  QuorumConfig,
  AuthenticationAttestation,
  Authenticator,
  AuthenticationDisplay,
  AuthenticatorStatus
} from '../types';

export interface ItemProofResponse {
  item: Item | null;
  events: ProtocolEvent[];
  operatorId: string;
  signature: string;
}

export interface AttestationsResponse {
  attestations: AuthenticationAttestation[];
  operatorId: string;
}

export class ClientVerifier {
  private quorum: QuorumConfig;

  constructor(quorum: QuorumConfig) {
    this.quorum = quorum;
  }

  async scanItem(
    itemId: string,
    operators: Operator[]
  ): Promise<ScanResult> {
    console.log(`[Client] Scanning item ${itemId}...`);

    const responses = await this.queryOperators(itemId, operators);

    if (responses.length < this.quorum.m) {
      return this.createFailedScanResult(itemId, 'Insufficient operator responses');
    }

    const consensus = this.findConsensusState(responses);
    if (!consensus) {
      return this.createFailedScanResult(itemId, 'No quorum consensus on item state');
    }

    const { item, events } = consensus;

    if (!item) {
      return this.createFailedScanResult(itemId, 'Item not found');
    }

    const manufacturer = await this.getManufacturerFromEvents(events);
    if (!manufacturer) {
      return this.createFailedScanResult(itemId, 'Manufacturer not found');
    }

    const eventChainValid = this.verifyEventChain(events);
    if (!eventChainValid.valid) {
      return this.createFailedScanResult(itemId, `Event chain invalid: ${eventChainValid.error}`);
    }

    const signaturesValid = this.verifyEventSignatures(events, operators);
    if (!signaturesValid.valid) {
      return this.createFailedScanResult(itemId, `Signatures invalid: ${signaturesValid.error}`);
    }

    const warnings: string[] = [];
    if (manufacturer.status !== ManufacturerStatus.ACTIVE) {
      warnings.push(`Manufacturer is ${manufacturer.status}`);
    }

    const canPurchase = item.currentState === ItemState.ACTIVE_HELD;

    const anchorStatus = this.checkAnchorStatus(events);

    const attestations = await this.fetchAndVerifyAttestations(itemId, operators);

    return {
      itemId,
      manufacturer: {
        name: manufacturer.name,
        status: manufacturer.status
      },
      currentState: item.currentState,
      isAuthentic: true,
      canPurchase,
      lastVerifiedAt: Date.now(),
      anchorStatus,
      warnings,
      attestations: attestations.length > 0 ? attestations : undefined
    };
  }

  private async queryOperators(
    itemId: string,
    operators: Operator[]
  ): Promise<ItemProofResponse[]> {
    const promises = operators.map(async (op) => {
      try {
        const response = await fetch(`${op.endpoint}/api/item/${itemId}/proof`);
        if (!response.ok) {
          return null;
        }
        return await response.json() as ItemProofResponse;
      } catch (error) {
        console.error(`[Client] Failed to query operator ${op.operatorId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is ItemProofResponse => r !== null);
  }

  private findConsensusState(
    responses: ItemProofResponse[]
  ): { item: Item; events: ProtocolEvent[] } | null {
    if (responses.length === 0) {
      return null;
    }

    const stateMap = new Map<string, { item: Item; events: ProtocolEvent[]; count: number }>();

    for (const response of responses) {
      if (!response.item) continue;

      const stateKey = JSON.stringify({
        itemId: response.item.itemId,
        currentState: response.item.currentState,
        lastEventHash: response.item.lastEventHash,
        lastEventHeight: response.item.lastEventHeight
      });

      const existing = stateMap.get(stateKey);
      if (existing) {
        existing.count++;
      } else {
        stateMap.set(stateKey, {
          item: response.item,
          events: response.events,
          count: 1
        });
      }
    }

    for (const [, value] of stateMap) {
      if (value.count >= this.quorum.m) {
        return { item: value.item, events: value.events };
      }
    }

    return null;
  }

  private verifyEventChain(events: ProtocolEvent[]): { valid: boolean; error?: string } {
    return TransitionValidator.validateEventChain(events);
  }

  private verifyEventSignatures(
    events: ProtocolEvent[],
    operators: Operator[]
  ): { valid: boolean; error?: string } {
    for (const event of events) {
      const calculatedHash = calculateEventHash(event);
      if (calculatedHash !== event.eventId) {
        return { valid: false, error: `Event ${event.eventId} hash mismatch` };
      }

      if (event.operatorSignatures.length < this.quorum.m) {
        return { valid: false, error: `Event ${event.eventId} has insufficient signatures` };
      }

      let validSigs = 0;
      for (const opSig of event.operatorSignatures) {
        if (verifySignature(event.eventId, opSig.signature, opSig.publicKey)) {
          validSigs++;
        }
      }

      if (validSigs < this.quorum.m) {
        return { valid: false, error: `Event ${event.eventId} has insufficient valid signatures` };
      }
    }

    return { valid: true };
  }

  private async getManufacturerFromEvents(events: ProtocolEvent[]): Promise<Manufacturer | null> {
    const mintEvent = events.find(e => e.eventType === 'ITEM_MINTED') as any;
    if (!mintEvent) {
      return null;
    }

    const regEvent = events.find(
      e => e.eventType === 'MANUFACTURER_REGISTERED' && (e as any).manufacturerId === mintEvent.manufacturerId
    ) as any;

    if (regEvent) {
      return {
        manufacturerId: regEvent.manufacturerId,
        name: regEvent.name,
        issuerPublicKey: regEvent.issuerPublicKey,
        status: ManufacturerStatus.ACTIVE,
        registeredAt: regEvent.timestamp
      };
    }

    return null;
  }

  private checkAnchorStatus(events: ProtocolEvent[]): {
    isAnchored: boolean;
    bitcoinTxHash?: string;
    blockHeight?: number;
  } {
    for (const event of events) {
      if (event.anchorTxHash) {
        return {
          isAnchored: true,
          bitcoinTxHash: event.anchorTxHash
        };
      }
    }

    return { isAnchored: false };
  }

  private createFailedScanResult(itemId: string, error: string): ScanResult {
    return {
      itemId,
      manufacturer: {
        name: 'Unknown',
        status: ManufacturerStatus.REVOKED
      },
      currentState: ItemState.BURNED,
      isAuthentic: false,
      canPurchase: false,
      lastVerifiedAt: Date.now(),
      anchorStatus: { isAnchored: false },
      warnings: [error]
    };
  }

  verifyOwnershipProof(
    itemId: string,
    ownerWallet: string,
    signature: string,
    publicKey: string,
    timestamp: number,
    nonce: string
  ): boolean {
    const now = Date.now();
    const age = (now - timestamp) / 1000;

    if (age > 300 || age < -60) {
      return false;
    }

    const message = `${itemId}:${ownerWallet}:${timestamp}:${nonce}`;
    return verifySignature(message, signature, publicKey);
  }

  private async fetchAndVerifyAttestations(
    itemId: string,
    operators: Operator[]
  ): Promise<AuthenticationDisplay[]> {
    try {
      const responses = await this.queryAttestations(itemId, operators);
      
      if (responses.length === 0) {
        return [];
      }

      const attestationMap = new Map<string, AuthenticationAttestation>();
      for (const response of responses) {
        for (const attestation of response.attestations) {
          attestationMap.set(attestation.attestationId, attestation);
        }
      }

      const displays: AuthenticationDisplay[] = [];
      
      for (const attestation of attestationMap.values()) {
        const authenticator = await this.getAuthenticatorFromOperators(
          attestation.authenticatorId,
          operators
        );

        if (!authenticator) {
          continue;
        }

        const isValid = this.verifyAttestation(attestation, authenticator);
        const now = Date.now();
        const isExpired = attestation.expiryTimestamp 
          ? now > attestation.expiryTimestamp 
          : false;

        displays.push({
          authenticator: {
            name: authenticator.name,
            specialization: authenticator.specialization,
            status: authenticator.status
          },
          confidence: attestation.confidence,
          scope: attestation.scope,
          notes: attestation.notes,
          issuedAt: attestation.issuedAt,
          expiryTimestamp: attestation.expiryTimestamp,
          isExpired,
          isValid: isValid && !isExpired && authenticator.status === AuthenticatorStatus.ACTIVE
        });
      }

      return displays.sort((a, b) => b.issuedAt - a.issuedAt);
    } catch (error) {
      console.error('[Client] Failed to fetch attestations:', error);
      return [];
    }
  }

  private async queryAttestations(
    itemId: string,
    operators: Operator[]
  ): Promise<AttestationsResponse[]> {
    const promises = operators.map(async (op) => {
      try {
        const response = await fetch(`${op.endpoint}/api/item/${itemId}/attestations`);
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        return {
          attestations: data.attestations || [],
          operatorId: op.operatorId
        } as AttestationsResponse;
      } catch (error) {
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is AttestationsResponse => r !== null);
  }

  private async getAuthenticatorFromOperators(
    authenticatorId: string,
    operators: Operator[]
  ): Promise<Authenticator | null> {
    for (const op of operators) {
      try {
        const response = await fetch(`${op.endpoint}/api/authenticator/${authenticatorId}`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  private verifyAttestation(
    attestation: AuthenticationAttestation,
    authenticator: Authenticator
  ): boolean {
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
    return verifySignature(message, attestation.authenticatorSignature, authenticator.publicKey);
  }
}
