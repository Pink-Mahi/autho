import * as bitcoin from 'bitcoinjs-lib';
import { Checkpoint, EventSignature } from './node-types';

/**
 * BITCOIN ANCHORING SYSTEM
 * 
 * Provides tamper-evident checkpoints by anchoring to Bitcoin blockchain:
 * - Periodic checkpoint creation (hourly/daily)
 * - Merkle root commitment
 * - OP_RETURN anchoring
 * - Verification of anchored checkpoints
 */
export class BitcoinAnchor {
  private network: bitcoin.Network;
  private checkpointInterval: number;
  private lastCheckpointTime: number;
  private pendingCheckpoints: Map<string, Checkpoint>;

  constructor(
    network: 'mainnet' | 'testnet' = 'mainnet',
    checkpointInterval: number = 3600000 // 1 hour default
  ) {
    this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    this.checkpointInterval = checkpointInterval;
    this.lastCheckpointTime = 0;
    this.pendingCheckpoints = new Map();
  }

  /**
   * Create checkpoint from event log
   */
  createCheckpoint(
    events: any[],
    previousCheckpointHash: string | null,
    checkpointId: string
  ): Checkpoint {
    // Build Merkle tree from events
    const eventHashes = events.map(e => this.hashEvent(e));
    const merkleRoot = this.buildMerkleRoot(eventHashes);

    // Create checkpoint
    const checkpoint: Checkpoint = {
      checkpointId,
      timestamp: Date.now(),
      eventCount: events.length,
      merkleRoot,
      previousCheckpointHash,
      bitcoinTxId: null,
      bitcoinBlockHeight: null,
      bitcoinBlockHash: null,
      anchoredAt: null
    };

    // Store as pending
    this.pendingCheckpoints.set(checkpointId, checkpoint);
    this.lastCheckpointTime = Date.now();

    return checkpoint;
  }

  /**
   * Anchor checkpoint to Bitcoin blockchain
   */
  async anchorCheckpoint(
    checkpoint: Checkpoint,
    operatorSignatures: EventSignature[],
    fundingUtxo: {
      txid: string;
      vout: number;
      value: number;
      privateKey: string;
    }
  ): Promise<{
    txid: string;
    rawTx: string;
  }> {
    // Build commitment data
    const commitmentData = this.buildCommitmentData(checkpoint, operatorSignatures);

    // Create OP_RETURN output
    const opReturnScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(commitmentData, 'hex')
    ]);

    // Build transaction
    const psbt = new bitcoin.Psbt({ network: this.network });

    // Add input
    psbt.addInput({
      hash: fundingUtxo.txid,
      index: fundingUtxo.vout,
      witnessUtxo: {
        script: Buffer.from('0014' + '00'.repeat(20), 'hex'), // P2WPKH placeholder
        value: fundingUtxo.value
      }
    });

    // Add OP_RETURN output
    psbt.addOutput({
      script: opReturnScript,
      value: 0
    });

    // Add change output (if needed)
    const fee = 1000; // 1000 sats
    const changeValue = fundingUtxo.value - fee;
    if (changeValue > 546) { // Dust threshold
      psbt.addOutput({
        address: this.deriveAddress(fundingUtxo.privateKey),
        value: changeValue
      });
    }

    // Sign transaction
    const keyPair = bitcoin.ECPair.fromWIF(fundingUtxo.privateKey, this.network);
    psbt.signInput(0, keyPair);
    psbt.finalizeAllInputs();

    // Extract transaction
    const tx = psbt.extractTransaction();
    const txid = tx.getId();
    const rawTx = tx.toHex();

    console.log(`[BitcoinAnchor] Created anchor transaction: ${txid}`);
    console.log(`[BitcoinAnchor] Commitment: ${commitmentData}`);

    return { txid, rawTx };
  }

  /**
   * Verify checkpoint anchor
   */
  async verifyCheckpointAnchor(
    checkpoint: Checkpoint,
    bitcoinTx: string,
    blockHeight: number
  ): Promise<boolean> {
    try {
      // Parse transaction
      const tx = bitcoin.Transaction.fromHex(bitcoinTx);

      // Find OP_RETURN output
      const opReturnOutput = tx.outs.find(out => {
        const script = bitcoin.script.decompile(out.script);
        return script && script[0] === bitcoin.opcodes.OP_RETURN;
      });

      if (!opReturnOutput) {
        console.error('[BitcoinAnchor] No OP_RETURN output found');
        return false;
      }

      // Extract commitment data
      const script = bitcoin.script.decompile(opReturnOutput.script);
      if (!script || script.length < 2) {
        console.error('[BitcoinAnchor] Invalid OP_RETURN script');
        return false;
      }

      const commitmentData = (script[1] as Buffer).toString('hex');

      // Verify commitment matches checkpoint
      const expectedCommitment = this.hashCheckpoint(checkpoint);
      const actualCommitment = commitmentData.substring(0, 64); // First 32 bytes

      if (expectedCommitment !== actualCommitment) {
        console.error('[BitcoinAnchor] Commitment mismatch');
        return false;
      }

      console.log(`[BitcoinAnchor] Checkpoint ${checkpoint.checkpointId} verified at block ${blockHeight}`);
      return true;
    } catch (error) {
      console.error('[BitcoinAnchor] Error verifying checkpoint:', error);
      return false;
    }
  }

  /**
   * Build commitment data for OP_RETURN
   */
  private buildCommitmentData(checkpoint: Checkpoint, signatures: EventSignature[]): string {
    // Format: checkpointHash (32 bytes) + signatureCount (1 byte) + signatures (variable)
    const checkpointHash = this.hashCheckpoint(checkpoint);
    const signatureCount = Math.min(signatures.length, 255).toString(16).padStart(2, '0');
    
    // Include first 3 signatures (space limited in OP_RETURN)
    const signatureData = signatures.slice(0, 3)
      .map(sig => sig.signature.substring(0, 32)) // Truncate for space
      .join('');

    return checkpointHash + signatureCount + signatureData;
  }

  /**
   * Hash checkpoint for commitment
   */
  private hashCheckpoint(checkpoint: Checkpoint): string {
    const data = JSON.stringify({
      checkpointId: checkpoint.checkpointId,
      timestamp: checkpoint.timestamp,
      eventCount: checkpoint.eventCount,
      merkleRoot: checkpoint.merkleRoot,
      previousCheckpointHash: checkpoint.previousCheckpointHash
    });

    return bitcoin.crypto.sha256(Buffer.from(data)).toString('hex');
  }

  /**
   * Hash individual event
   */
  private hashEvent(event: any): string {
    const canonical = JSON.stringify(event, Object.keys(event).sort());
    return bitcoin.crypto.sha256(Buffer.from(canonical)).toString('hex');
  }

  /**
   * Build Merkle root from event hashes
   */
  private buildMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
      return '0'.repeat(64);
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    // Build Merkle tree bottom-up
    let currentLevel = hashes;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        const combined = Buffer.concat([
          Buffer.from(left, 'hex'),
          Buffer.from(right, 'hex')
        ]);

        const hash = bitcoin.crypto.sha256(combined).toString('hex');
        nextLevel.push(hash);
      }

      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Derive Bitcoin address from private key
   */
  private deriveAddress(privateKeyWIF: string): string {
    const keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, this.network);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to derive address');
    }

    return address;
  }

  /**
   * Check if checkpoint is due
   */
  isCheckpointDue(): boolean {
    return Date.now() - this.lastCheckpointTime >= this.checkpointInterval;
  }

  /**
   * Get pending checkpoints
   */
  getPendingCheckpoints(): Checkpoint[] {
    return Array.from(this.pendingCheckpoints.values());
  }

  /**
   * Mark checkpoint as anchored
   */
  markCheckpointAnchored(
    checkpointId: string,
    txid: string,
    blockHeight: number,
    blockHash: string
  ): void {
    const checkpoint = this.pendingCheckpoints.get(checkpointId);
    if (checkpoint) {
      checkpoint.bitcoinTxId = txid;
      checkpoint.bitcoinBlockHeight = blockHeight;
      checkpoint.bitcoinBlockHash = blockHash;
      checkpoint.anchoredAt = Date.now();
      this.pendingCheckpoints.delete(checkpointId);
    }
  }

  /**
   * Estimate anchor cost
   */
  estimateAnchorCost(feeRate: number = 10): number {
    // Typical anchor tx: 1 input + 1 OP_RETURN + 1 change = ~200 vbytes
    const estimatedSize = 200;
    return estimatedSize * feeRate;
  }

  /**
   * Create checkpoint commitment for verification
   */
  createCheckpointCommitment(
    eventHashes: string[],
    previousCheckpointHash: string | null
  ): string {
    const merkleRoot = this.buildMerkleRoot(eventHashes);
    const data = JSON.stringify({
      merkleRoot,
      previousCheckpointHash,
      timestamp: Date.now()
    });

    return bitcoin.crypto.sha256(Buffer.from(data)).toString('hex');
  }

  /**
   * Verify Merkle proof for event inclusion
   */
  verifyMerkleProof(
    eventHash: string,
    proof: string[],
    merkleRoot: string
  ): boolean {
    let currentHash = eventHash;

    for (const siblingHash of proof) {
      const combined = Buffer.concat([
        Buffer.from(currentHash, 'hex'),
        Buffer.from(siblingHash, 'hex')
      ]);
      currentHash = bitcoin.crypto.sha256(combined).toString('hex');
    }

    return currentHash === merkleRoot;
  }
}

/**
 * Checkpoint Manager
 * 
 * Coordinates checkpoint creation and anchoring
 */
export class CheckpointManager {
  private anchor: BitcoinAnchor;
  private checkpoints: Map<string, Checkpoint>;
  private checkpointCounter: number;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.anchor = new BitcoinAnchor(network);
    this.checkpoints = new Map();
    this.checkpointCounter = 0;
  }

  /**
   * Create and store checkpoint
   */
  async createCheckpoint(
    events: any[],
    previousCheckpointHash: string | null
  ): Promise<Checkpoint> {
    const checkpointId = `checkpoint-${Date.now()}-${this.checkpointCounter++}`;
    const checkpoint = this.anchor.createCheckpoint(events, previousCheckpointHash, checkpointId);
    this.checkpoints.set(checkpointId, checkpoint);
    return checkpoint;
  }

  /**
   * Anchor checkpoint to Bitcoin
   */
  async anchorCheckpoint(
    checkpointId: string,
    operatorSignatures: EventSignature[],
    fundingUtxo: any
  ): Promise<string> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const { txid } = await this.anchor.anchorCheckpoint(
      checkpoint,
      operatorSignatures,
      fundingUtxo
    );

    return txid;
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Get all checkpoints
   */
  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): Checkpoint | null {
    const checkpoints = this.getAllCheckpoints();
    if (checkpoints.length === 0) return null;
    return checkpoints.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }
}
