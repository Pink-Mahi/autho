import { createHash } from 'crypto';
import {
  ItemRecord,
  ItemRegistrationRequest,
  OwnershipTransferRequest,
  AuthenticationRequest,
  RegistryEvent,
  RegistryLedger,
  OwnershipRecord,
  AuthenticationAttestation,
  PaymentVerification,
  RegistryStats
} from './registry-types';

/**
 * NON-CUSTODIAL ITEM REGISTRY
 * 
 * This is a REGISTRY of physical item ownership and authenticity.
 * It is NOT a token system, financial platform, or money transmitter.
 * 
 * Key regulatory compliance features:
 * - Item records created ONLY when physical items exist
 * - No pre-creation, no inventory, no supply
 * - Ownership is a state field, not a balance
 * - Payments are peer-to-peer (non-custodial)
 * - System verifies but never touches funds
 */
export class ItemRegistry {
  private ledger: RegistryLedger;

  constructor(
    operatorId: string,
    operatorPublicKey: string,
    quorumM: number,
    quorumN: number,
    peerOperators: string[]
  ) {
    this.ledger = {
      items: new Map(),
      events: [],
      itemsByOwner: new Map(),
      itemsByManufacturer: new Map(),
      itemsBySerialHash: new Map(),
      operatorId,
      operatorPublicKey,
      quorumM,
      quorumN,
      peerOperators,
      lastUpdated: Date.now(),
      totalItems: 0,
      totalTransfers: 0
    };
  }

  /**
   * Register a newly manufactured physical item.
   * 
   * CRITICAL: This can ONLY be called when a physical item actually exists.
   * One physical item = one registry entry (1:1 binding).
   * 
   * @param request Item registration request from manufacturer
   * @returns Created item record
   */
  async registerItem(request: ItemRegistrationRequest): Promise<ItemRecord> {
    // Validate manufacturer signature
    if (!this.validateManufacturerSignature(request)) {
      throw new Error('Invalid manufacturer signature');
    }

    // Hash serial number for privacy
    const serialNumberHash = this.hashData(request.serialNumber);

    // Check for duplicate serial number
    if (this.ledger.itemsBySerialHash.has(serialNumberHash)) {
      throw new Error('Item with this serial number already registered');
    }

    // Hash metadata
    const metadataHash = this.hashData(JSON.stringify(request.metadata));

    // Generate unique item ID
    const itemId = this.generateItemId(serialNumberHash, metadataHash, request.manufacturerId);

    // Create item record
    const itemRecord: ItemRecord = {
      itemId,
      manufacturerId: request.manufacturerId,
      manufacturerName: request.metadata.itemType, // Should come from manufacturer registry
      serialNumberHash,
      metadataHash,
      metadata: request.metadata,
      currentOwner: request.initialOwner,
      ownershipHistory: [{
        previousOwner: 'MANUFACTURER',
        newOwner: request.initialOwner,
        transferredAt: Date.now(),
        paymentVerified: false,
        operatorSignatures: [],
        transferType: 'sale',
        notes: 'Initial registration'
      }],
      authentications: [],
      manufacturerSignature: request.manufacturerSignature,
      operatorQuorumSignatures: [],
      registeredAt: Date.now(),
      lastUpdatedAt: Date.now(),
      status: 'registered'
    };

    // Get operator consensus
    const signatures = await this.getOperatorConsensus({
      eventType: 'ITEM_REGISTERED',
      itemId,
      data: request
    });

    itemRecord.operatorQuorumSignatures = signatures;

    // Store in ledger
    this.ledger.items.set(itemId, itemRecord);
    this.ledger.itemsBySerialHash.set(serialNumberHash, itemId);
    
    // Update indexes
    this.addToOwnerIndex(request.initialOwner, itemId);
    this.addToManufacturerIndex(request.manufacturerId, itemId);

    // Record event
    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: 'ITEM_REGISTERED',
      itemId,
      timestamp: Date.now(),
      data: request,
      operatorSignatures: signatures,
      quorumReached: signatures.length >= this.ledger.quorumM
    });

    this.ledger.totalItems++;
    this.ledger.lastUpdated = Date.now();

    console.log(`[Registry] Item registered: ${itemId} for manufacturer ${request.manufacturerId}`);

    return itemRecord;
  }

  /**
   * Transfer ownership of physical item.
   * 
   * This updates the ownership STATE, not a token balance.
   * Requires verification of peer-to-peer Bitcoin payment (non-custodial).
   * 
   * @param request Ownership transfer request
   * @returns Updated item record
   */
  async transferOwnership(request: OwnershipTransferRequest): Promise<ItemRecord> {
    const item = this.ledger.items.get(request.itemId);
    
    if (!item) {
      throw new Error('Item not found in registry');
    }

    if (item.currentOwner !== request.currentOwner) {
      throw new Error('Current owner mismatch');
    }

    // Verify current owner signature
    if (!this.validateOwnerSignature(request.currentOwner, request.currentOwnerSignature)) {
      throw new Error('Invalid current owner signature');
    }

    // Verify peer-to-peer Bitcoin payment (NON-CUSTODIAL)
    const paymentVerification = await this.verifyPayment(request.paymentTxHash, request.currentOwner, request.newOwner);
    
    if (!paymentVerification.verified) {
      throw new Error('Payment verification failed');
    }

    // Create ownership record
    const ownershipRecord: OwnershipRecord = {
      previousOwner: request.currentOwner,
      newOwner: request.newOwner,
      transferredAt: Date.now(),
      paymentTxHash: request.paymentTxHash,
      paymentVerified: true,
      operatorSignatures: [],
      transferType: request.transferType,
      notes: request.notes
    };

    // Get operator consensus
    const signatures = await this.getOperatorConsensus({
      eventType: 'OWNERSHIP_TRANSFERRED',
      itemId: request.itemId,
      data: request
    });

    ownershipRecord.operatorSignatures = signatures;

    // Update item record
    item.ownershipHistory.push(ownershipRecord);
    item.currentOwner = request.newOwner;
    item.lastUpdatedAt = Date.now();
    item.status = 'transferred';

    // Update indexes
    this.removeFromOwnerIndex(request.currentOwner, request.itemId);
    this.addToOwnerIndex(request.newOwner, request.itemId);

    // Record event
    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: 'OWNERSHIP_TRANSFERRED',
      itemId: request.itemId,
      timestamp: Date.now(),
      data: request,
      operatorSignatures: signatures,
      quorumReached: signatures.length >= this.ledger.quorumM,
      bitcoinTxHash: request.paymentTxHash
    });

    this.ledger.totalTransfers++;
    this.ledger.lastUpdated = Date.now();

    console.log(`[Registry] Ownership transferred: ${request.itemId} from ${request.currentOwner} to ${request.newOwner}`);

    return item;
  }

  /**
   * Add third-party authentication attestation.
   * 
   * This is informational only and does not affect ownership.
   * Authenticators verify physical item authenticity.
   * 
   * @param request Authentication request
   * @returns Updated item record
   */
  async authenticateItem(request: AuthenticationRequest): Promise<ItemRecord> {
    const item = this.ledger.items.get(request.itemId);
    
    if (!item) {
      throw new Error('Item not found in registry');
    }

    // Verify serial number matches
    const serialNumberHash = this.hashData(request.serialNumber);
    if (item.serialNumberHash !== serialNumberHash) {
      throw new Error('Serial number mismatch');
    }

    // Verify authenticator signature
    if (!this.validateAuthenticatorSignature(request)) {
      throw new Error('Invalid authenticator signature');
    }

    // Create attestation
    const attestation: AuthenticationAttestation = {
      attestationId: this.generateEventId(),
      authenticatorId: request.authenticatorId,
      authenticatorName: request.authenticatorId, // Should come from authenticator registry
      attestationHash: this.hashData(JSON.stringify(request)),
      issuedAt: Date.now(),
      expiresAt: request.expiresAt,
      isAuthentic: request.isAuthentic,
      confidence: request.confidence,
      notes: request.notes,
      authenticatorSignature: request.authenticatorSignature,
      operatorQuorumSignatures: []
    };

    // Get operator consensus
    const signatures = await this.getOperatorConsensus({
      eventType: 'ITEM_AUTHENTICATED',
      itemId: request.itemId,
      data: request
    });

    attestation.operatorQuorumSignatures = signatures;

    // Add to item record
    item.authentications.push(attestation);
    item.lastUpdatedAt = Date.now();
    item.status = 'authenticated';

    // Record event
    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: 'ITEM_AUTHENTICATED',
      itemId: request.itemId,
      timestamp: Date.now(),
      data: request,
      operatorSignatures: signatures,
      quorumReached: signatures.length >= this.ledger.quorumM
    });

    this.ledger.lastUpdated = Date.now();

    console.log(`[Registry] Item authenticated: ${request.itemId} by ${request.authenticatorId}`);

    return item;
  }

  /**
   * Verify peer-to-peer Bitcoin payment (NON-CUSTODIAL).
   * 
   * The system NEVER touches funds. It only verifies that payment occurred.
   * 
   * @param txHash Bitcoin transaction hash
   * @param sender Expected sender address
   * @param recipient Expected recipient address
   * @returns Payment verification result
   */
  private async verifyPayment(
    txHash: string,
    sender: string,
    recipient: string
  ): Promise<PaymentVerification> {
    // TODO: Implement actual Bitcoin transaction verification
    // This would query a Bitcoin node or block explorer API
    
    // For now, simulate verification
    console.log(`[Registry] Verifying payment: ${txHash}`);
    
    return {
      txHash,
      verified: true,
      amount: 0, // Would be extracted from transaction
      sender,
      recipient,
      confirmations: 1,
      timestamp: Date.now()
    };
  }

  /**
   * Get operator consensus signatures.
   * 
   * Simulates M-of-N quorum validation.
   * In production, this would broadcast to peer operators.
   */
  private async getOperatorConsensus(event: Partial<RegistryEvent>): Promise<string[]> {
    // Simulate consensus - in production, broadcast to peers
    const signatures: string[] = [];
    
    // Add own signature
    signatures.push(this.signData(JSON.stringify(event)));
    
    // Simulate peer signatures (would be actual network calls)
    for (let i = 0; i < this.ledger.quorumM - 1; i++) {
      signatures.push(`peer_signature_${i}_${Date.now()}`);
    }
    
    return signatures;
  }

  // Helper methods

  private hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private generateItemId(serialHash: string, metadataHash: string, manufacturerId: string): string {
    const combined = `${serialHash}:${metadataHash}:${manufacturerId}`;
    return `ITEM_${this.hashData(combined).substring(0, 16)}`;
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private signData(data: string): string {
    // TODO: Implement actual cryptographic signing
    return `sig_${this.hashData(data).substring(0, 32)}`;
  }

  private validateManufacturerSignature(request: ItemRegistrationRequest): boolean {
    // TODO: Implement actual signature verification
    return request.manufacturerSignature.length > 0;
  }

  private validateOwnerSignature(owner: string, signature: string): boolean {
    // TODO: Implement actual signature verification
    return signature.length > 0;
  }

  private validateAuthenticatorSignature(request: AuthenticationRequest): boolean {
    // TODO: Implement actual signature verification
    return request.authenticatorSignature.length > 0;
  }

  private addToOwnerIndex(owner: string, itemId: string): void {
    if (!this.ledger.itemsByOwner.has(owner)) {
      this.ledger.itemsByOwner.set(owner, []);
    }
    this.ledger.itemsByOwner.get(owner)!.push(itemId);
  }

  private removeFromOwnerIndex(owner: string, itemId: string): void {
    const items = this.ledger.itemsByOwner.get(owner);
    if (items) {
      const index = items.indexOf(itemId);
      if (index > -1) {
        items.splice(index, 1);
      }
    }
  }

  private addToManufacturerIndex(manufacturerId: string, itemId: string): void {
    if (!this.ledger.itemsByManufacturer.has(manufacturerId)) {
      this.ledger.itemsByManufacturer.set(manufacturerId, []);
    }
    this.ledger.itemsByManufacturer.get(manufacturerId)!.push(itemId);
  }

  private recordEvent(event: RegistryEvent): void {
    this.ledger.events.push(event);
  }

  // Query methods

  getItem(itemId: string): ItemRecord | undefined {
    return this.ledger.items.get(itemId);
  }

  getItemBySerialHash(serialHash: string): ItemRecord | undefined {
    const itemId = this.ledger.itemsBySerialHash.get(serialHash);
    return itemId ? this.ledger.items.get(itemId) : undefined;
  }

  getItemsByOwner(owner: string): ItemRecord[] {
    const itemIds = this.ledger.itemsByOwner.get(owner) || [];
    return itemIds.map(id => this.ledger.items.get(id)!).filter(Boolean);
  }

  getItemsByManufacturer(manufacturerId: string): ItemRecord[] {
    const itemIds = this.ledger.itemsByManufacturer.get(manufacturerId) || [];
    return itemIds.map(id => this.ledger.items.get(id)!).filter(Boolean);
  }

  getOwnershipHistory(itemId: string): OwnershipRecord[] {
    const item = this.ledger.items.get(itemId);
    return item ? item.ownershipHistory : [];
  }

  getStats(): RegistryStats {
    const itemsByStatus: Record<string, number> = {};
    
    this.ledger.items.forEach(item => {
      itemsByStatus[item.status] = (itemsByStatus[item.status] || 0) + 1;
    });

    return {
      totalItems: this.ledger.totalItems,
      totalManufacturers: this.ledger.itemsByManufacturer.size,
      totalOwners: this.ledger.itemsByOwner.size,
      totalTransfers: this.ledger.totalTransfers,
      totalAuthentications: Array.from(this.ledger.items.values())
        .reduce((sum, item) => sum + item.authentications.length, 0),
      itemsByStatus,
      recentActivity: this.ledger.events.slice(-10)
    };
  }

  // Ledger management

  exportLedger(): string {
    return JSON.stringify({
      items: Array.from(this.ledger.items.entries()),
      events: this.ledger.events,
      metadata: {
        operatorId: this.ledger.operatorId,
        lastUpdated: this.ledger.lastUpdated,
        totalItems: this.ledger.totalItems,
        totalTransfers: this.ledger.totalTransfers
      }
    });
  }

  importLedger(ledgerData: string): void {
    const data = JSON.parse(ledgerData);
    
    this.ledger.items = new Map(data.items);
    this.ledger.events = data.events;
    this.ledger.lastUpdated = data.metadata.lastUpdated;
    this.ledger.totalItems = data.metadata.totalItems;
    this.ledger.totalTransfers = data.metadata.totalTransfers;

    // Rebuild indexes
    this.rebuildIndexes();
  }

  private rebuildIndexes(): void {
    this.ledger.itemsByOwner.clear();
    this.ledger.itemsByManufacturer.clear();
    this.ledger.itemsBySerialHash.clear();

    this.ledger.items.forEach((item, itemId) => {
      this.addToOwnerIndex(item.currentOwner, itemId);
      this.addToManufacturerIndex(item.manufacturerId, itemId);
      this.ledger.itemsBySerialHash.set(item.serialNumberHash, itemId);
    });
  }
}
