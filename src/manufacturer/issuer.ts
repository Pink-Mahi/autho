import { generateKeyPair, signMessage } from '../crypto';
import { calculateManufacturerId, calculateItemId, calculateMetadataHash } from '../core/hashing';
import {
  Manufacturer,
  ManufacturerStatus,
  ManufacturerRegisteredEvent,
  ItemMintedEvent,
  EventType
} from '../types';

export interface ItemMetadata {
  model: string;
  serialNumber: string;
  description: string;
  imageUri?: string;
  additionalData?: Record<string, any>;
}

export class ManufacturerIssuer {
  private manufacturerId: string;
  private name: string;
  private privateKey: string;
  private publicKey: string;
  private address: string;

  constructor(name: string, privateKey?: string) {
    this.name = name;
    
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
    this.manufacturerId = calculateManufacturerId(this.name, this.publicKey, timestamp);
  }

  createRegistrationEvent(registrationFeeSats: number): Partial<ManufacturerRegisteredEvent> {
    const timestamp = Date.now();
    
    const event: Partial<ManufacturerRegisteredEvent> = {
      eventType: EventType.MANUFACTURER_REGISTERED,
      itemId: this.manufacturerId,
      timestamp,
      previousEventHash: '0'.repeat(64),
      manufacturerId: this.manufacturerId,
      name: this.name,
      issuerPublicKey: this.publicKey,
      registrationFeeSats
    };

    return event;
  }

  createMintEvent(
    metadata: ItemMetadata,
    mintingFeeSats: number
  ): Partial<ItemMintedEvent> {
    const timestamp = Date.now();
    const metadataHash = calculateMetadataHash(metadata);
    const itemId = calculateItemId(this.manufacturerId, metadataHash, timestamp);

    const event: Partial<ItemMintedEvent> = {
      eventType: EventType.ITEM_MINTED,
      itemId,
      timestamp,
      previousEventHash: '0'.repeat(64),
      manufacturerId: this.manufacturerId,
      metadataHash,
      mintingFeeSats
    };

    return event;
  }

  signEvent(event: any): string {
    const message = JSON.stringify(event);
    return signMessage(message, this.privateKey);
  }

  getManufacturer(): Manufacturer {
    return {
      manufacturerId: this.manufacturerId,
      name: this.name,
      issuerPublicKey: this.publicKey,
      status: ManufacturerStatus.ACTIVE,
      registeredAt: Date.now()
    };
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  getManufacturerId(): string {
    return this.manufacturerId;
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
