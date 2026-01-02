import { HDWallet, PaymentAddress } from './hd-wallet';
import { PaymentMonitor, Payment } from './payment-monitor';
import { LightningService, LightningInvoice, LightningConfig } from './lightning-service';
import * as fs from 'fs';
import * as path from 'path';

export interface PaymentRequest {
  offerId: string;
  amountSats: number;
  expirySeconds: number;
  paymentMethod?: 'bitcoin' | 'lightning' | 'both';
  metadata?: any;
}

export interface FeeDistribution {
  totalFeeSats: number;
  mainNodeFeeSats: number;
  operatorFeeSats: number;
  mainNodeAddress: string;
  operatorAddresses: string[];
}

export interface PaymentResponse {
  offerId: string;
  paymentMethod: 'bitcoin' | 'lightning' | 'both';
  // Bitcoin fields
  paymentAddress?: string;
  amountBTC?: number;
  bitcoinQR?: string;
  // Lightning fields
  lightningInvoice?: string;
  lightningPaymentHash?: string;
  lightningQR?: string;
  // Common fields
  amountSats: number;
  expiresAt: number;
  // Fee information
  platformFeeSats?: number;
  sellerReceivesSats?: number;
  feeDistribution?: FeeDistribution;
}

export class PaymentService {
  private hdWallet: HDWallet;
  private monitor: PaymentMonitor;
  private lightning: LightningService;
  private addressIndex: number = 0;
  private addressMap: Map<string, { offerId: string; index: number }> = new Map();
  private lightningInvoices: Map<string, { offerId: string; invoice: LightningInvoice }> = new Map();
  private dataDir: string;
  private network: 'mainnet' | 'testnet';
  
  // Platform fee configuration
  private static readonly PLATFORM_FEE_PERCENT = 0.75; // 0.75% total platform fee
  private static readonly MAIN_NODE_SPLIT = 0.60; // 60% to main node
  private static readonly OPERATOR_SPLIT = 0.40; // 40% to operator nodes

  constructor(dataDir: string, network: 'mainnet' | 'testnet' = 'mainnet', lightningConfig?: LightningConfig) {
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
    
    // Initialize Lightning service
    this.lightning = new LightningService(lightningConfig || { type: 'mock' });
  }

  /**
   * Calculate platform fee for a transaction
   */
  static calculatePlatformFee(amountSats: number): number {
    return Math.floor(amountSats * (PaymentService.PLATFORM_FEE_PERCENT / 100));
  }

  /**
   * Calculate fee distribution between main node and operators
   */
  static calculateFeeDistribution(
    totalFeeSats: number,
    mainNodeAddress: string,
    operatorAddresses: string[]
  ): FeeDistribution {
    const mainNodeFeeSats = Math.floor(totalFeeSats * PaymentService.MAIN_NODE_SPLIT);
    const operatorFeeSats = totalFeeSats - mainNodeFeeSats;

    return {
      totalFeeSats,
      mainNodeFeeSats,
      operatorFeeSats,
      mainNodeAddress,
      operatorAddresses
    };
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
  async createPaymentRequest(
    request: PaymentRequest,
    onPaymentConfirmed?: (payment: Payment) => void,
    mainNodeAddress?: string,
    operatorAddresses?: string[]
  ): Promise<PaymentResponse> {
    const paymentMethod = request.paymentMethod || 'both';
    const expiresAt = Date.now() + request.expirySeconds * 1000;
    const amountBTC = request.amountSats / 100000000;

    // Calculate platform fee (0.75%)
    const platformFeeSats = PaymentService.calculatePlatformFee(request.amountSats);
    const sellerReceivesSats = request.amountSats - platformFeeSats;

    const response: PaymentResponse = {
      offerId: request.offerId,
      paymentMethod,
      amountSats: request.amountSats,
      expiresAt,
      platformFeeSats,
      sellerReceivesSats
    };

    // Calculate fee distribution if addresses provided
    if (mainNodeAddress && operatorAddresses && operatorAddresses.length > 0) {
      response.feeDistribution = PaymentService.calculateFeeDistribution(
        platformFeeSats,
        mainNodeAddress,
        operatorAddresses
      );
    }

    // Generate Bitcoin payment address
    if (paymentMethod === 'bitcoin' || paymentMethod === 'both') {
      const addressInfo = this.hdWallet.derivePaymentAddress(this.addressIndex);
      
      this.addressMap.set(addressInfo.address, {
        offerId: request.offerId,
        index: this.addressIndex
      });

      this.addressIndex++;
      this.saveAddressIndex();

      this.monitor.registerPayment(
        addressInfo.address,
        request.amountSats,
        request.expirySeconds,
        onPaymentConfirmed
      );

      response.paymentAddress = addressInfo.address;
      response.amountBTC = amountBTC;
      response.bitcoinQR = `bitcoin:${addressInfo.address}?amount=${amountBTC}`;

      console.log(`[Payment Service] Bitcoin address: ${addressInfo.address}`);
    }

    // Generate Lightning invoice
    if (paymentMethod === 'lightning' || paymentMethod === 'both') {
      try {
        const invoice = await this.lightning.createInvoice(
          request.amountSats,
          `Payment for offer ${request.offerId}`,
          request.expirySeconds
        );

        this.lightningInvoices.set(invoice.paymentHash, {
          offerId: request.offerId,
          invoice
        });

        response.lightningInvoice = invoice.paymentRequest;
        response.lightningPaymentHash = invoice.paymentHash;
        response.lightningQR = invoice.paymentRequest;

        console.log(`[Payment Service] Lightning invoice: ${invoice.paymentHash}`);

        // Start monitoring Lightning invoice
        this.monitorLightningInvoice(invoice.paymentHash, onPaymentConfirmed);
      } catch (error) {
        console.error('[Payment Service] Error creating Lightning invoice:', error);
        // If Lightning fails but both was requested, continue with Bitcoin only
        if (paymentMethod === 'both') {
          response.paymentMethod = 'bitcoin';
        } else {
          throw error;
        }
      }
    }

    console.log(`[Payment Service] Created payment request for offer ${request.offerId}`);
    console.log(`  Method: ${response.paymentMethod}`);
    console.log(`  Total Amount: ${request.amountSats} sats (${amountBTC} BTC)`);
    console.log(`  Platform Fee (0.75%): ${platformFeeSats} sats`);
    console.log(`  Seller Receives: ${sellerReceivesSats} sats`);
    if (response.feeDistribution) {
      console.log(`  Fee Distribution:`);
      console.log(`    Main Node (60%): ${response.feeDistribution.mainNodeFeeSats} sats`);
      console.log(`    Operators (40%): ${response.feeDistribution.operatorFeeSats} sats`);
    }
    console.log(`  Expires: ${new Date(expiresAt).toISOString()}`);

    return response;
  }

  /**
   * Monitor a Lightning invoice for payment
   */
  private async monitorLightningInvoice(
    paymentHash: string,
    onPaymentConfirmed?: (payment: Payment) => void
  ): Promise<void> {
    const checkInvoice = async () => {
      const invoice = await this.lightning.checkInvoice(paymentHash);
      
      if (invoice && invoice.status === 'paid') {
        console.log(`[Lightning] Invoice paid: ${paymentHash}`);
        
        if (onPaymentConfirmed) {
          // Convert Lightning payment to Payment format
          const payment: Payment = {
            address: paymentHash,
            expectedAmountSats: invoice.amountSats,
            receivedAmountSats: invoice.amountSats,
            confirmations: 1, // Lightning is instant
            txid: paymentHash,
            status: 'confirmed',
            createdAt: Date.now(),
            expiresAt: invoice.expiresAt
          };
          
          onPaymentConfirmed(payment);
        }
        
        return;
      }

      // Check again in 5 seconds if not paid
      if (invoice && invoice.status === 'pending' && Date.now() < invoice.expiresAt) {
        setTimeout(checkInvoice, 5000);
      }
    };

    // Start checking
    checkInvoice();
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
