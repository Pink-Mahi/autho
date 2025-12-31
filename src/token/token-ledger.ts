import * as crypto from 'crypto';
import { 
  Token, 
  TokenTransaction, 
  TokenLedger, 
  TokenMintRequest, 
  TokenSaleRequest, 
  TokenEmbedRequest, 
  TokenTransferRequest,
  ConsensusValidation,
  OwnershipRecord
} from './token-types';

export class DistributedTokenLedger {
  private ledger: TokenLedger;
  private operatorId: string;
  private operatorPrivateKey: string;
  private quorumM: number;
  private quorumN: number;
  private peerNodes: string[];

  constructor(
    operatorId: string,
    operatorPrivateKey: string,
    quorumM: number = 3,
    quorumN: number = 5,
    peerNodes: string[] = []
  ) {
    this.operatorId = operatorId;
    this.operatorPrivateKey = operatorPrivateKey;
    this.quorumM = quorumM;
    this.quorumN = quorumN;
    this.peerNodes = peerNodes;

    this.ledger = {
      tokens: new Map(),
      transactions: [],
      lastBlockHeight: 0,
      lastSyncedAt: Date.now()
    };
  }

  /**
   * Main node mints new tokens (creates token supply)
   */
  async mintTokens(request: TokenMintRequest): Promise<Token[]> {
    if (this.operatorId !== 'main-node') {
      throw new Error('Only main node can mint tokens');
    }

    const tokens: Token[] = [];
    const batchId = request.batchId || `batch_${Date.now()}`;

    for (let i = 0; i < request.quantity; i++) {
      const tokenId = this.generateTokenId();
      const token: Token = {
        tokenId,
        status: 'minted',
        itemData: null,
        currentOwner: request.mintedBy,
        ownershipHistory: [{
          owner: request.mintedBy,
          timestamp: Date.now(),
          transactionHash: this.generateTxHash(),
          transferType: 'mint'
        }],
        mintedAt: Date.now(),
        mintedBy: request.mintedBy,
        signatures: []
      };

      this.ledger.tokens.set(tokenId, token);
      tokens.push(token);
    }

    // Create mint transaction
    const tx: TokenTransaction = {
      txId: this.generateTxHash(),
      type: 'mint',
      tokenId: batchId,
      from: 'SYSTEM',
      to: request.mintedBy,
      timestamp: Date.now(),
      signatures: [],
      validated: true,
      validatedBy: [this.operatorId]
    };

    this.ledger.transactions.push(tx);

    console.log(`[Token Ledger] Minted ${tokens.length} tokens in batch ${batchId}`);
    return tokens;
  }

  /**
   * Main node sells tokens to manufacturer
   */
  async sellTokens(request: TokenSaleRequest): Promise<boolean> {
    if (this.operatorId !== 'main-node') {
      throw new Error('Only main node can sell tokens');
    }

    // Verify tokens exist and are owned by main node
    for (const tokenId of request.tokenIds) {
      const token = this.ledger.tokens.get(tokenId);
      if (!token) {
        throw new Error(`Token ${tokenId} not found`);
      }
      if (token.currentOwner !== 'main-node') {
        throw new Error(`Token ${tokenId} not owned by main node`);
      }
      if (token.status === 'embedded') {
        throw new Error(`Token ${tokenId} already embedded with item data`);
      }
    }

    // Transfer tokens to buyer
    for (const tokenId of request.tokenIds) {
      const token = this.ledger.tokens.get(tokenId)!;
      
      const ownershipRecord: OwnershipRecord = {
        owner: request.buyer,
        timestamp: Date.now(),
        transactionHash: this.generateTxHash(),
        transferType: 'sale'
      };

      token.currentOwner = request.buyer;
      token.ownershipHistory.push(ownershipRecord);
    }

    // Create sale transaction
    const tx: TokenTransaction = {
      txId: this.generateTxHash(),
      type: 'sell',
      tokenId: request.tokenIds.join(','),
      from: 'main-node',
      to: request.buyer,
      timestamp: Date.now(),
      price: request.price,
      signatures: [],
      validated: true,
      validatedBy: [this.operatorId]
    };

    this.ledger.transactions.push(tx);

    console.log(`[Token Ledger] Sold ${request.tokenIds.length} tokens to ${request.buyer}`);
    return true;
  }

  /**
   * Manufacturer embeds item data into token (PERMANENT)
   */
  async embedItemData(request: TokenEmbedRequest): Promise<Token> {
    const token = this.ledger.tokens.get(request.tokenId);
    
    if (!token) {
      throw new Error(`Token ${request.tokenId} not found`);
    }

    if (token.currentOwner !== request.owner) {
      throw new Error('Only token owner can embed item data');
    }

    if (token.itemData !== null) {
      throw new Error('Token already has embedded item data (immutable)');
    }

    // Embed item data (PERMANENT - cannot be changed)
    token.itemData = request.itemData;
    token.status = 'embedded';
    token.embeddedAt = Date.now();

    const ownershipRecord: OwnershipRecord = {
      owner: request.owner,
      timestamp: Date.now(),
      transactionHash: this.generateTxHash(),
      transferType: 'embed'
    };

    token.ownershipHistory.push(ownershipRecord);

    // Create embed transaction for consensus validation
    const tx: TokenTransaction = {
      txId: this.generateTxHash(),
      type: 'embed',
      tokenId: request.tokenId,
      from: request.owner,
      to: request.owner,
      timestamp: Date.now(),
      itemData: request.itemData,
      signatures: [],
      validated: false,
      validatedBy: []
    };

    this.ledger.transactions.push(tx);

    // Broadcast to peer nodes for validation
    await this.broadcastTransaction(tx);

    console.log(`[Token Ledger] Embedded item data into token ${request.tokenId}`);
    return token;
  }

  /**
   * Transfer token to new owner (item sale)
   */
  async transferToken(request: TokenTransferRequest): Promise<Token> {
    const token = this.ledger.tokens.get(request.tokenId);
    
    if (!token) {
      throw new Error(`Token ${request.tokenId} not found`);
    }

    if (token.currentOwner !== request.from) {
      throw new Error('Only current owner can transfer token');
    }

    // Verify signature
    const isValid = this.verifySignature(
      `${request.tokenId}:${request.from}:${request.to}`,
      request.signature
    );

    if (!isValid) {
      throw new Error('Invalid transfer signature');
    }

    // Update ownership
    const ownershipRecord: OwnershipRecord = {
      owner: request.to,
      timestamp: Date.now(),
      transactionHash: this.generateTxHash(),
      transferType: 'transfer'
    };

    token.currentOwner = request.to;
    token.status = 'transferred';
    token.ownershipHistory.push(ownershipRecord);

    // Create transfer transaction for consensus validation
    const tx: TokenTransaction = {
      txId: this.generateTxHash(),
      type: 'transfer',
      tokenId: request.tokenId,
      from: request.from,
      to: request.to,
      timestamp: Date.now(),
      signatures: [],
      validated: false,
      validatedBy: []
    };

    this.ledger.transactions.push(tx);

    // Broadcast to peer nodes for validation
    await this.broadcastTransaction(tx);

    console.log(`[Token Ledger] Transferred token ${request.tokenId} from ${request.from} to ${request.to}`);
    return token;
  }

  /**
   * Validate transaction (called by operator nodes)
   */
  async validateTransaction(tx: TokenTransaction): Promise<boolean> {
    // Verify transaction integrity
    const isValid = this.verifyTransactionIntegrity(tx);
    
    if (!isValid) {
      console.log(`[Token Ledger] Transaction ${tx.txId} failed validation`);
      return false;
    }

    // Sign validation
    const signature = this.signData(tx.txId);
    tx.signatures.push({
      operatorId: this.operatorId,
      signature
    });

    tx.validatedBy.push(this.operatorId);

    // Check if consensus reached (M-of-N)
    if (tx.validatedBy.length >= this.quorumM) {
      tx.validated = true;
      console.log(`[Token Ledger] Transaction ${tx.txId} reached consensus (${tx.validatedBy.length}/${this.quorumN})`);
    }

    return true;
  }

  /**
   * Get token by ID
   */
  getToken(tokenId: string): Token | undefined {
    return this.ledger.tokens.get(tokenId);
  }

  /**
   * Get all tokens owned by address
   */
  getTokensByOwner(owner: string): Token[] {
    return Array.from(this.ledger.tokens.values()).filter(
      token => token.currentOwner === owner
    );
  }

  /**
   * Get token ownership history
   */
  getTokenHistory(tokenId: string): OwnershipRecord[] {
    const token = this.ledger.tokens.get(tokenId);
    return token ? token.ownershipHistory : [];
  }

  /**
   * Get all transactions
   */
  getTransactions(): TokenTransaction[] {
    return this.ledger.transactions;
  }

  /**
   * Get ledger statistics
   */
  getStats() {
    const tokens = Array.from(this.ledger.tokens.values());
    return {
      totalTokens: tokens.length,
      mintedTokens: tokens.filter(t => t.status === 'minted').length,
      embeddedTokens: tokens.filter(t => t.status === 'embedded').length,
      transferredTokens: tokens.filter(t => t.status === 'transferred').length,
      totalTransactions: this.ledger.transactions.length,
      lastBlockHeight: this.ledger.lastBlockHeight,
      lastSyncedAt: this.ledger.lastSyncedAt
    };
  }

  /**
   * Broadcast transaction to peer nodes for validation
   */
  private async broadcastTransaction(tx: TokenTransaction): Promise<void> {
    // In production, this would send to actual peer nodes via HTTP/WebSocket
    console.log(`[Token Ledger] Broadcasting transaction ${tx.txId} to ${this.peerNodes.length} peers`);
    
    // Simulate peer validation
    for (const peer of this.peerNodes) {
      // In production: await fetch(`${peer}/api/token/validate`, { method: 'POST', body: JSON.stringify(tx) });
      console.log(`[Token Ledger] Sent transaction to peer: ${peer}`);
    }
  }

  /**
   * Verify transaction integrity
   */
  private verifyTransactionIntegrity(tx: TokenTransaction): boolean {
    // Verify token exists
    if (tx.type !== 'mint') {
      const token = this.ledger.tokens.get(tx.tokenId);
      if (!token) {
        return false;
      }

      // Verify ownership for transfers
      if (tx.type === 'transfer' && token.currentOwner !== tx.from) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate unique token ID
   */
  private generateTokenId(): string {
    return 'TKN_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate transaction hash
   */
  private generateTxHash(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Sign data with operator's private key
   */
  private signData(data: string): string {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    // In production, use actual ECDSA signing with private key
    return crypto.createHmac('sha256', this.operatorPrivateKey).update(hash).digest('hex');
  }

  /**
   * Verify signature
   */
  private verifySignature(data: string, signature: string): boolean {
    const expectedSignature = this.signData(data);
    return signature === expectedSignature;
  }

  /**
   * Export ledger state (for syncing with other nodes)
   */
  exportLedger(): string {
    return JSON.stringify({
      tokens: Array.from(this.ledger.tokens.entries()),
      transactions: this.ledger.transactions,
      lastBlockHeight: this.ledger.lastBlockHeight,
      lastSyncedAt: this.ledger.lastSyncedAt
    });
  }

  /**
   * Import ledger state (for syncing with other nodes)
   */
  importLedger(ledgerData: string): void {
    const data = JSON.parse(ledgerData);
    this.ledger.tokens = new Map(data.tokens);
    this.ledger.transactions = data.transactions;
    this.ledger.lastBlockHeight = data.lastBlockHeight;
    this.ledger.lastSyncedAt = data.lastSyncedAt;
    console.log(`[Token Ledger] Imported ledger with ${this.ledger.tokens.size} tokens`);
  }
}
