import { HDWallet, PaymentAddress } from './hd-wallet';
import { PaymentMonitor, Payment } from './payment-monitor';
import * as fs from 'fs';
import * as path from 'path';

export interface PaymentRequest {
  offerId: string;
  amountSats: number;
  expirySeconds: number;
  metadata?: any;
}

export interface PaymentResponse {
  offerId: string;
  paymentAddress: string;
  amountSats: number;
  amountBTC: number;
  expiresAt: number;
  qrData: string;
}

export class PaymentService {
  private hdWallet: HDWallet;
  private monitor: PaymentMonitor;
  private addressIndex: number = 0;
  private addressMap: Map<string, { offerId: string; index: number }> = new Map();
  private dataDir: string;
  private network: 'mainnet' | 'testnet';

  constructor(dataDir: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.dataDir = dataDir;
    this.network = network;
    
    // Load or create HD wallet
    const walletFile = path.join(dataDir, 'payment-wallet.json');
    let mnemonic: string;
    
    if (fs.existsSync(walletFile)) {
      console.log('[Payment Service] Loading existing payment wallet...');
      const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
      mnemonic = walletData.mnemonic;
      this.addressIndex = walletData.lastIndex || 0;
    } else {
      console.log('[Payment Service] Creating new payment wallet...');
      mnemonic = HDWallet.generateMnemonic();
      
      const walletData = {
        mnemonic,
        lastIndex: 0,
        createdAt: Date.now(),
        network
      };
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
      console.log('⚠️  IMPORTANT: Payment wallet created. Backup your mnemonic!');
      console.log('📝 Mnemonic stored in:', walletFile);
    }

    this.hdWallet = new HDWallet(mnemonic, network);
    this.monitor = new PaymentMonitor(network);
  }

  /**
   * Start monitoring payments
   */
  start(): void {
    this.monitor.start();
    console.log('[Payment Service] Payment monitoring started');
  }

  /**
   * Stop monitoring payments
   */
  stop(): void {
    this.monitor.stop();
    console.log('[Payment Service] Payment monitoring stopped');
  }

  /**
   * Create a payment request for an offer
   */
  createPaymentRequest(
    request: PaymentRequest,
    onPaymentConfirmed?: (payment: Payment) => void
  ): PaymentResponse {
    // Generate unique address for this payment
    const addressInfo = this.hdWallet.derivePaymentAddress(this.addressIndex);
    
    // Store mapping
    this.addressMap.set(addressInfo.address, {
      offerId: request.offerId,
      index: this.addressIndex
    });

    // Increment index and save
    this.addressIndex++;
    this.saveAddressIndex();

    // Register payment for monitoring
    this.monitor.registerPayment(
      addressInfo.address,
      request.amountSats,
      request.expirySeconds,
      onPaymentConfirmed
    );

    const amountBTC = request.amountSats / 100000000;
    const expiresAt = Date.now() + request.expirySeconds * 1000;

    // Create Bitcoin URI for QR code
    const qrData = `bitcoin:${addressInfo.address}?amount=${amountBTC}`;

    console.log(`[Payment Service] Created payment request for offer ${request.offerId}`);
    console.log(`  Address: ${addressInfo.address}`);
    console.log(`  Amount: ${request.amountSats} sats (${amountBTC} BTC)`);
    console.log(`  Expires: ${new Date(expiresAt).toISOString()}`);

    return {
      offerId: request.offerId,
      paymentAddress: addressInfo.address,
      amountSats: request.amountSats,
      amountBTC,
      expiresAt,
      qrData
    };
  }

  /**
   * Get payment status for an address
   */
  getPaymentStatus(address: string): Payment | undefined {
    return this.monitor.getPayment(address);
  }

  /**
   * Get offer ID for a payment address
   */
  getOfferIdForAddress(address: string): string | undefined {
    return this.addressMap.get(address)?.offerId;
  }

  /**
   * Get all active payments
   */
  getAllPayments(): Payment[] {
    return this.monitor.getAllPayments();
  }

  /**
   * Save current address index
   */
  private saveAddressIndex(): void {
    const walletFile = path.join(this.dataDir, 'payment-wallet.json');
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    walletData.lastIndex = this.addressIndex;
    fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
  }

  /**
   * Get wallet mnemonic for backup
   */
  getMnemonic(): string {
    const walletFile = path.join(this.dataDir, 'payment-wallet.json');
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    return walletData.mnemonic;
  }

  /**
   * Sweep funds from payment addresses to main wallet
   */
  async sweepFunds(toAddress: string): Promise<{ txid: string; amount: number }> {
    // This would collect all UTXOs from payment addresses and send to main wallet
    // Implementation requires transaction construction similar to BitcoinTransactionService
    throw new Error('Sweep functionality not yet implemented');
  }
}
