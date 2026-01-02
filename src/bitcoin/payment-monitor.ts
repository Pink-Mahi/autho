export interface Payment {
  address: string;
  expectedAmountSats: number;
  receivedAmountSats: number;
  confirmations: number;
  txid?: string;
  status: 'pending' | 'partial' | 'confirmed' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface PaymentUpdate {
  address: string;
  txid: string;
  amountSats: number;
  confirmations: number;
}

export class PaymentMonitor {
  private payments: Map<string, Payment> = new Map();
  private apiBase: string;
  private checkInterval: number = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;
  private callbacks: Map<string, (payment: Payment) => void> = new Map();

  constructor(networkType: 'mainnet' | 'testnet' = 'mainnet') {
    this.apiBase = networkType === 'mainnet'
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
  }

  /**
   * Register a payment to monitor
   */
  registerPayment(
    address: string,
    expectedAmountSats: number,
    expirySeconds: number,
    callback?: (payment: Payment) => void
  ): Payment {
    const payment: Payment = {
      address,
      expectedAmountSats,
      receivedAmountSats: 0,
      confirmations: 0,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + expirySeconds * 1000
    };

    this.payments.set(address, payment);
    
    if (callback) {
      this.callbacks.set(address, callback);
    }

    console.log(`[Payment Monitor] Registered payment: ${address} expecting ${expectedAmountSats} sats`);
    
    return payment;
  }

  /**
   * Start monitoring all registered payments
   */
  start(): void {
    if (this.intervalId) {
      console.log('[Payment Monitor] Already running');
      return;
    }

    console.log('[Payment Monitor] Starting payment monitoring...');
    this.intervalId = setInterval(() => this.checkPayments(), this.checkInterval);
    
    // Check immediately
    this.checkPayments();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[Payment Monitor] Stopped payment monitoring');
    }
  }

  /**
   * Check all pending payments
   */
  private async checkPayments(): Promise<void> {
    const now = Date.now();
    
    for (const [address, payment] of this.payments.entries()) {
      // Skip if already confirmed or expired
      if (payment.status === 'confirmed' || payment.status === 'expired') {
        continue;
      }

      // Check if expired
      if (now > payment.expiresAt) {
        payment.status = 'expired';
        this.notifyCallback(address, payment);
        console.log(`[Payment Monitor] Payment expired: ${address}`);
        continue;
      }

      // Check blockchain for payment
      try {
        const update = await this.checkAddress(address);
        
        if (update) {
          payment.receivedAmountSats = update.amountSats;
          payment.confirmations = update.confirmations;
          payment.txid = update.txid;

          // Update status
          if (payment.receivedAmountSats >= payment.expectedAmountSats) {
            if (payment.confirmations >= 1) {
              payment.status = 'confirmed';
              console.log(`[Payment Monitor] Payment confirmed: ${address} - ${payment.receivedAmountSats} sats`);
            } else {
              payment.status = 'partial';
              console.log(`[Payment Monitor] Payment detected (0-conf): ${address} - ${payment.receivedAmountSats} sats`);
            }
          } else if (payment.receivedAmountSats > 0) {
            payment.status = 'partial';
            console.log(`[Payment Monitor] Partial payment: ${address} - ${payment.receivedAmountSats}/${payment.expectedAmountSats} sats`);
          }

          this.notifyCallback(address, payment);
        }
      } catch (error) {
        console.error(`[Payment Monitor] Error checking ${address}:`, error);
      }
    }
  }

  /**
   * Check a specific address for payments
   */
  private async checkAddress(address: string): Promise<PaymentUpdate | null> {
    try {
      const response = await fetch(`${this.apiBase}/address/${address}/utxo`);
      
      if (!response.ok) {
        return null;
      }

      const utxos = await response.json();
      
      if (!utxos || utxos.length === 0) {
        return null;
      }

      // Sum all UTXOs for this address
      let totalSats = 0;
      let minConfirmations = Infinity;
      let latestTxid = '';

      for (const utxo of utxos) {
        totalSats += utxo.value;
        
        const confirmations = utxo.status.confirmed 
          ? (utxo.status.block_height ? 6 : 0) // Simplified: assume 6+ if in a block
          : 0;
        
        if (confirmations < minConfirmations) {
          minConfirmations = confirmations;
          latestTxid = utxo.txid;
        }
      }

      return {
        address,
        txid: latestTxid,
        amountSats: totalSats,
        confirmations: minConfirmations === Infinity ? 0 : minConfirmations
      };
    } catch (error) {
      console.error(`Error checking address ${address}:`, error);
      return null;
    }
  }

  /**
   * Notify callback if registered
   */
  private notifyCallback(address: string, payment: Payment): void {
    const callback = this.callbacks.get(address);
    if (callback) {
      callback(payment);
    }
  }

  /**
   * Get payment status
   */
  getPayment(address: string): Payment | undefined {
    return this.payments.get(address);
  }

  /**
   * Get all payments
   */
  getAllPayments(): Payment[] {
    return Array.from(this.payments.values());
  }

  /**
   * Remove a payment from monitoring
   */
  removePayment(address: string): void {
    this.payments.delete(address);
    this.callbacks.delete(address);
  }
}
