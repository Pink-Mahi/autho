import { sha256 } from '../crypto';
import {
  BaseEvent,
  ProtocolEvent,
  EventType,
  ManufacturerRegisteredEvent,
  ItemMintedEvent,
  ItemAssignedEvent,
  ItemLockedEvent,
  ItemSettledEvent,
  ItemUnlockedExpiredEvent,
  ItemMovedToCustodyEvent,
  ItemBurnedEvent,
  AuthenticatorRegisteredEvent,
  ItemAuthenticatedEvent
} from '../types';

export function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: any = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  
  return sorted;
}

export function canonicalSerialize(obj: any): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted);
}

export function calculateEventHash(event: ProtocolEvent): string {
  const canonical: any = {
    eventType: event.eventType,
    itemId: event.itemId,
    height: event.height,
    timestamp: event.timestamp,
    previousEventHash: event.previousEventHash
  };

  switch (event.eventType) {
    case EventType.MANUFACTURER_REGISTERED:
      const mfgEvent = event as ManufacturerRegisteredEvent;
      canonical.manufacturerId = mfgEvent.manufacturerId;
      canonical.name = mfgEvent.name;
      canonical.issuerPublicKey = mfgEvent.issuerPublicKey;
      canonical.registrationFeeSats = mfgEvent.registrationFeeSats;
      break;

    case EventType.ITEM_MINTED:
      const mintEvent = event as ItemMintedEvent;
      canonical.manufacturerId = mintEvent.manufacturerId;
      canonical.metadataHash = mintEvent.metadataHash;
      canonical.mintingFeeSats = mintEvent.mintingFeeSats;
      break;

    case EventType.ITEM_ASSIGNED:
      const assignEvent = event as ItemAssignedEvent;
      canonical.ownerWallet = assignEvent.ownerWallet;
      canonical.ownerSignature = assignEvent.ownerSignature;
      break;

    case EventType.ITEM_LOCKED:
      const lockEvent = event as ItemLockedEvent;
      canonical.offerId = lockEvent.offerId;
      canonical.sellerWallet = lockEvent.sellerWallet;
      canonical.buyerWallet = lockEvent.buyerWallet;
      canonical.priceSats = lockEvent.priceSats;
      canonical.expiryTimestamp = lockEvent.expiryTimestamp;
      canonical.escrowFeeSats = lockEvent.escrowFeeSats;
      break;

    case EventType.ITEM_SETTLED:
      const settleEvent = event as ItemSettledEvent;
      canonical.offerId = settleEvent.offerId;
      canonical.buyerWallet = settleEvent.buyerWallet;
      canonical.priceSats = settleEvent.priceSats;
      canonical.paymentProof = settleEvent.paymentProof;
      canonical.settlementFeeSats = settleEvent.settlementFeeSats;
      break;

    case EventType.ITEM_UNLOCKED_EXPIRED:
      const unlockEvent = event as ItemUnlockedExpiredEvent;
      canonical.offerId = unlockEvent.offerId;
      canonical.expiryTimestamp = unlockEvent.expiryTimestamp;
      break;

    case EventType.ITEM_MOVED_TO_CUSTODY:
      const custodyEvent = event as ItemMovedToCustodyEvent;
      canonical.custodianId = custodyEvent.custodianId;
      canonical.reason = custodyEvent.reason;
      break;

    case EventType.ITEM_BURNED:
      const burnEvent = event as ItemBurnedEvent;
      canonical.reason = burnEvent.reason;
      if (burnEvent.burnProof) {
        canonical.burnProof = burnEvent.burnProof;
      }
      break;

    case EventType.AUTHENTICATOR_REGISTERED:
      const authRegEvent = event as AuthenticatorRegisteredEvent;
      canonical.authenticatorId = authRegEvent.authenticatorId;
      canonical.name = authRegEvent.name;
      canonical.publicKey = authRegEvent.publicKey;
      canonical.specialization = authRegEvent.specialization;
      canonical.registrationFeeSats = authRegEvent.registrationFeeSats;
      break;

    case EventType.ITEM_AUTHENTICATED:
      const authEvent = event as ItemAuthenticatedEvent;
      canonical.attestation = authEvent.attestation;
      break;
  }

  const serialized = canonicalSerialize(canonical);
  return sha256(serialized);
}

export function calculateItemId(
  manufacturerId: string,
  metadataHash: string,
  timestamp: number
): string {
  return sha256(`${manufacturerId}:${metadataHash}:${timestamp}`);
}

export function calculateManufacturerId(
  name: string,
  issuerPublicKey: string,
  timestamp: number
): string {
  return sha256(`${name}:${issuerPublicKey}:${timestamp}`);
}

export function calculateOfferId(
  itemId: string,
  buyerWallet: string,
  priceSats: number,
  timestamp: number
): string {
  return sha256(`${itemId}:${buyerWallet}:${priceSats}:${timestamp}`);
}

export function calculateMetadataHash(metadata: any): string {
  const serialized = canonicalSerialize(metadata);
  return sha256(serialized);
}

export function calculateAuthenticatorId(
  name: string,
  publicKey: string,
  timestamp: number
): string {
  return sha256(`${name}:${publicKey}:${timestamp}`);
}

export function calculateAttestationId(
  itemId: string,
  authenticatorId: string,
  timestamp: number
): string {
  return sha256(`${itemId}:${authenticatorId}:${timestamp}`);
}
