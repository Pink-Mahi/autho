import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

const ECPair = ECPairFactory(ecc);

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

export interface TransactionResult {
  success: boolean;
  txid?: string;
  error?: string;
}

export class BitcoinTransactionService {
  private network: bitcoin.Network;
  private apiBase: string;

  constructor(networkType: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = networkType === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    this.apiBase = networkType === 'mainnet'
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const response = await fetch(`${this.apiBase}/address/${address}/utxo`);
    if (!response.ok) {
      throw new Error('Failed to fetch UTXOs');
    }
    return await response.json();
  }

  async estimateFee(): Promise<number> {
    try {
      const response = await fetch(`${this.apiBase}/fee-estimates`);
      const fees = await response.json();
      // Use 6 block target (about 1 hour)
      return fees['6'] || 3; // Default to 3 sat/vB if API fails
    } catch (error) {
      return 3; // Fallback fee rate
    }
  }

  async createAndSignTransaction(
    privateKeyWIF: string,
    toAddress: string,
    amountSats: number,
    feeRate?: number
  ): Promise<string> {
    // Parse private key (support both WIF and raw 32-byte hex)
    let keyPair: any;
    try {
      keyPair = ECPair.fromWIF(privateKeyWIF, this.network);
    } catch (e) {
      const maybeHex = privateKeyWIF.trim();
      const isHex = /^[0-9a-fA-F]{64}$/.test(maybeHex);
      if (!isHex) {
        throw e;
      }
      const privKeyBuf = Buffer.from(maybeHex, 'hex');
      keyPair = ECPair.fromPrivateKey(privKeyBuf, { network: this.network });
    }
    const fromAddress = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: this.network
    }).address!;

    // Get UTXOs
    const utxos = await this.getUTXOs(fromAddress);
    if (utxos.length === 0) {
      throw new Error('No UTXOs available');
    }

    // Calculate fee
    const estimatedFeeRate = feeRate || await this.estimateFee();
    
    // Select UTXOs (simple: use all confirmed UTXOs)
    const confirmedUTXOs = utxos.filter(u => u.status.confirmed);
    if (confirmedUTXOs.length === 0) {
      throw new Error('No confirmed UTXOs available');
    }

    const totalInput = confirmedUTXOs.reduce((sum, utxo) => sum + utxo.value, 0);
    
    // Estimate transaction size (rough estimate)
    const estimatedSize = confirmedUTXOs.length * 148 + 2 * 34 + 10;
    const estimatedFee = Math.ceil(estimatedSize * estimatedFeeRate);
    
    if (totalInput < amountSats + estimatedFee) {
      throw new Error(`Insufficient funds. Have ${totalInput} sats, need ${amountSats + estimatedFee} sats (including ${estimatedFee} sats fee)`);
    }

    const changeAmount = totalInput - amountSats - estimatedFee;

    // Create transaction
    const psbt = new bitcoin.Psbt({ network: this.network });

    // Add inputs
    for (const utxo of confirmedUTXOs) {
      const txHex = await this.getTransactionHex(utxo.txid);
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(txHex, 'hex')
      });
    }

    // Add output to recipient
    psbt.addOutput({
      address: toAddress,
      value: amountSats
    });

    // Add change output if significant (> 546 sats dust limit)
    if (changeAmount > 546) {
      psbt.addOutput({
        address: fromAddress,
        value: changeAmount
      });
    }

    // Sign all inputs
    for (let i = 0; i < confirmedUTXOs.length; i++) {
      psbt.signInput(i, keyPair);
    }

    // Finalize and extract transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    
    return tx.toHex();
  }

  async getTransactionHex(txid: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/tx/${txid}/hex`);
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction ${txid}`);
    }
    return await response.text();
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    const response = await fetch(`${this.apiBase}/tx`, {
      method: 'POST',
      body: txHex
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Broadcast failed: ${error}`);
    }

    return await response.text(); // Returns txid
  }

  async sendBitcoin(
    privateKeyWIF: string,
    toAddress: string,
    amountSats: number,
    feeRate?: number
  ): Promise<TransactionResult> {
    try {
      console.log(`[Bitcoin TX] Creating transaction: ${amountSats} sats to ${toAddress}`);
      
      const txHex = await this.createAndSignTransaction(
        privateKeyWIF,
        toAddress,
        amountSats,
        feeRate
      );

      console.log(`[Bitcoin TX] Transaction created, broadcasting...`);
      
      const txid = await this.broadcastTransaction(txHex);

      console.log(`[Bitcoin TX] Transaction broadcast successfully: ${txid}`);

      return {
        success: true,
        txid
      };
    } catch (error: any) {
      console.error(`[Bitcoin TX] Error:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
