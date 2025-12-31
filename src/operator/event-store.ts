import * as fs from 'fs';
import * as path from 'path';
import { ProtocolEvent, Item, Manufacturer, Authenticator, AuthenticationAttestation } from '../types';

export interface EventStore {
  saveEvent(event: ProtocolEvent): Promise<void>;
  getEvent(eventId: string): Promise<ProtocolEvent | null>;
  getEventsByItem(itemId: string): Promise<ProtocolEvent[]>;
  getEventsByHeight(startHeight: number, endHeight: number): Promise<ProtocolEvent[]>;
  getLatestHeight(): Promise<number>;
  saveItem(item: Item): Promise<void>;
  getItem(itemId: string): Promise<Item | null>;
  saveManufacturer(manufacturer: Manufacturer): Promise<void>;
  getManufacturer(manufacturerId: string): Promise<Manufacturer | null>;
  getAllManufacturers(): Promise<Manufacturer[]>;
  saveAuthenticator(authenticator: Authenticator): Promise<void>;
  getAuthenticator(authenticatorId: string): Promise<Authenticator | null>;
  getAllAuthenticators(): Promise<Authenticator[]>;
  saveAttestation(attestation: AuthenticationAttestation): Promise<void>;
  getAttestationsByItem(itemId: string): Promise<AuthenticationAttestation[]>;
}

export class FileEventStore implements EventStore {
  private dataDir: string;
  private eventsDir: string;
  private itemsDir: string;
  private manufacturersDir: string;
  private authenticatorsDir: string;
  private attestationsDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.eventsDir = path.join(dataDir, 'events');
    this.itemsDir = path.join(dataDir, 'items');
    this.manufacturersDir = path.join(dataDir, 'manufacturers');
    this.authenticatorsDir = path.join(dataDir, 'authenticators');
    this.attestationsDir = path.join(dataDir, 'attestations');
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.dataDir, this.eventsDir, this.itemsDir, this.manufacturersDir, 
     this.authenticatorsDir, this.attestationsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async saveEvent(event: ProtocolEvent): Promise<void> {
    const eventPath = path.join(this.eventsDir, `${event.eventId}.json`);
    await fs.promises.writeFile(eventPath, JSON.stringify(event, null, 2));
    
    const itemEventsPath = path.join(this.eventsDir, `item_${event.itemId}.json`);
    let itemEvents: string[] = [];
    
    if (fs.existsSync(itemEventsPath)) {
      const data = await fs.promises.readFile(itemEventsPath, 'utf8');
      itemEvents = JSON.parse(data);
    }
    
    if (!itemEvents.includes(event.eventId)) {
      itemEvents.push(event.eventId);
      await fs.promises.writeFile(itemEventsPath, JSON.stringify(itemEvents, null, 2));
    }
  }

  async getEvent(eventId: string): Promise<ProtocolEvent | null> {
    const eventPath = path.join(this.eventsDir, `${eventId}.json`);
    
    if (!fs.existsSync(eventPath)) {
      return null;
    }
    
    const data = await fs.promises.readFile(eventPath, 'utf8');
    return JSON.parse(data);
  }

  async getEventsByItem(itemId: string): Promise<ProtocolEvent[]> {
    const itemEventsPath = path.join(this.eventsDir, `item_${itemId}.json`);
    
    if (!fs.existsSync(itemEventsPath)) {
      return [];
    }
    
    const data = await fs.promises.readFile(itemEventsPath, 'utf8');
    const eventIds: string[] = JSON.parse(data);
    
    const events: ProtocolEvent[] = [];
    for (const eventId of eventIds) {
      const event = await this.getEvent(eventId);
      if (event) {
        events.push(event);
      }
    }
    
    return events.sort((a, b) => a.height - b.height);
  }

  async getEventsByHeight(startHeight: number, endHeight: number): Promise<ProtocolEvent[]> {
    const files = await fs.promises.readdir(this.eventsDir);
    const events: ProtocolEvent[] = [];
    
    for (const file of files) {
      if (file.startsWith('item_') || !file.endsWith('.json')) {
        continue;
      }
      
      const eventPath = path.join(this.eventsDir, file);
      const data = await fs.promises.readFile(eventPath, 'utf8');
      const event: ProtocolEvent = JSON.parse(data);
      
      if (event.height >= startHeight && event.height <= endHeight) {
        events.push(event);
      }
    }
    
    return events.sort((a, b) => a.height - b.height);
  }

  async getLatestHeight(): Promise<number> {
    const files = await fs.promises.readdir(this.eventsDir);
    let maxHeight = 0;
    
    for (const file of files) {
      if (file.startsWith('item_') || !file.endsWith('.json')) {
        continue;
      }
      
      const eventPath = path.join(this.eventsDir, file);
      const data = await fs.promises.readFile(eventPath, 'utf8');
      const event: ProtocolEvent = JSON.parse(data);
      
      if (event.height > maxHeight) {
        maxHeight = event.height;
      }
    }
    
    return maxHeight;
  }

  async saveItem(item: Item): Promise<void> {
    const itemPath = path.join(this.itemsDir, `${item.itemId}.json`);
    await fs.promises.writeFile(itemPath, JSON.stringify(item, null, 2));
  }

  async getItem(itemId: string): Promise<Item | null> {
    const itemPath = path.join(this.itemsDir, `${itemId}.json`);
    
    if (!fs.existsSync(itemPath)) {
      return null;
    }
    
    const data = await fs.promises.readFile(itemPath, 'utf8');
    return JSON.parse(data);
  }

  async saveManufacturer(manufacturer: Manufacturer): Promise<void> {
    const mfgPath = path.join(this.manufacturersDir, `${manufacturer.manufacturerId}.json`);
    await fs.promises.writeFile(mfgPath, JSON.stringify(manufacturer, null, 2));
  }

  async getManufacturer(manufacturerId: string): Promise<Manufacturer | null> {
    const mfgPath = path.join(this.manufacturersDir, `${manufacturerId}.json`);
    
    if (!fs.existsSync(mfgPath)) {
      return null;
    }
    
    const data = await fs.promises.readFile(mfgPath, 'utf8');
    return JSON.parse(data);
  }

  async getAllManufacturers(): Promise<Manufacturer[]> {
    const files = await fs.promises.readdir(this.manufacturersDir);
    const manufacturers: Manufacturer[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      
      const mfgPath = path.join(this.manufacturersDir, file);
      const data = await fs.promises.readFile(mfgPath, 'utf8');
      manufacturers.push(JSON.parse(data));
    }
    
    return manufacturers;
  }

  async saveAuthenticator(authenticator: Authenticator): Promise<void> {
    const authPath = path.join(this.authenticatorsDir, `${authenticator.authenticatorId}.json`);
    await fs.promises.writeFile(authPath, JSON.stringify(authenticator, null, 2));
  }

  async getAuthenticator(authenticatorId: string): Promise<Authenticator | null> {
    const authPath = path.join(this.authenticatorsDir, `${authenticatorId}.json`);
    
    if (!fs.existsSync(authPath)) {
      return null;
    }
    
    const data = await fs.promises.readFile(authPath, 'utf8');
    return JSON.parse(data);
  }

  async getAllAuthenticators(): Promise<Authenticator[]> {
    const files = await fs.promises.readdir(this.authenticatorsDir);
    const authenticators: Authenticator[] = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }
      
      const authPath = path.join(this.authenticatorsDir, file);
      const data = await fs.promises.readFile(authPath, 'utf8');
      authenticators.push(JSON.parse(data));
    }
    
    return authenticators;
  }

  async saveAttestation(attestation: AuthenticationAttestation): Promise<void> {
    const attPath = path.join(this.attestationsDir, `${attestation.attestationId}.json`);
    await fs.promises.writeFile(attPath, JSON.stringify(attestation, null, 2));
    
    const itemAttestationsPath = path.join(this.attestationsDir, `item_${attestation.itemId}.json`);
    let itemAttestations: string[] = [];
    
    if (fs.existsSync(itemAttestationsPath)) {
      const data = await fs.promises.readFile(itemAttestationsPath, 'utf8');
      itemAttestations = JSON.parse(data);
    }
    
    if (!itemAttestations.includes(attestation.attestationId)) {
      itemAttestations.push(attestation.attestationId);
      await fs.promises.writeFile(itemAttestationsPath, JSON.stringify(itemAttestations, null, 2));
    }
  }

  async getAttestationsByItem(itemId: string): Promise<AuthenticationAttestation[]> {
    const itemAttestationsPath = path.join(this.attestationsDir, `item_${itemId}.json`);
    
    if (!fs.existsSync(itemAttestationsPath)) {
      return [];
    }
    
    const data = await fs.promises.readFile(itemAttestationsPath, 'utf8');
    const attestationIds: string[] = JSON.parse(data);
    
    const attestations: AuthenticationAttestation[] = [];
    for (const attestationId of attestationIds) {
      const attPath = path.join(this.attestationsDir, `${attestationId}.json`);
      if (fs.existsSync(attPath)) {
        const attData = await fs.promises.readFile(attPath, 'utf8');
        attestations.push(JSON.parse(attData));
      }
    }
    
    return attestations.sort((a, b) => b.issuedAt - a.issuedAt);
  }
}
