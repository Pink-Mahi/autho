export interface LightningInvoice {
  paymentRequest: string; // BOLT11 invoice
  paymentHash: string;
  amountSats: number;
  description: string;
  expiresAt: number;
  status: 'pending' | 'paid' | 'expired';
}

export interface LightningConfig {
  type: 'lnd' | 'cln' | 'lnbits' | 'mock';
  endpoint?: string;
  macaroon?: string;
  apiKey?: string;
}

export class LightningService {
  private config: LightningConfig;
  private invoices: Map<string, LightningInvoice> = new Map();

  constructor(config: LightningConfig) {
    this.config = config;
    console.log(`[Lightning] Initialized with ${config.type} backend`);
  }

  /**
   * Create a Lightning invoice
   */
  async createInvoice(
    amountSats: number,
    description: string,
    expirySeconds: number = 3600
  ): Promise<LightningInvoice> {
    if (this.config.type === 'mock') {
      return this.createMockInvoice(amountSats, description, expirySeconds);
    }

    // Real Lightning implementation
    try {
      if (this.config.type === 'lnbits') {
        return await this.createLNbitsInvoice(amountSats, description, expirySeconds);
      } else if (this.config.type === 'lnd') {
        return await this.createLNDInvoice(amountSats, description, expirySeconds);
      } else if (this.config.type === 'cln') {
        return await this.createCLNInvoice(amountSats, description, expirySeconds);
      }
    } catch (error) {
      console.error('[Lightning] Error creating invoice:', error);
      throw error;
    }

    throw new Error(`Unsupported Lightning backend: ${this.config.type}`);
  }

  /**
   * Check invoice status
   */
  async checkInvoice(paymentHash: string): Promise<LightningInvoice | null> {
    if (this.config.type === 'mock') {
      return this.invoices.get(paymentHash) || null;
    }

    try {
      if (this.config.type === 'lnbits') {
        return await this.checkLNbitsInvoice(paymentHash);
      } else if (this.config.type === 'lnd') {
        return await this.checkLNDInvoice(paymentHash);
      } else if (this.config.type === 'cln') {
        return await this.checkCLNInvoice(paymentHash);
      }
    } catch (error) {
      console.error('[Lightning] Error checking invoice:', error);
      return null;
    }

    return null;
  }

  /**
   * LNbits implementation
   */
  private async createLNbitsInvoice(
    amountSats: number,
    description: string,
    expirySeconds: number
  ): Promise<LightningInvoice> {
    const response = await fetch(`${this.config.endpoint}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.config.apiKey || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        out: false,
        amount: amountSats,
        memo: description,
        expiry: expirySeconds
      })
    });

    if (!response.ok) {
      throw new Error(`LNbits API error: ${response.statusText}`);
    }

    const data = await response.json();

    const invoice: LightningInvoice = {
      paymentRequest: data.payment_request,
      paymentHash: data.payment_hash,
      amountSats,
      description,
      expiresAt: Date.now() + expirySeconds * 1000,
      status: 'pending'
    };

    this.invoices.set(data.payment_hash, invoice);
    return invoice;
  }

  private async checkLNbitsInvoice(paymentHash: string): Promise<LightningInvoice | null> {
    const response = await fetch(`${this.config.endpoint}/api/v1/payments/${paymentHash}`, {
      headers: {
        'X-Api-Key': this.config.apiKey || ''
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const invoice = this.invoices.get(paymentHash);

    if (invoice) {
      invoice.status = data.paid ? 'paid' : 'pending';
      return invoice;
    }

    return null;
  }

  /**
   * LND implementation (gRPC REST gateway)
   */
  private async createLNDInvoice(
    amountSats: number,
    description: string,
    expirySeconds: number
  ): Promise<LightningInvoice> {
    const response = await fetch(`${this.config.endpoint}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Grpc-Metadata-macaroon': this.config.macaroon || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: amountSats.toString(),
        memo: description,
        expiry: expirySeconds.toString()
      })
    });

    if (!response.ok) {
      throw new Error(`LND API error: ${response.statusText}`);
    }

    const data = await response.json();

    const invoice: LightningInvoice = {
      paymentRequest: data.payment_request,
      paymentHash: data.r_hash,
      amountSats,
      description,
      expiresAt: Date.now() + expirySeconds * 1000,
      status: 'pending'
    };

    this.invoices.set(data.r_hash, invoice);
    return invoice;
  }

  private async checkLNDInvoice(paymentHash: string): Promise<LightningInvoice | null> {
    const response = await fetch(`${this.config.endpoint}/v1/invoice/${paymentHash}`, {
      headers: {
        'Grpc-Metadata-macaroon': this.config.macaroon || ''
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const invoice = this.invoices.get(paymentHash);

    if (invoice) {
      invoice.status = data.settled ? 'paid' : 'pending';
      return invoice;
    }

    return null;
  }

  /**
   * Core Lightning implementation
   */
  private async createCLNInvoice(
    amountSats: number,
    description: string,
    expirySeconds: number
  ): Promise<LightningInvoice> {
    const response = await fetch(`${this.config.endpoint}/v1/invoice/genInvoice`, {
      method: 'POST',
      headers: {
        'macaroon': this.config.macaroon || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amountSats * 1000, // CLN uses millisats
        label: `invoice_${Date.now()}`,
        description,
        expiry: expirySeconds
      })
    });

    if (!response.ok) {
      throw new Error(`CLN API error: ${response.statusText}`);
    }

    const data = await response.json();

    const invoice: LightningInvoice = {
      paymentRequest: data.bolt11,
      paymentHash: data.payment_hash,
      amountSats,
      description,
      expiresAt: Date.now() + expirySeconds * 1000,
      status: 'pending'
    };

    this.invoices.set(data.payment_hash, invoice);
    return invoice;
  }

  private async checkCLNInvoice(paymentHash: string): Promise<LightningInvoice | null> {
    const response = await fetch(`${this.config.endpoint}/v1/invoice/listInvoices`, {
      headers: {
        'macaroon': this.config.macaroon || ''
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const invoiceData = data.invoices?.find((inv: any) => inv.payment_hash === paymentHash);

    if (!invoiceData) {
      return null;
    }

    const invoice = this.invoices.get(paymentHash);
    if (invoice) {
      invoice.status = invoiceData.status === 'paid' ? 'paid' : 'pending';
      return invoice;
    }

    return null;
  }

  /**
   * Mock implementation for testing
   */
  private createMockInvoice(
    amountSats: number,
    description: string,
    expirySeconds: number
  ): LightningInvoice {
    const paymentHash = 'mock_' + Math.random().toString(36).substring(7);
    const paymentRequest = `lnbc${amountSats}n1mock${Math.random().toString(36).substring(7)}`;

    const invoice: LightningInvoice = {
      paymentRequest,
      paymentHash,
      amountSats,
      description,
      expiresAt: Date.now() + expirySeconds * 1000,
      status: 'pending'
    };

    this.invoices.set(paymentHash, invoice);
    console.log(`[Lightning Mock] Created invoice: ${paymentHash} for ${amountSats} sats`);

    return invoice;
  }

  /**
   * Decode a Lightning invoice (BOLT11)
   */
  decodeInvoice(paymentRequest: string): { amountSats?: number; description?: string } {
    // This is a simplified decoder - in production use a proper BOLT11 library
    try {
      // Extract amount from invoice (lnbc<amount>)
      const match = paymentRequest.match(/lnbc(\d+)([munp])?/);
      if (match) {
        let amount = parseInt(match[1]);
        const unit = match[2];
        
        // Convert to sats
        if (unit === 'm') amount *= 100000; // milli-bitcoin
        else if (unit === 'u') amount *= 100; // micro-bitcoin
        else if (unit === 'n') amount *= 0.1; // nano-bitcoin
        else if (unit === 'p') amount *= 0.0001; // pico-bitcoin
        
        return { amountSats: Math.floor(amount) };
      }
    } catch (error) {
      console.error('Error decoding invoice:', error);
    }
    
    return {};
  }
}
